mod access_link;
mod account_passkey;
mod account_password;
mod account_password_confirmation;
mod account_profile;
mod account_profile_image;
mod account_two_factor;
mod admin_learning_group;
mod admin_registration_tokens;
mod admin_role;
mod admin_user;
mod bootstrap;
mod config;
mod csrf;
mod current_user;
mod error;
mod feedback_prompt_preference;
mod identity;
mod identity_registration;
mod image_upload;
mod journal_feedback_review;
mod learner_activity_replay_run;
mod learner_appearance_preference;
mod learner_bookmark;
mod learner_bookmark_map;
mod learner_check_in;
mod learner_competence;
mod learner_desk_planning;
mod learner_desk_search;
mod learner_group;
mod learner_item_grant;
mod learner_item_obstacle;
mod learner_journal;
mod learner_journal_export;
mod learner_journal_feedback;
mod learner_journal_page;
mod learner_language_preference;
mod learner_node_tool;
mod learner_npc_dialogue;
mod learner_obstacle_tool;
mod learner_paths;
mod learner_peer_message;
mod learner_playback;
mod learner_portal;
mod learner_question;
mod learner_recall;
mod learner_recall_run;
mod learner_reflection;
mod learner_revisit_invitation;
mod learner_revisit_run;
mod learner_route_run;
mod learner_shared_task;
mod learner_sound_preference;
mod learner_support;
mod learner_tool_grant;
mod learner_topic_detail;
mod learner_topics;
mod learner_world;
mod learning_support_moderation;
mod login_rate_limit;
pub mod media_store;
mod organization;
mod organization_icon;
mod organization_icon_moderation;
mod passwords;
mod platform_feedback;
mod platform_feedback_review;
mod public_map_assets;
mod public_pages;
mod public_presentation;
mod public_routes;
mod public_search;
mod public_source_links;
mod public_world;
mod registration_tokens;
mod security_access_audit;
mod session_commands;
mod session_status;
mod temporary_access_login;
mod totp_crypto;

use std::{process::ExitCode, time::Duration};

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::{HeaderName, Method},
    response::IntoResponse,
    routing::{delete, get, patch, post},
};
use axum_login::AuthManagerLayerBuilder;
use serde::Serialize;
use sqlx::{PgPool, postgres::PgPoolOptions};
use tower::ServiceBuilder;
use tower_governor::{GovernorLayer, governor::GovernorConfigBuilder};
use tower_http::{
    limit::RequestBodyLimitLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};
use tower_sessions::SessionManagerLayer;
use tower_sessions_sqlx_store::PostgresStore;
use tracing::{error, info};
use url::Url;
use webauthn_rs::prelude::{Webauthn, WebauthnBuilder};

use crate::{
    config::{BootstrapAdminConfig, Config, RegistrationTokenConfig},
    error::ApiError,
    identity::IdentityBackend,
    media_store::MediaStore,
};
use wicked_learning_application::organization_leadership_rotation::RotateDueRandomOrganizationLeaders;
use wicked_learning_persistence::organization_leadership_rotation::PostgresOrganizationLeadershipRotationRepository;

static APPLICATION_MIGRATOR: sqlx::migrate::Migrator =
    sqlx::migrate!("../../migrations/application");
static IDENTITY_MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("../../migrations/identity");

const REQUEST_ID_HEADER: HeaderName = HeaderName::from_static("x-request-id");

#[derive(Clone)]
pub(crate) struct AppState {
    application_database: PgPool,
    csrf_cookie_key: String,
    identity_database: PgPool,
    media_store: MediaStore,
    public_origin: String,
    session_cookie_secure: bool,
    totp_secret_cipher: totp_crypto::TotpSecretCipher,
    webauthn: Webauthn,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
}

#[tokio::main]
async fn main() -> ExitCode {
    configure_logging();

    let configuration = match Config::from_environment() {
        Ok(configuration) => configuration,
        Err(error) => {
            error!(%error, "invalid application configuration");
            return ExitCode::FAILURE;
        }
    };

    match std::env::args().nth(1).as_deref() {
        Some("migrate") => return run_migrations(&configuration).await,
        Some("bootstrap-admin") => return bootstrap_admin(&configuration).await,
        Some("issue-registration-token") => return issue_registration_token(&configuration).await,
        Some("rotate-random-organization-leaders") => {
            return rotate_random_organization_leaders(&configuration).await;
        }
        Some(command) => {
            error!(%command, "unknown command");
            return ExitCode::FAILURE;
        }
        None => {}
    }

    let application_database = match connect(&configuration.application_database_url).await {
        Ok(pool) => pool,
        Err(error) => {
            error!(%error, "could not connect to the application database");
            return ExitCode::FAILURE;
        }
    };
    let identity_database = match connect(&configuration.identity_database_url).await {
        Ok(pool) => pool,
        Err(error) => {
            error!(%error, "could not connect to the identity database");
            return ExitCode::FAILURE;
        }
    };
    let media_store = match MediaStore::from_mounted_volume(&configuration.media_root) {
        Ok(media_store) => media_store,
        Err(error) => {
            error!(%error, media_root = %configuration.media_root.display(), "could not initialize media store");
            return ExitCode::FAILURE;
        }
    };
    let webauthn = match configure_webauthn(&configuration.public_origin) {
        Ok(webauthn) => webauthn,
        Err(error) => {
            error!(%error, "could not configure passkey relying party");
            return ExitCode::FAILURE;
        }
    };

    let state = AppState {
        application_database,
        csrf_cookie_key: configuration.csrf_cookie_key,
        identity_database,
        media_store,
        public_origin: configuration.public_origin,
        session_cookie_secure: configuration.session_cookie_secure,
        totp_secret_cipher: totp_crypto::TotpSecretCipher::new(configuration.totp_encryption_key),
        webauthn,
    };
    spawn_security_audit_delivery(state.clone());
    let listener = match tokio::net::TcpListener::bind(configuration.listen_address).await {
        Ok(listener) => listener,
        Err(error) => {
            error!(%error, "could not bind API listener");
            return ExitCode::FAILURE;
        }
    };

    info!(address = %configuration.listen_address, media_root = %configuration.media_root.display(), "starting API server");
    if let Err(error) = axum::serve(listener, router(state)).await {
        error!(%error, "API server stopped unexpectedly");
        return ExitCode::FAILURE;
    }

    ExitCode::SUCCESS
}

fn configure_webauthn(public_origin: &str) -> Result<Webauthn, &'static str> {
    let origin = Url::parse(public_origin).map_err(|_| "PUBLIC_ORIGIN is not a URL")?;
    let rp_id = origin.host_str().ok_or("PUBLIC_ORIGIN has no hostname")?;
    WebauthnBuilder::new(rp_id, &origin)
        .map_err(|_| "PUBLIC_ORIGIN cannot be used as a WebAuthn relying-party origin")?
        .rp_name("Wicked Learning")
        .build()
        .map_err(|_| "WebAuthn relying-party configuration is invalid")
}

fn spawn_security_audit_delivery(state: AppState) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            if let Err(error) = security_access_audit::deliver_pending(
                &state.identity_database,
                &state.application_database,
            )
            .await
            {
                error!(%error, "could not deliver pending security access audit events");
            }
        }
    });
}

async fn rotate_random_organization_leaders(configuration: &Config) -> ExitCode {
    let application_database = match connect(&configuration.application_database_url).await {
        Ok(pool) => pool,
        Err(error) => {
            error!(%error, "could not connect to the application database for organization rotation");
            return ExitCode::FAILURE;
        }
    };
    let repository = PostgresOrganizationLeadershipRotationRepository::new(&application_database);
    match RotateDueRandomOrganizationLeaders::new(&repository)
        .execute()
        .await
    {
        Ok(rotated) => {
            info!(rotated, "random organization leadership rotation completed");
            ExitCode::SUCCESS
        }
        Err(_) => {
            error!("random organization leadership rotation failed");
            ExitCode::FAILURE
        }
    }
}

async fn issue_registration_token(configuration: &Config) -> ExitCode {
    let token_configuration = match RegistrationTokenConfig::from_environment() {
        Ok(token_configuration) => token_configuration,
        Err(error) => {
            error!(%error, "invalid issue-registration-token configuration");
            return ExitCode::FAILURE;
        }
    };
    let identity_database = match connect(&configuration.identity_database_url).await {
        Ok(pool) => pool,
        Err(error) => {
            error!(%error, "could not connect to the identity database for registration token issuance");
            return ExitCode::FAILURE;
        }
    };

    match registration_tokens::issue(identity_database, token_configuration).await {
        Ok(()) => {
            info!("registration token issued to the selected private output file");
            ExitCode::SUCCESS
        }
        Err(error) => {
            error!(%error, "registration token issuance failed");
            ExitCode::FAILURE
        }
    }
}

async fn bootstrap_admin(configuration: &Config) -> ExitCode {
    let bootstrap = match BootstrapAdminConfig::from_environment() {
        Ok(bootstrap) => bootstrap,
        Err(error) => {
            error!(%error, "invalid bootstrap-admin configuration");
            return ExitCode::FAILURE;
        }
    };
    let application_database = match connect(&configuration.application_database_url).await {
        Ok(pool) => pool,
        Err(error) => {
            error!(%error, "could not connect to the application database for bootstrap");
            return ExitCode::FAILURE;
        }
    };
    let identity_database = match connect(&configuration.identity_database_url).await {
        Ok(pool) => pool,
        Err(error) => {
            error!(%error, "could not connect to the identity database for bootstrap");
            return ExitCode::FAILURE;
        }
    };

    match bootstrap::create_administrator(application_database, identity_database, bootstrap).await
    {
        Ok(()) => {
            info!("administrator bootstrap completed");
            ExitCode::SUCCESS
        }
        Err(error) => {
            error!(%error, "administrator bootstrap failed");
            ExitCode::FAILURE
        }
    }
}

fn router(state: AppState) -> Router {
    let identity_backend = IdentityBackend::new(state.identity_database.clone());
    let session_store = PostgresStore::new(state.identity_database.clone());
    let session_layer = SessionManagerLayer::new(session_store)
        .with_name("wicked_learning_session")
        .with_secure(state.session_cookie_secure);
    let auth_layer = AuthManagerLayerBuilder::new(identity_backend, session_layer).build();
    let csrf_layer = csrf::layer(&state.csrf_cookie_key, state.session_cookie_secure);
    let mut login_rate_limit = GovernorConfigBuilder::default();
    login_rate_limit
        .per_second(60)
        .burst_size(5)
        .methods(vec![Method::POST]);
    let login_rate_limit = login_rate_limit
        .key_extractor(login_rate_limit::TrustedProxyClientIp)
        .finish()
        .expect("a non-zero login rate limit is configured");
    let mut two_factor_rate_limit = GovernorConfigBuilder::default();
    two_factor_rate_limit
        .per_second(60)
        .burst_size(5)
        .methods(vec![Method::POST]);
    let two_factor_rate_limit = two_factor_rate_limit
        .key_extractor(login_rate_limit::TrustedProxyClientIp)
        .finish()
        .expect("a non-zero two-factor rate limit is configured");
    let mut passkey_rate_limit = GovernorConfigBuilder::default();
    passkey_rate_limit
        .per_second(60)
        .burst_size(10)
        .methods(vec![Method::POST]);
    let passkey_rate_limit = passkey_rate_limit
        .key_extractor(login_rate_limit::TrustedProxyClientIp)
        .finish()
        .expect("a non-zero passkey rate limit is configured");
    let login_routes = Router::new()
        .route("/api/v1/session/login", post(session_commands::login))
        .route(
            "/api/v1/registration",
            post(identity_registration::register),
        )
        .layer(
            GovernorLayer::new(login_rate_limit)
                .error_handler(|_| ApiError::too_many_requests().into_response()),
        );
    let two_factor_routes = Router::new()
        .route(
            "/api/v1/session/two-factor",
            post(session_commands::complete_two_factor),
        )
        .route(
            "/api/v1/account/two-factor/setup",
            post(account_two_factor::start_setup),
        )
        .route(
            "/api/v1/account/two-factor/confirm",
            post(account_two_factor::confirm_setup),
        )
        .route(
            "/api/v1/account/two-factor/recovery-codes",
            get(account_two_factor::recovery_codes)
                .post(account_two_factor::regenerate_recovery_codes),
        )
        .route(
            "/api/v1/account/two-factor",
            get(account_two_factor::status).delete(account_two_factor::disable),
        )
        .layer(
            GovernorLayer::new(two_factor_rate_limit)
                .error_handler(|_| ApiError::too_many_requests().into_response()),
        );
    let passkey_routes = Router::new()
        .route(
            "/api/v1/session/passkey/options",
            post(account_passkey::login_options),
        )
        .route("/api/v1/session/passkey", post(account_passkey::login))
        .route(
            "/api/v1/account/passkeys/confirmation/options",
            post(account_passkey::confirmation_options),
        )
        .route(
            "/api/v1/account/passkeys/confirmation",
            post(account_passkey::confirm),
        )
        .route(
            "/api/v1/account/passkeys/options",
            post(account_passkey::registration_options),
        )
        .route(
            "/api/v1/account/passkeys",
            get(account_passkey::list).post(account_passkey::register),
        )
        .route(
            "/api/v1/account/passkeys/{passkey_id}",
            delete(account_passkey::delete),
        )
        .layer(
            GovernorLayer::new(passkey_rate_limit)
                .error_handler(|_| ApiError::too_many_requests().into_response()),
        );

    Router::new()
        .merge(login_routes)
        .merge(two_factor_routes)
        .merge(passkey_routes)
        .route("/api/v1/health/live", get(live))
        .route("/api/v1/health/ready", get(ready))
        .route("/api/v1/security/csrf", get(csrf::show))
        .route("/api/v1/me", get(current_user::show))
        .route(
            "/api/v1/account/password/confirmation",
            get(account_password_confirmation::status)
                .post(account_password_confirmation::confirm),
        )
        .route("/api/v1/account/password", patch(account_password::update))
        .route(
            "/api/v1/account/profile",
            get(account_profile::show).patch(account_profile::update),
        )
        .route(
            "/api/v1/account/profile/image",
            post(account_profile_image::upload)
                .layer(DefaultBodyLimit::max(account_profile_image::MAX_PROFILE_IMAGE_BYTES + 16 * 1024)),
        )
        .route(
            "/api/v1/profile-images/{profile_image_id}",
            get(account_profile_image::show),
        )
        .route("/api/v1/platform-feedback", post(platform_feedback::submit))
        .route("/api/v1/admin/platform-feedback", get(platform_feedback_review::index))
        .route("/api/v1/admin/platform-feedback/{feedback_id}/review", patch(platform_feedback_review::mark_reviewed))
        .route("/api/v1/learner/feedback-prompt-preference", get(feedback_prompt_preference::show).patch(feedback_prompt_preference::update))
        .route("/api/v1/admin/learning-groups", get(admin_learning_group::index).post(admin_learning_group::create))
        .route("/api/v1/admin/users", get(admin_user::index))
        .route(
            "/api/v1/admin/users/{subject_id}/access",
            patch(admin_user::update_access),
        )
        .route(
            "/api/v1/admin/users/{subject_id}",
            delete(admin_user::destroy),
        )
        .route("/api/v1/admin/roles", get(admin_role::index).post(admin_role::create))
        .route(
            "/api/v1/admin/roles/{role_key}",
            patch(admin_role::update).delete(admin_role::destroy),
        )
        .route("/api/v1/admin/access-links", get(access_link::index).post(access_link::create))
        .route("/api/v1/registration-tokens", post(admin_registration_tokens::create))
        .route("/api/v1/admin/access-links/{link_id}", patch(access_link::set_enabled))
        .route(
            "/api/v1/admin/learning-groups/{group_id}",
            patch(admin_learning_group::update),
        )
        .route(
            "/api/v1/admin/learning-groups/{group_id}/members",
            patch(admin_learning_group::sync_members),
        )
        .route("/api/v1/learner/world", get(learner_world::show))
        .route("/api/v1/learner/groups", get(learner_group::index))
        .route("/api/v1/organizations", get(organization::index).post(organization::create))
        .route("/api/v1/organizations/{slug}", get(organization::show).patch(organization::update).delete(organization::delete))
        .route("/api/v1/organizations/{slug}/icon", post(organization_icon::upload).layer(DefaultBodyLimit::max(image_upload::MAX_IMAGE_BYTES + 16 * 1024)))
        .route("/api/v1/organizations/{slug}/icon-reports", post(organization_icon::report))
        .route("/api/v1/organization-icons/{icon_id}", get(organization_icon::show))
        .route("/api/v1/admin/organization-icon-reports", get(organization_icon_moderation::index))
        .route("/api/v1/admin/organization-icon-reports/{report_id}", patch(organization_icon_moderation::resolve))
        .route("/api/v1/admin/organization-icon-reports/{report_id}/icon", get(organization_icon_moderation::show_icon))
        .route("/api/v1/admin/organization-policy", patch(organization_icon_moderation::update_policy))
        .route("/api/v1/organizations/{slug}/join-requests", post(organization::request_join))
        .route("/api/v1/organizations/{slug}/membership", delete(organization::leave))
        .route("/api/v1/organizations/{slug}/messages", post(organization::send_message))
        .route("/api/v1/organization-join-requests/{request_id}", patch(organization::respond_to_join_request))
        .route("/api/v1/organization-memberships/{membership_id}/leader", patch(organization::promote_member))
        .route("/api/v1/organization-memberships/{membership_id}", delete(organization::remove_member))
        .route("/api/v1/organization-messages/{message_id}", delete(organization::delete_message))
        .route("/api/v1/organization-messages/{message_id}/hide", patch(organization::hide_message))
        .route(
            "/api/v1/learner/groups/{group_id}/messages",
            post(learner_group::send_message),
        )
        .route(
            "/api/v1/learner/groups/{group_id}/messages/{message_id}/resolve",
            post(learner_group::resolve_help_request),
        )
        .route(
            "/api/v1/learner/groups/{group_id}/admin-chat-vote",
            post(learner_group::vote_for_admin_chat_access),
        )
        .route("/api/v1/access-links/{token}/redeem", post(access_link::redeem))
        .route("/api/v1/access-links/{token}/temporary-login", post(temporary_access_login::login))
        .route("/api/v1/access-links/{token}", get(access_link::preview))
        .route(
            "/api/v1/learner/bookmarks",
            get(learner_bookmark_map::show),
        )
        .route(
            "/api/v1/learner/competence",
            get(learner_competence::show),
        )
        .route("/api/v1/learner/topics", get(learner_topics::index))
        .route("/api/v1/learner/paths", get(learner_paths::index))
        .route(
            "/api/v1/learner/topics/{topic_slug}/overview",
            get(learner_topic_detail::overview),
        )
        .route(
            "/api/v1/learner/topics/{topic_slug}/trail",
            get(learner_topic_detail::trail),
        )
        .route(
            "/api/v1/learner/topics/{topic_slug}/maps",
            get(learner_topic_detail::maps),
        )
        .route(
            "/api/v1/learner/maps/{map_slug}/nodes/{node_slug}/bookmark",
            post(learner_bookmark::create).delete(learner_bookmark::delete),
        )
        .route(
            "/api/v1/learner/maps/{map_slug}/nodes/{node_slug}/use-tool",
            post(learner_node_tool::use_on_node),
        )
        .route("/api/v1/learner/journal", get(learner_journal::index))
        .route(
            "/api/v1/learner/journal/export",
            get(learner_journal_export::download),
        )
        .route(
            "/api/v1/learner/journal/pages/{page_id}/feedback-request",
            post(learner_journal_feedback::request),
        )
        .route(
            "/api/v1/admin/journal-feedback/policy",
            get(journal_feedback_review::policy).patch(journal_feedback_review::update_policy),
        )
        .route(
            "/api/v1/admin/journal-feedback",
            get(journal_feedback_review::index),
        )
        .route(
            "/api/v1/admin/journal-feedback/{request_id}/respond",
            post(journal_feedback_review::respond),
        )
        .route(
            "/api/v1/learner/appearance",
            patch(learner_appearance_preference::update),
        )
        .route(
            "/api/v1/learner/language-preference",
            get(learner_language_preference::show).patch(learner_language_preference::update),
        )
        .route(
            "/api/v1/learner/desk-planning-preference",
            get(learner_desk_planning::show).patch(learner_desk_planning::update),
        )
        .route(
            "/api/v1/learner/sound-preferences",
            get(learner_sound_preference::show).patch(learner_sound_preference::update),
        )
        .route("/api/v1/learner/search", get(learner_desk_search::index))
        .route(
            "/api/v1/learner/desk/support-responses",
            get(learner_support::desk_responses),
        )
        .route(
            "/api/v1/learning-support/topics",
            get(learning_support_moderation::topics),
        )
        .route(
            "/api/v1/learning-support/topics/{topic_id}/requests",
            get(learning_support_moderation::requests),
        )
        .route(
            "/api/v1/learning-support/topics/{topic_id}/messages",
            get(learning_support_moderation::messages),
        )
        .route(
            "/api/v1/learning-support/messages/{message_id}/responses",
            get(learning_support_moderation::message_responses)
                .post(learning_support_moderation::save_reply),
        )
        .route(
            "/api/v1/learning-support/messages/{message_id}/visibility",
            patch(learning_support_moderation::set_message_visibility),
        )
        .route(
            "/api/v1/learning-support/responses/{response_id}/visibility",
            patch(learning_support_moderation::set_reply_visibility),
        )
        .route(
            "/api/v1/learning-support/messages/{message_id}",
            delete(learning_support_moderation::delete_message),
        )
        .route(
            "/api/v1/learning-support/responses/{response_id}",
            delete(learning_support_moderation::delete_reply),
        )
        .route("/api/v1/learner/recall-items", get(learner_recall::index))
        .route(
            "/api/v1/learner/activities/{activity_slug}/replay",
            post(learner_activity_replay_run::open_or_resume),
        )
        .route(
            "/api/v1/learner/recall-items/{recall_item_id}",
            post(learner_recall::postpone).delete(learner_recall::remove),
        )
        .route(
            "/api/v1/learner/recall-items/{recall_item_id}/open",
            post(learner_recall_run::open_or_resume),
        )
        .route(
            "/api/v1/learner/revisit-invitations/{check_in_id}",
            post(learner_revisit_invitation::update),
        )
        .route(
            "/api/v1/learner/revisit-invitations/{check_in_id}/open",
            post(learner_revisit_run::open_or_resume),
        )
        .route(
            "/api/v1/learner/journal/pages",
            post(learner_journal_page::create),
        )
        .route(
            "/api/v1/learner/journal/pages/{page_id}",
            patch(learner_journal_page::update).delete(learner_journal_page::delete),
        )
        .route(
            "/api/v1/learner/activity-starts/{start_id}/start",
            post(learner_route_run::start_or_resume),
        )
        .route(
            "/api/v1/learner/activity-starts/{start_id}/reset",
            post(learner_route_run::reset),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}",
            get(learner_playback::show),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/support-request",
            get(learner_support::show_current_request).post(learner_support::submit_current_request),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/peer-message",
            get(learner_peer_message::prompt).post(learner_peer_message::contribute),
        )
        .route("/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/peer-wall", get(learner_peer_message::wall))
        .route("/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/peer-wall/messages/{message_id}/responses", post(learner_peer_message::respond))
        .route("/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/peer-wall/messages/{message_id}/responses/{response_id}/helpfulness", patch(learner_peer_message::helpful))
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/submissions",
            post(learner_shared_task::submit_contribution),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/submissions/{submission_id}/revision",
            patch(learner_shared_task::revise_contribution),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/reviews",
            post(learner_shared_task::submit_review),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/reviews/{review_id}/helpfulness",
            patch(learner_shared_task::update_helpfulness),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/reviews/{review_id}/follow-up",
            patch(learner_shared_task::save_follow_up),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/checklist",
            post(learner_shared_task::save_checklist),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/complete",
            post(learner_playback::complete_current_activity),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/portal/travel",
            post(learner_portal::travel),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/grant-tool",
            post(learner_tool_grant::grant_current_tool),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/continue",
            post(learner_npc_dialogue::continue_dialogue),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/answer",
            post(learner_npc_dialogue::answer),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/back",
            post(learner_npc_dialogue::go_back),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/reflection",
            post(learner_npc_dialogue::save_reflection),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/grant-items",
            post(learner_item_grant::roll_current_items),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/item-obstacle-slots/{slot_index}",
            post(learner_item_obstacle::place_item),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/item-obstacle/continue",
            post(learner_item_obstacle::continue_obstacle),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/use-obstacle-tool",
            post(learner_obstacle_tool::use_tool),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/check-ins",
            post(learner_check_in::record),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/answer",
            post(learner_question::answer),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/recall",
            post(learner_recall::queue_current_question),
        )
        .route(
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/reflection",
            post(learner_reflection::save),
        )
        .route("/api/v1/session", get(session_status::show))
        .route("/api/v1/session/logout", post(session_commands::logout))
        .route("/api/v1/public/pages/{slug}", get(public_pages::show))
        .route(
            "/api/v1/public/presentation",
            get(public_presentation::show),
        )
        .route(
            "/api/v1/public/source-links",
            get(public_source_links::index),
        )
        .route("/api/v1/public/search", get(public_search::index))
        .route("/api/v1/public/world", get(public_world::show))
        .route(
            "/api/v1/public/worlds/{world_slug}/maps/{map_slug}/assets/{asset_slug}",
            get(public_map_assets::show),
        )
        .route(
            "/api/v1/public/worlds/{world_slug}/maps/{map_slug}/assets/{asset_slug}/routes/{route_slug}",
            get(public_routes::show),
        )
        .with_state(state)
        .layer(csrf_layer)
        .layer(auth_layer)
        .layer(
            ServiceBuilder::new()
                .layer(SetRequestIdLayer::new(REQUEST_ID_HEADER, MakeRequestUuid))
                .layer(TraceLayer::new_for_http())
                .layer(PropagateRequestIdLayer::new(REQUEST_ID_HEADER))
                .layer(RequestBodyLimitLayer::new(account_profile_image::MAX_PROFILE_IMAGE_BYTES + 16 * 1024))
                .layer(TimeoutLayer::with_status_code(
                    axum::http::StatusCode::REQUEST_TIMEOUT,
                    Duration::from_secs(10),
                )),
        )
}

async fn live() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

async fn ready(State(state): State<AppState>) -> Result<Json<HealthResponse>, ApiError> {
    sqlx::query("SELECT 1")
        .execute(&state.application_database)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    state
        .media_store
        .check_readiness()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    sqlx::query("SELECT 1")
        .execute(&state.identity_database)
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(HealthResponse { status: "ok" }))
}

async fn connect(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(5))
        .connect(database_url)
        .await
}

async fn run_migrations(configuration: &Config) -> ExitCode {
    let application_database = match PgPoolOptions::new()
        .max_connections(1)
        .connect(&configuration.application_database_url)
        .await
    {
        Ok(pool) => pool,
        Err(error) => {
            error!(%error, "could not connect to the application database for migrations");
            return ExitCode::FAILURE;
        }
    };
    let identity_database = match PgPoolOptions::new()
        .max_connections(1)
        .connect(&configuration.identity_database_url)
        .await
    {
        Ok(pool) => pool,
        Err(error) => {
            error!(%error, "could not connect to the identity database for migrations");
            return ExitCode::FAILURE;
        }
    };

    if let Err(error) = IDENTITY_MIGRATOR.run(&identity_database).await {
        error!(%error, "identity migrations failed");
        return ExitCode::FAILURE;
    }
    if let Err(error) = PostgresStore::new(identity_database.clone())
        .migrate()
        .await
    {
        error!(%error, "identity session-store migration failed");
        return ExitCode::FAILURE;
    }
    if let Err(error) = APPLICATION_MIGRATOR.run(&application_database).await {
        error!(%error, "application migrations failed");
        return ExitCode::FAILURE;
    }

    info!("both database migration sets completed");
    ExitCode::SUCCESS
}

fn configure_logging() {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info,warn".to_owned()))
        .with_target(false)
        .compact()
        .init();
}

#[cfg(test)]
mod tests {
    use axum::{body::Body, http::Request};
    use http_body_util::BodyExt;
    use sqlx::postgres::PgPoolOptions;
    use tower::ServiceExt;

    use super::{AppState, configure_webauthn, router};

    fn test_webauthn() -> webauthn_rs::prelude::Webauthn {
        configure_webauthn("http://localhost:8081").expect("a valid local WebAuthn configuration")
    }

    #[tokio::test]
    async fn liveness_does_not_depend_on_a_database_connection() {
        let state = AppState {
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            webauthn: test_webauthn(),
        };

        let response = router(state)
            .oneshot(
                Request::builder()
                    .uri("/api/v1/health/live")
                    .body(Body::empty())
                    .expect("a valid HTTP request"),
            )
            .await
            .expect("liveness handler response");

        assert_eq!(response.status(), 200);
        assert!(response.headers().contains_key("x-request-id"));
        assert_eq!(
            response
                .into_body()
                .collect()
                .await
                .expect("body bytes")
                .to_bytes(),
            "{\"status\":\"ok\"}"
        );
    }

    #[tokio::test]
    async fn anonymous_session_status_is_safe_and_does_not_query_a_database() {
        let state = AppState {
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            webauthn: test_webauthn(),
        };

        let response = router(state)
            .oneshot(
                Request::builder()
                    .uri("/api/v1/session")
                    .body(Body::empty())
                    .expect("a valid HTTP request"),
            )
            .await
            .expect("anonymous session response");

        assert_eq!(response.status(), 200);
        assert_eq!(
            response
                .into_body()
                .collect()
                .await
                .expect("body bytes")
                .to_bytes(),
            "{\"authenticated\":false,\"subject_id\":null,\"two_factor_required\":false}"
        );
    }

    #[tokio::test]
    async fn current_user_requires_an_authenticated_session() {
        let state = AppState {
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            webauthn: test_webauthn(),
        };

        let response = router(state)
            .oneshot(
                Request::builder()
                    .uri("/api/v1/me")
                    .body(Body::empty())
                    .expect("a valid current-user request"),
            )
            .await
            .expect("current-user response");

        assert_eq!(response.status(), 401);
        assert_eq!(
            response
                .into_body()
                .collect()
                .await
                .expect("body bytes")
                .to_bytes(),
            "{\"code\":\"authentication_required\",\"title\":\"Authentication is required.\"}"
        );
    }

    #[tokio::test]
    async fn learner_world_requires_an_authenticated_session() {
        let state = AppState {
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            webauthn: test_webauthn(),
        };

        let response = router(state)
            .oneshot(
                Request::builder()
                    .uri("/api/v1/learner/world")
                    .body(Body::empty())
                    .expect("a valid learner-world request"),
            )
            .await
            .expect("learner-world response");

        assert_eq!(response.status(), 401);
        assert_eq!(
            response
                .into_body()
                .collect()
                .await
                .expect("body bytes")
                .to_bytes(),
            "{\"code\":\"authentication_required\",\"title\":\"Authentication is required.\"}"
        );
    }

    #[tokio::test]
    async fn learner_journal_export_requires_an_authenticated_session() {
        let state = AppState {
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            webauthn: test_webauthn(),
        };

        let response = router(state)
            .oneshot(
                Request::builder()
                    .uri("/api/v1/learner/journal/export")
                    .body(Body::empty())
                    .expect("a valid learner-journal-export request"),
            )
            .await
            .expect("learner-journal-export response");

        assert_eq!(response.status(), 401);
        assert_eq!(
            response
                .into_body()
                .collect()
                .await
                .expect("body bytes")
                .to_bytes(),
            "{\"code\":\"authentication_required\",\"title\":\"Authentication is required.\"}"
        );
    }

    #[tokio::test]
    async fn csrf_token_uses_a_non_cacheable_http_only_cookie() {
        let state = AppState {
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            webauthn: test_webauthn(),
        };

        let response = router(state)
            .oneshot(
                Request::builder()
                    .uri("/api/v1/security/csrf")
                    .body(Body::empty())
                    .expect("a valid HTTP request"),
            )
            .await
            .expect("CSRF token response");

        assert_eq!(response.status(), 200);
        assert_eq!(response.headers().get("cache-control").unwrap(), "no-store");
        let cookie = response
            .headers()
            .get("set-cookie")
            .unwrap()
            .to_str()
            .unwrap();
        assert!(cookie.starts_with("wicked_learning_csrf="));
        assert!(cookie.contains("HttpOnly"));
        assert!(cookie.contains("SameSite=Strict"));
        assert!(!cookie.contains("Secure"));
    }

    #[tokio::test]
    async fn login_is_rate_limited_before_identity_lookup() {
        let state = AppState {
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            webauthn: test_webauthn(),
        };
        let app = router(state);

        for _ in 0..5 {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/v1/session/login")
                        .header("content-type", "application/json")
                        .header("origin", "http://localhost:8081")
                        .header("x-real-ip", "203.0.113.10")
                        .body(Body::from(
                            r#"{"email":"nobody@example.test","password":"not-a-real-password"}"#,
                        ))
                        .expect("a valid login request"),
                )
                .await
                .expect("login response");

            assert_eq!(response.status(), 403);
        }

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/session/login")
                    .header("content-type", "application/json")
                    .header("origin", "http://localhost:8081")
                    .header("x-real-ip", "203.0.113.10")
                    .body(Body::from(
                        r#"{"email":"nobody@example.test","password":"not-a-real-password"}"#,
                    ))
                    .expect("a valid login request"),
            )
            .await
            .expect("rate-limited login response");

        assert_eq!(response.status(), 429);
    }

    #[tokio::test]
    async fn login_rejects_an_untrusted_origin_before_identity_lookup() {
        let state = AppState {
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            webauthn: test_webauthn(),
        };

        let response = router(state)
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/session/login")
                    .header("content-type", "application/json")
                    .header("origin", "https://untrusted.example")
                    .header("x-real-ip", "203.0.113.11")
                    .body(Body::from(
                        r#"{"email":"nobody@example.test","password":"not-a-real-password"}"#,
                    ))
                    .expect("a valid login request"),
            )
            .await
            .expect("untrusted-origin login response");

        assert_eq!(response.status(), 403);
    }
}
