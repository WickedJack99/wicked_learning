#![recursion_limit = "256"]

mod access_link;
mod account_deletion;
mod account_passkey;
mod account_password;
mod account_password_confirmation;
mod account_profile;
mod account_profile_image;
mod account_two_factor;
mod admin_activity_ambient_sound;
mod admin_activity_completion_choice;
mod admin_activity_evidence_context;
mod admin_activity_feedback_guidance;
mod admin_activity_learning_design;
mod admin_activity_source_references;
mod admin_activity_templates;
mod admin_ai_content_authoring;
mod admin_ai_settings;
mod admin_ai_template_test;
mod admin_asset_catalog;
mod admin_dialogue_typing_sound_set;
mod admin_learning_companion;
mod admin_learning_companion_dialogue;
mod admin_learning_group;
mod admin_learning_support_signals;
mod admin_learning_taxonomy;
mod admin_media_assets;
mod admin_public_content;
mod admin_public_presentation;
mod admin_registration_tokens;
mod admin_role;
mod admin_sound;
mod admin_source_records;
mod admin_topics;
mod admin_translation_catalog;
mod admin_user;
mod admin_world_activity_ai_review;
mod admin_world_activity_delete;
mod admin_world_activity_history;
mod admin_world_activity_position;
mod admin_world_details;
mod admin_world_export;
mod admin_world_graph;
mod admin_world_import;
mod admin_world_item_grant;
mod admin_world_item_obstacle;
mod admin_world_map;
mod admin_world_map_access;
mod admin_world_map_asset;
mod admin_world_map_asset_export;
mod admin_world_map_asset_import;
mod admin_world_map_create;
mod admin_world_map_delete;
mod admin_world_map_details;
mod admin_world_map_duplicate;
mod admin_world_map_editing_groups;
mod admin_world_map_export;
mod admin_world_map_export_preflight;
mod admin_world_map_import;
mod admin_world_map_layout;
mod admin_world_map_visuals;
mod admin_world_markdown;
mod admin_world_message;
mod admin_world_node;
mod admin_world_node_layout;
mod admin_world_node_manual_unlock;
mod admin_world_node_starts;
mod admin_world_node_transition;
mod admin_world_node_unlock;
mod admin_world_npc_dialogue;
mod admin_world_obstacle;
mod admin_world_open_practice;
mod admin_world_portal;
mod admin_world_portal_link;
mod admin_world_question;
mod admin_world_reflection;
mod admin_world_review;
mod admin_world_review_queue;
mod admin_world_shared_task;
mod admin_world_tool_grant;
mod ai_credential_crypto;
mod ai_provider;
mod audio_upload;
mod bootstrap;
mod config;
mod content_api;
mod csrf;
mod current_user;
mod email_delivery;
mod error;
mod feedback_prompt_preference;
mod identity;
mod identity_registration;
mod image_upload;
mod journal_feedback_review;
mod learner_activity_replay_run;
mod learner_activity_translation;
mod learner_appearance_preference;
mod learner_bookmark;
mod learner_bookmark_map;
mod learner_check_in;
mod learner_companion;
mod learner_companion_turn;
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
mod learner_media_assets;
mod learner_node_tool;
mod learner_npc_dialogue;
mod learner_obstacle_tool;
mod learner_paths;
mod learner_peer_message;
mod learner_platform_translation;
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
mod observability;
mod organization;
mod organization_icon;
mod organization_icon_moderation;
mod password_recovery;
mod passwords;
mod platform_feedback;
mod platform_feedback_review;
mod public_map_assets;
mod public_media_assets;
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
mod world_transfer_package;

use std::{process::ExitCode, time::Duration};

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::{HeaderName, Method},
    middleware,
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
    ai_credential_cipher: ai_credential_crypto::AiCredentialCipher,
    application_database: PgPool,
    csrf_cookie_key: String,
    identity_database: PgPool,
    login_rate_limit_key: [u8; 32],
    media_store: MediaStore,
    email_delivery: email_delivery::EmailDelivery,
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
        Some("reconcile-identity-deletions") => {
            return reconcile_identity_deletions(&configuration).await;
        }
        Some(command) => {
            error!(%command, "unknown command");
            return ExitCode::FAILURE;
        }
        None => {}
    }

    if let Err(error) = observability::initialize() {
        error!(%error, "could not initialize metrics");
        return ExitCode::FAILURE;
    }
    observability::spawn_upkeep();

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
    let email_delivery = match email_delivery::EmailDelivery::new(
        &configuration.email,
        &configuration.public_origin,
    ) {
        Ok(email_delivery) => email_delivery,
        Err(error) => {
            error!(%error, "could not configure email delivery");
            return ExitCode::FAILURE;
        }
    };

    let state = AppState {
        ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
            configuration.ai_credential_encryption_key,
        ),
        application_database,
        csrf_cookie_key: configuration.csrf_cookie_key,
        identity_database,
        login_rate_limit_key: configuration.login_rate_limit_key,
        media_store,
        email_delivery,
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

async fn reconcile_identity_deletions(configuration: &Config) -> ExitCode {
    let application_database = match connect(&configuration.application_database_url).await {
        Ok(pool) => pool,
        Err(error) => {
            error!(%error, "could not connect to the application database for deletion reconciliation");
            return ExitCode::FAILURE;
        }
    };
    let identity_database = match connect(&configuration.identity_database_url).await {
        Ok(pool) => pool,
        Err(error) => {
            error!(%error, "could not connect to the identity database for deletion reconciliation");
            return ExitCode::FAILURE;
        }
    };
    match wicked_learning_persistence::identity_deletion::reconcile(
        &application_database,
        &identity_database,
    )
    .await
    {
        Ok(reconciled) => {
            info!(reconciled, "identity deletion reconciliation completed");
            ExitCode::SUCCESS
        }
        Err(error) => {
            error!(%error, "identity deletion reconciliation failed");
            ExitCode::FAILURE
        }
    }
}

fn router(state: AppState) -> Router {
    let identity_backend = IdentityBackend::new(state.identity_database.clone());
    let session_store = PostgresStore::new(state.identity_database.clone());
    let session_layer = SessionManagerLayer::new(session_store)
        .with_name("wicked_learning_session")
        .with_secure(state.session_cookie_secure)
        .with_expiry(session_commands::normal_session_expiry())
        .with_always_save(true);
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
    let password_recovery_routes = Router::new()
        .route(
            "/api/v1/password/forgot",
            post(password_recovery::request_link),
        )
        .route("/api/v1/password/reset", post(password_recovery::reset));

    Router::new()
        .merge(login_routes)
        .merge(two_factor_routes)
        .merge(passkey_routes)
        .merge(password_recovery_routes)
        .route("/metrics", get(observability::scrape))
        .route("/api/v1/health/live", get(live))
        .route("/api/v1/health/ready", get(ready))
        .route("/api/content/v1/contract", get(content_api::contract))
        .route(
            "/api/content/v1/maps",
            get(content_api::maps).post(content_api::create_map),
        )
        .route(
            "/api/content/v1/maps/{map_id}",
            get(content_api::map)
                .patch(content_api::update_map)
                .delete(content_api::delete_map),
        )
        .route(
            "/api/content/v1/maps/{map_id}/map-assets",
            get(content_api::map_assets).post(content_api::create_map_asset),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}",
            patch(content_api::update_map_asset).delete(content_api::delete_map_asset),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities",
            get(content_api::activities).post(content_api::create_activity),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/reflection",
            patch(content_api::update_reflection_activity),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/review",
            patch(content_api::update_review_activity),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/open-practice",
            patch(content_api::update_open_practice_activity),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/markdown",
            patch(content_api::update_markdown_activity),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/question",
            patch(content_api::update_question_activity),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/shared-task",
            patch(content_api::update_shared_task_activity),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/item-grant",
            patch(content_api::update_item_grant_activity),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/tool-grant",
            patch(content_api::update_tool_grant_activity),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/item-obstacle",
            patch(content_api::update_item_obstacle_activity),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/obstacle",
            patch(content_api::update_obstacle_activity),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/portal",
            patch(content_api::update_portal_activity),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/message-prompt",
            patch(content_api::update_message_prompt_activity),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/message-wall",
            patch(content_api::update_message_wall_activity),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/npc-dialogue",
            get(content_api::npc_dialogue_graph),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/npc-dialogue/nodes",
            post(content_api::create_npc_dialogue_node),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/npc-dialogue/nodes/{dialogue_node_id}",
            patch(content_api::update_npc_dialogue_node)
                .delete(content_api::delete_npc_dialogue_node),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/npc-dialogue/transitions",
            post(content_api::create_npc_dialogue_transition),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/npc-dialogue/transitions/{transition_id}",
            delete(content_api::delete_npc_dialogue_transition),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activities/{activity_id}/npc-dialogue/graph-layout",
            patch(content_api::update_npc_dialogue_layout),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activity-transitions",
            get(content_api::activity_transitions).post(content_api::create_activity_transition),
        )
        .route(
            "/api/content/v1/map-assets/{map_asset_id}/activity-transitions/{transition_id}",
            patch(content_api::update_activity_transition)
                .delete(content_api::delete_activity_transition),
        )
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
            get(account_profile::show)
                .patch(account_profile::update)
                .delete(account_deletion::destroy),
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
        .route(
            "/api/v1/admin/learning-support/signals",
            get(admin_learning_support_signals::index),
        )
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
            "/api/v1/admin/learning-taxonomy",
            get(admin_learning_taxonomy::index),
        )
        .route("/api/v1/admin/ai/settings", get(admin_ai_settings::index))
        .route(
            "/api/v1/admin/ai/templates/{template_id}/test",
            post(admin_ai_template_test::create),
        )
        .route(
            "/api/v1/admin/learning-companion",
            get(admin_learning_companion::show).patch(admin_learning_companion::update),
        )
        .route(
            "/api/v1/admin/learning-companion/dialogues",
            get(admin_learning_companion_dialogue::index)
                .post(admin_learning_companion_dialogue::create),
        )
        .route(
            "/api/v1/admin/learning-companion/dialogues/{dialogue_id}",
            get(admin_learning_companion_dialogue::show)
                .patch(admin_learning_companion_dialogue::update)
                .delete(admin_learning_companion_dialogue::delete),
        )
        .route(
            "/api/v1/admin/learning-companion/dialogues/{dialogue_id}/assignments",
            get(admin_learning_companion_dialogue::assignments)
                .put(admin_learning_companion_dialogue::sync_assignments),
        )
        .route(
            "/api/v1/admin/ai/providers",
            post(admin_ai_settings::create_provider),
        )
        .route(
            "/api/v1/admin/ai/providers/{provider_id}",
            patch(admin_ai_settings::update_provider).delete(admin_ai_settings::delete_provider),
        )
        .route(
            "/api/v1/admin/ai/templates",
            post(admin_ai_settings::create_template),
        )
        .route(
            "/api/v1/admin/ai/templates/{template_id}",
            patch(admin_ai_settings::update_template).delete(admin_ai_settings::delete_template),
        )
        .route(
            "/api/v1/admin/competence-topics",
            patch(admin_learning_taxonomy::sync_competence_topics),
        )
        .route(
            "/api/v1/admin/learning-concepts",
            patch(admin_learning_taxonomy::sync_learning_concepts),
        )
        .route("/api/v1/admin/topics", get(admin_topics::index))
        .route("/api/v1/admin/topic-areas", post(admin_topics::create_area))
        .route(
            "/api/v1/admin/topic-areas/reorder",
            patch(admin_topics::reorder_areas),
        )
        .route(
            "/api/v1/admin/topic-areas/{area_id}",
            patch(admin_topics::update_area),
        )
        .route(
            "/api/v1/admin/topic-areas/{area_id}/topics",
            post(admin_topics::create_topic),
        )
        .route(
            "/api/v1/admin/topic-areas/{area_id}/topics/{topic_id}",
            patch(admin_topics::update_topic),
        )
        .route("/api/v1/admin/world-builder", get(admin_world_graph::show))
        .route(
            "/api/v1/admin/world-builder/portal-links",
            post(admin_world_portal_link::create),
        )
        .route(
            "/api/v1/admin/world-builder/portal-links/{portal_link_id}",
            delete(admin_world_portal_link::delete),
        )
        .route(
            "/api/v1/admin/world-builder/world/export",
            get(admin_world_export::export),
        )
        .route(
            "/api/v1/admin/world-builder/world/export-package",
            get(admin_world_export::export_package),
        )
        .route(
            "/api/v1/admin/world-builder/world/details",
            patch(admin_world_details::update),
        )
        .route(
            "/api/v1/admin/world-builder/world/versions",
            get(admin_world_details::versions),
        )
        .route(
            "/api/v1/admin/world-builder/world/versions/{version_id}",
            post(admin_world_details::restore),
        )
        .route(
            "/api/v1/admin/world-builder/world-exports/preflight",
            post(admin_world_import::preflight)
                .layer(DefaultBodyLimit::max(admin_world_import::MAX_WORLD_MANIFEST_BYTES)),
        )
        .route(
            "/api/v1/admin/world-builder/world-exports/import",
            post(admin_world_import::import)
                .layer(DefaultBodyLimit::max(admin_world_import::MAX_WORLD_MANIFEST_BYTES)),
        )
        .route(
            "/api/v1/admin/world-builder/review-queue",
            get(admin_world_review_queue::index),
        )
        .route(
            "/api/v1/admin/world-builder/maps",
            post(admin_world_map_create::create),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}",
            get(admin_world_map::show).delete(admin_world_map_delete::delete),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/duplicate",
            post(admin_world_map_duplicate::duplicate),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/export",
            get(admin_world_map_export::export),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/export-package",
            get(admin_world_map_export::export_package),
        )
        .route(
            "/api/v1/admin/world-builder/map-exports/preflight",
            post(admin_world_map_export_preflight::preflight)
                .layer(DefaultBodyLimit::max(admin_world_map_import::MAX_MANIFEST_BYTES)),
        )
        .route(
            "/api/v1/admin/world-builder/map-exports/import",
            post(admin_world_map_import::import)
                .layer(DefaultBodyLimit::max(admin_world_map_import::MAX_MANIFEST_BYTES)),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/details",
            patch(admin_world_map_details::update),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/visuals",
            patch(admin_world_map_visuals::update),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/layout-versions",
            get(admin_world_map_layout::versions),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/layout-versions/{version_id}/preview",
            get(admin_world_map_layout::preview),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/layout-versions/{version_id}/restore",
            post(admin_world_map_layout::restore),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/versions",
            get(admin_world_map_details::versions),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/versions/{version_id}",
            post(admin_world_map_details::restore),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/access",
            patch(admin_world_map_access::update),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/editing-groups",
            patch(admin_world_map_editing_groups::update),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/assets",
            post(admin_world_map_asset::create),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/ai-content-plans",
            post(admin_ai_content_authoring::generate),
        )
        .route(
            "/api/v1/admin/ai-content-plans/{run_id}",
            patch(admin_ai_content_authoring::update),
        )
        .route(
            "/api/v1/admin/ai-content-plans/{run_id}/apply",
            post(admin_ai_content_authoring::apply),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/nodes",
            post(admin_world_node::create),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/asset-exports/import",
            post(admin_world_map_asset_import::import)
                .layer(DefaultBodyLimit::max(admin_world_map_asset_import::MAX_ASSET_MANIFEST_BYTES)),
        )
        .route(
            "/api/v1/admin/world-builder/maps/{map_id}/asset-exports/preflight",
            post(admin_world_map_asset_import::preflight)
                .layer(DefaultBodyLimit::max(admin_world_map_asset_import::MAX_ASSET_MANIFEST_BYTES)),
        )
        .route(
            "/api/v1/admin/world-builder/assets/{asset_id}/export",
            get(admin_world_map_asset_export::export),
        )
        .route(
            "/api/v1/admin/world-builder/assets/{asset_id}/export-package",
            get(admin_world_map_asset_export::export_package),
        )
        .route(
            "/api/v1/admin/world-builder/assets/{asset_id}",
            patch(admin_world_map_asset::update).delete(admin_world_map_asset::delete),
        )
        .route(
            "/api/v1/admin/world-builder/assets/{asset_id}/versions",
            get(admin_world_map_asset::versions),
        )
        .route(
            "/api/v1/admin/world-builder/assets/{asset_id}/versions/{version_id}",
            post(admin_world_map_asset::restore),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}",
            get(admin_world_node::show)
                .patch(admin_world_node::update)
                .delete(admin_world_node::delete),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/activity-graph-layout",
            patch(admin_world_node_layout::update),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/position",
            patch(admin_world_map_layout::update_node),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/swap",
            patch(admin_world_map_layout::swap_node),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/reset-unlocks",
            post(admin_world_node_unlock::reset_tool_unlocks),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/manual-unlocks",
            post(admin_world_node_manual_unlock::set_manual_unlock),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/insert-map-asset",
            post(admin_world_map_asset::insert),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/insert",
            post(admin_world_node::insert),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/graph-position",
            patch(admin_world_activity_position::update),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/ai-review",
            post(admin_world_activity_ai_review::create),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/learning-design",
            patch(admin_activity_learning_design::update),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/evidence-context",
            patch(admin_activity_evidence_context::update),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/feedback-guidance",
            patch(admin_activity_feedback_guidance::update),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/completion-choice",
            patch(admin_activity_completion_choice::update),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/ambient-sound",
            patch(admin_activity_ambient_sound::update),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/source-references",
            patch(admin_activity_source_references::update),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/versions",
            get(admin_world_activity_history::index),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/versions/{version_id}",
            get(admin_world_activity_history::show).post(admin_world_activity_history::restore),
        )
        .route(
            "/api/v1/admin/source-records",
            get(admin_source_records::index).post(admin_source_records::create),
        )
        .route(
            "/api/v1/admin/source-records/{source_id}",
            patch(admin_source_records::update).delete(admin_source_records::delete),
        )
        .route(
            "/api/v1/admin/source-records/{source_id}/versions",
            get(admin_source_records::versions),
        )
        .route(
            "/api/v1/admin/source-records/{source_id}/versions/{version_id}",
            post(admin_source_records::restore),
        )
        .route("/api/v1/admin/activity-templates", get(admin_activity_templates::index))
        .route("/api/v1/admin/languages", get(admin_translation_catalog::list).post(admin_translation_catalog::create))
        .route("/api/v1/admin/languages/{code}", patch(admin_translation_catalog::update))
        .route("/api/v1/admin/languages/{code}/translation-catalog", get(admin_translation_catalog::language_export))
        .route("/api/v1/admin/languages/{code}/translation-catalog/import", post(admin_translation_catalog::import).layer(DefaultBodyLimit::max(admin_translation_catalog::MAX_TRANSLATION_CATALOG_BYTES + 16 * 1024)))
        .route("/api/v1/admin/localization/catalogs/english", get(admin_translation_catalog::english_export))
        .route("/api/v1/admin/media-assets", get(admin_media_assets::index).post(admin_media_assets::upload).layer(DefaultBodyLimit::max(image_upload::MAX_IMAGE_BYTES + 16 * 1024)))
        .route("/api/v1/admin/assets/items", get(admin_asset_catalog::list_items).post(admin_asset_catalog::create_item))
        .route("/api/v1/admin/assets/items/{item_id}", patch(admin_asset_catalog::update_item))
        .route("/api/v1/admin/assets/tools", get(admin_asset_catalog::list_tools).post(admin_asset_catalog::create_tool))
        .route("/api/v1/admin/assets/tools/{tool_id}", patch(admin_asset_catalog::update_tool))
        .route("/api/v1/admin/media-assets/{asset_id}", patch(admin_media_assets::update_metadata).delete(admin_media_assets::delete))
        .route("/api/v1/admin/media-assets/{asset_id}/replace", post(admin_media_assets::replace).layer(DefaultBodyLimit::max(image_upload::MAX_IMAGE_BYTES + 16 * 1024)))
        .route("/api/v1/admin/media-assets/{asset_id}/content", get(admin_media_assets::content))
        .route("/api/v1/admin/sounds", get(admin_sound::index).post(admin_sound::create))
        .route("/api/v1/admin/sounds/media", post(admin_sound::upload_media).layer(DefaultBodyLimit::max(admin_sound::AUDIO_MULTIPART_BODY_LIMIT)))
        .route("/api/v1/admin/sounds/media/{asset_id}/content", get(admin_sound::admin_content))
        .route("/api/v1/admin/sounds/media/{asset_id}", axum::routing::delete(admin_sound::delete_media))
        .route("/api/v1/admin/sounds/{sound_id}", patch(admin_sound::update).delete(admin_sound::delete))
        .route("/api/v1/public/sounds/{sound_id}/content", get(admin_sound::public_content))
        .route("/api/v1/admin/dialogue-typing-sound-sets", get(admin_dialogue_typing_sound_set::index).post(admin_dialogue_typing_sound_set::create))
        .route("/api/v1/admin/dialogue-typing-sound-sets/media", post(admin_dialogue_typing_sound_set::upload_media).layer(DefaultBodyLimit::max(admin_dialogue_typing_sound_set::AUDIO_MULTIPART_BODY_LIMIT)))
        .route("/api/v1/admin/dialogue-typing-sound-sets/media/{asset_id}", delete(admin_dialogue_typing_sound_set::discard_media))
        .route("/api/v1/admin/dialogue-typing-sound-sets/{set_id}/sounds", patch(admin_dialogue_typing_sound_set::replace_all))
        .route("/api/v1/admin/dialogue-typing-sound-sets/{set_id}/sounds/{letter}", patch(admin_dialogue_typing_sound_set::replace_letter))
        .route("/api/v1/admin/dialogue-typing-sound-sets/{set_id}", patch(admin_dialogue_typing_sound_set::update))
        .route("/api/v1/learner/dialogue-typing-sounds/{sound_id}/content", get(admin_dialogue_typing_sound_set::learner_content))
        .route("/api/v1/learner/media-assets/{asset_id}/content", get(learner_media_assets::content))
        .route("/api/v1/public/media-assets/{asset_id}/content", get(public_media_assets::content))
        .route("/api/v1/admin/public-presentation", get(admin_public_presentation::show).patch(admin_public_presentation::update))
        .route("/api/v1/admin/public-information-pages", get(admin_public_content::pages))
        .route("/api/v1/admin/public-information-pages/{slug}", patch(admin_public_content::update_page))
        .route("/api/v1/admin/public-source-links", get(admin_public_content::source_links).patch(admin_public_content::update_source_links))
        .route("/api/v1/admin/world-builder/activities/{activity_id}/templates", post(admin_activity_templates::create))
        .route("/api/v1/admin/activity-templates/{template_id}", get(admin_activity_templates::show).patch(admin_activity_templates::rename).delete(admin_activity_templates::delete))
        .route("/api/v1/admin/activity-templates/{template_id}/from-activity/{activity_id}", patch(admin_activity_templates::update_from_activity))
        .route("/api/v1/admin/activity-templates/{template_id}/sharing", patch(admin_activity_templates::share))
        .route("/api/v1/admin/activity-templates/{template_id}/revisions", get(admin_activity_templates::revisions))
        .route("/api/v1/admin/activity-templates/{template_id}/revisions/{revision_id}", get(admin_activity_templates::revision).post(admin_activity_templates::restore))
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}",
            delete(admin_world_activity_delete::delete),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/open-practice-activities",
            post(admin_world_open_practice::create),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/open-practice",
            patch(admin_world_open_practice::update),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/reflection-activities",
            post(admin_world_reflection::create),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/reflection",
            patch(admin_world_reflection::update),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/review-activities",
            post(admin_world_review::create),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/review",
            patch(admin_world_review::update),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/markdown-activities",
            post(admin_world_markdown::create),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/markdown",
            patch(admin_world_markdown::update),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/portal-activities",
            post(admin_world_portal::create),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/portal",
            patch(admin_world_portal::update),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/npc-dialogue-activities",
            post(admin_world_npc_dialogue::create),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/npc-dialogue",
            get(admin_world_npc_dialogue::show),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/npc-dialogue/nodes",
            post(admin_world_npc_dialogue::create_node),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/npc-dialogue/nodes/{dialogue_node_id}",
            patch(admin_world_npc_dialogue::update_node).delete(admin_world_npc_dialogue::delete_node),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/npc-dialogue/transitions",
            post(admin_world_npc_dialogue::create_transition),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/npc-dialogue/transitions/{transition_id}",
            delete(admin_world_npc_dialogue::delete_transition),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/npc-dialogue/graph-layout",
            patch(admin_world_npc_dialogue::update_layout),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/question-activities",
            post(admin_world_question::create),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/question",
            patch(admin_world_question::update),
        )
        .route("/api/v1/admin/world-builder/nodes/{node_id}/message-activities", post(admin_world_message::create))
        .route("/api/v1/admin/world-builder/activities/{activity_id}/message", patch(admin_world_message::update))
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/shared-task-activities",
            post(admin_world_shared_task::create),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/shared-task",
            patch(admin_world_shared_task::update),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/item-obstacle-activities",
            post(admin_world_item_obstacle::create),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/item-obstacle",
            patch(admin_world_item_obstacle::update),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/obstacle-activities",
            post(admin_world_obstacle::create),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/obstacle",
            patch(admin_world_obstacle::update),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/tool-grant-activities",
            post(admin_world_tool_grant::create),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/tool-grant",
            patch(admin_world_tool_grant::update),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/item-grant-activities",
            post(admin_world_item_grant::create),
        )
        .route(
            "/api/v1/admin/world-builder/activities/{activity_id}/item-grant",
            patch(admin_world_item_grant::update),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/start-routes",
            post(admin_world_node_starts::add)
                .delete(admin_world_node_starts::remove_all),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/start-routes/{activity_id}",
            delete(admin_world_node_starts::remove_one),
        )
        .route(
            "/api/v1/admin/world-builder/nodes/{node_id}/activity-transitions",
            post(admin_world_node_transition::create),
        )
        .route(
            "/api/v1/admin/world-builder/activity-transitions/{transition_id}",
            patch(admin_world_node_transition::update).delete(admin_world_node_transition::delete),
        )
        .route(
            "/api/v1/admin/world-builder/start-routes/{start_route_id}",
            patch(admin_world_node_starts::update).delete(admin_world_node_starts::delete),
        )
        .route(
            "/api/v1/admin/world-builder/start-routes/{start_route_id}/reorder",
            post(admin_world_node_starts::reorder),
        )
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
        .route("/api/v1/learner/companion", get(learner_companion::show))
        .route(
            "/api/v1/learner/companion/turn",
            post(learner_companion_turn::create),
        )
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
            "/api/v1/learner/platform-translations",
            get(learner_platform_translation::show),
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
            "/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/translation",
            get(learner_activity_translation::show),
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
        .layer(middleware::from_fn(
            session_commands::restore_remembered_session_expiry,
        ))
        .layer(auth_layer)
        .layer(
            ServiceBuilder::new()
                .layer(SetRequestIdLayer::new(REQUEST_ID_HEADER, MakeRequestUuid))
                .layer(TraceLayer::new_for_http())
                .layer(PropagateRequestIdLayer::new(REQUEST_ID_HEADER))
                .layer(middleware::from_fn(observability::record_http_metrics))
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
    use tracing_subscriber::{
        EnvFilter,
        layer::{Layer, SubscriberExt},
        util::SubscriberInitExt,
    };

    tracing_subscriber::registry()
        .with(observability::SqlQueryCountLayer)
        .with(
            tracing_subscriber::fmt::layer()
                .with_target(false)
                .compact()
                .with_filter(
                    EnvFilter::try_from_default_env()
                        .unwrap_or_else(|_| EnvFilter::new("info,warn")),
                ),
        )
        .init();
}

#[cfg(test)]
mod tests {
    use axum::{body::Body, http::Request};
    use http_body_util::BodyExt;
    use sqlx::postgres::PgPoolOptions;
    use tower::ServiceExt;

    use super::{AppState, ai_credential_crypto, configure_webauthn, observability, router};

    fn test_webauthn() -> webauthn_rs::prelude::Webauthn {
        configure_webauthn("http://localhost:8081").expect("a valid local WebAuthn configuration")
    }

    fn test_email_delivery() -> super::email_delivery::EmailDelivery {
        super::email_delivery::EmailDelivery::new(
            &super::config::EmailConfig {
                from_address: "no-reply@wicked-learning.local".to_owned(),
                from_name: "Wicked Learning".to_owned(),
                smtp_host: "localhost".to_owned(),
                smtp_password: None,
                smtp_port: 1025,
                smtp_security: super::config::SmtpSecurity::None,
                smtp_username: None,
            },
            "http://localhost:8081",
        )
        .expect("valid local email configuration")
    }

    #[tokio::test]
    async fn liveness_does_not_depend_on_a_database_connection() {
        let state = AppState {
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
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
    async fn metrics_scrape_uses_matched_routes_without_recording_the_scrape() {
        observability::initialize().expect("metrics recorder initializes once");

        let state = AppState {
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
            webauthn: test_webauthn(),
        };

        let app = router(state);
        let liveness_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/v1/health/live")
                    .body(Body::empty())
                    .expect("a valid HTTP request"),
            )
            .await
            .expect("liveness handler response");
        assert_eq!(liveness_response.status(), 200);
        liveness_response
            .into_body()
            .collect()
            .await
            .expect("liveness body bytes");

        let protected_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(
                        "/api/v1/admin/world-builder/maps/raw-path-must-not-be-a-metric-label?query=must-not-appear",
                    )
                    .body(Body::empty())
                    .expect("a valid HTTP request"),
            )
            .await
            .expect("protected route response");
        assert_eq!(protected_response.status(), 404);

        let metrics_response = app
            .oneshot(
                Request::builder()
                    .uri("/metrics")
                    .body(Body::empty())
                    .expect("a valid HTTP request"),
            )
            .await
            .expect("metrics handler response");

        assert_eq!(metrics_response.status(), 200);
        assert_eq!(
            metrics_response
                .headers()
                .get("cache-control")
                .and_then(|value| value.to_str().ok()),
            Some("no-store")
        );
        assert!(
            metrics_response
                .headers()
                .get("content-type")
                .and_then(|value| value.to_str().ok())
                .is_some_and(|value| value.starts_with("text/plain; version=0.0.4"))
        );

        let metrics = String::from_utf8(
            metrics_response
                .into_body()
                .collect()
                .await
                .expect("metrics body bytes")
                .to_bytes()
                .to_vec(),
        )
        .expect("UTF-8 metrics body");
        assert!(metrics.contains(
            "wicked_learning_http_requests_total{method=\"GET\",route=\"/api/v1/health/live\",status=\"200\"}"
        ), "{metrics}");
        let liveness_response_bytes = metrics
            .lines()
            .find(|line| {
                line.starts_with(
                    "wicked_learning_http_response_body_bytes_total{method=\"GET\",route=\"/api/v1/health/live\",status=\"200\"}",
                )
            })
            .and_then(|line| line.rsplit_once(' '))
            .and_then(|(_, value)| value.parse::<u64>().ok())
            .expect("a streamed liveness response-byte metric");
        assert!(liveness_response_bytes >= 15, "{metrics}");
        assert!(metrics.contains(
            "wicked_learning_http_requests_total{method=\"GET\",route=\"/api/v1/admin/world-builder/maps/{map_id}\",status=\"404\"}"
        ), "{metrics}");
        assert!(!metrics.contains("raw-path-must-not-be-a-metric-label"));
        assert!(!metrics.contains("must-not-appear"));
        assert!(!metrics.contains("route=\"/metrics\""));
    }

    #[tokio::test]
    async fn anonymous_session_status_is_safe_and_does_not_query_a_database() {
        let state = AppState {
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
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
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
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
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
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
    async fn learner_companion_turn_requires_an_authenticated_session() {
        let state = AppState {
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
            webauthn: test_webauthn(),
        };

        let response = router(state)
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/learner/companion/turn")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"surface":"desk","dialogue_node_id":"ai-turn","assistance_level":"off"}"#,
                    ))
                    .expect("a valid companion-turn request"),
            )
            .await
            .expect("companion-turn response");

        assert_eq!(response.status(), 401);
    }

    #[tokio::test]
    async fn world_builder_requires_an_authenticated_session() {
        let state = AppState {
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
            webauthn: test_webauthn(),
        };

        let response = router(state)
            .oneshot(
                Request::builder()
                    .uri("/api/v1/admin/world-builder")
                    .body(Body::empty())
                    .expect("a valid World Builder request"),
            )
            .await
            .expect("World Builder response");

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
    async fn applying_a_content_plan_requires_an_authenticated_session() {
        let state = AppState {
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
            webauthn: test_webauthn(),
        };

        let response = router(state)
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(
                        "/api/v1/admin/ai-content-plans/00000000-0000-4000-8000-000000000001/apply",
                    )
                    .body(Body::empty())
                    .expect("a valid ContentPlan apply request"),
            )
            .await
            .expect("ContentPlan apply response");

        assert_eq!(response.status(), 401);
    }

    #[tokio::test]
    async fn testing_a_saved_ai_template_requires_an_authenticated_session() {
        let state = AppState {
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
            webauthn: test_webauthn(),
        };

        let response = router(state)
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/admin/ai/templates/00000000-0000-4000-8000-000000000001/test")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"prompt":"Test this template."}"#))
                    .expect("a valid saved-template test request"),
            )
            .await
            .expect("saved-template test response");

        assert_eq!(response.status(), 401);
    }

    #[tokio::test]
    async fn world_builder_map_requires_an_authenticated_session() {
        let state = AppState {
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
            webauthn: test_webauthn(),
        };

        let response = router(state)
            .oneshot(
                Request::builder()
                    .uri("/api/v1/admin/world-builder/maps/00000000-0000-4000-8000-000000000002")
                    .body(Body::empty())
                    .expect("a valid World Builder map request"),
            )
            .await
            .expect("World Builder map response");

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
    async fn world_builder_node_requires_an_authenticated_session() {
        let state = AppState {
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
            webauthn: test_webauthn(),
        };

        let response = router(state)
            .oneshot(
                Request::builder()
                    .uri("/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000010")
                    .body(Body::empty())
                    .expect("a valid World Builder node request"),
            )
            .await
            .expect("World Builder node response");

        assert_eq!(response.status(), 401);
    }

    #[tokio::test]
    async fn world_builder_node_layout_requires_an_authenticated_session() {
        let state = AppState {
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
            webauthn: test_webauthn(),
        };

        let response = router(state)
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000010/activity-graph-layout")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"node":"start","position":{"x":10,"y":20}}"#))
                    .expect("a valid World Builder node layout request"),
            )
            .await
            .expect("World Builder node layout response");

        assert_eq!(response.status(), 401);
    }

    #[tokio::test]
    async fn world_builder_node_start_routes_require_an_authenticated_session() {
        let state = AppState {
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
            webauthn: test_webauthn(),
        };

        let response = router(state)
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000010/start-routes")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"activity_id":"00000000-0000-4000-8000-000000000011"}"#))
                    .expect("a valid World Builder start route request"),
            )
            .await
            .expect("World Builder start route response");

        assert_eq!(response.status(), 401);
    }

    #[tokio::test]
    async fn world_builder_activity_mutations_require_an_authenticated_session() {
        let state = AppState {
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
            webauthn: test_webauthn(),
        };

        let position_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000007/graph-position")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"position":{"x":12,"y":-3}}"#))
                    .expect("a valid World Builder activity-position request"),
            )
            .await
            .expect("World Builder activity-position response");

        assert_eq!(position_response.status(), 401);

        let ai_review_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000007/ai-review")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"template_id":"00000000-0000-4000-8000-000000000008"}"#))
                    .expect("a valid World Builder AI-review request"),
            )
            .await
            .expect("World Builder AI-review response");

        assert_eq!(ai_review_response.status(), 401);

        let learning_design_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000007/learning-design")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"learning_intent":"explain","competence_topics":[{"topic":"Systems Thinking","weight":1}],"updated_at":"2026-11-08T09:00:00.000000Z"}"#))
                    .expect("a valid World Builder learning-design request"),
            )
            .await
            .expect("World Builder learning-design response");

        assert_eq!(learning_design_response.status(), 401);

        let source_references_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000007/source-references")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"source_references":[{"title":"A source","url":"https://example.test","anchor":null,"concepts":[],"excerpt":null,"published_at":null,"publisher":null,"rights":null}],"updated_at":"2026-11-08T09:00:00.000000Z"}"#))
                    .expect("a valid World Builder source-references request"),
            )
            .await
            .expect("World Builder source-references response");

        assert_eq!(source_references_response.status(), 401);

        let ambient_sound_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000007/ambient-sound")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"enabled":false,"sound_id":null,"updated_at":"2026-11-08T09:00:00.000000Z"}"#))
                    .expect("a valid World Builder ambient-sound request"),
            )
            .await
            .expect("World Builder ambient-sound response");

        assert_eq!(ambient_sound_response.status(), 401);

        let delete_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000007")
                    .body(Body::empty())
                    .expect("a valid World Builder activity-delete request"),
            )
            .await
            .expect("World Builder activity-delete response");

        assert_eq!(delete_response.status(), 401);

        let create_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000010/open-practice-activities")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"title":"A practice"}"#))
                    .expect("a valid World Builder open-practice create request"),
            )
            .await
            .expect("World Builder open-practice create response");

        assert_eq!(create_response.status(), 401);

        let update_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000007/open-practice")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"title":"A practice","slug":null,"introduction":null,"next_step":null,"updated_at":"2026-11-07T17:00:00.000000Z"}"#))
                    .expect("a valid World Builder open-practice update request"),
            )
            .await
            .expect("World Builder open-practice update response");

        assert_eq!(update_response.status(), 401);

        let reflection_create_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000010/reflection-activities")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"title":"A reflection"}"#))
                    .expect("a valid World Builder reflection create request"),
            )
            .await
            .expect("World Builder reflection create response");

        assert_eq!(reflection_create_response.status(), 401);

        let reflection_update_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000007/reflection")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"title":"A reflection","slug":null,"introduction":null,"prompt":null,"note":null,"topic":null,"subtopic":null,"updated_at":"2026-11-07T17:00:00.000000Z"}"#))
                    .expect("a valid World Builder reflection update request"),
            )
            .await
            .expect("World Builder reflection update response");

        assert_eq!(reflection_update_response.status(), 401);

        let item_grant_create_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000010/item-grant-activities")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"title":"A grant"}"#))
                    .expect("a valid World Builder item-grant create request"),
            )
            .await
            .expect("World Builder item-grant create response");

        assert_eq!(item_grant_create_response.status(), 401);

        let item_grant_update_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000007/item-grant")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"title":"A grant","slug":null,"introduction":null,"background_dark":null,"background_light":null,"background_mirrored":false,"items":[],"probability_percent":100,"updated_at":"2026-11-07T17:00:00.000000Z"}"#))
                    .expect("a valid World Builder item-grant update request"),
            )
            .await
            .expect("World Builder item-grant update response");

        assert_eq!(item_grant_update_response.status(), 401);

        let tool_grant_create_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000010/tool-grant-activities")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"title":"A tool grant"}"#))
                    .expect("a valid World Builder tool-grant create request"),
            )
            .await
            .expect("World Builder tool-grant create response");

        assert_eq!(tool_grant_create_response.status(), 401);

        let tool_grant_update_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000007/tool-grant")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"title":"A tool grant","slug":null,"introduction":null,"background_dark":null,"background_light":null,"background_mirrored":false,"bubble_border_color_dark":null,"bubble_border_color_light":null,"bubble_color_dark":null,"bubble_color_light":null,"bubble_opacity_dark":92,"bubble_opacity_light":94,"fade_duration_seconds":0.4,"slide_direction":"left","slide_duration_seconds":0.6,"text":null,"tool_id":null,"tool_mirrored":false,"tool_x":50,"tool_y":50,"typing_speed":24,"updated_at":"2026-11-07T17:00:00.000000Z"}"#))
                    .expect("a valid World Builder tool-grant update request"),
            )
            .await
            .expect("World Builder tool-grant update response");

        assert_eq!(tool_grant_update_response.status(), 401);

        let item_obstacle_create_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000010/item-obstacle-activities")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"title":"An item obstacle"}"#))
                    .expect("a valid World Builder item-obstacle create request"),
            )
            .await
            .expect("World Builder item-obstacle create response");

        assert_eq!(item_obstacle_create_response.status(), 401);

        let item_obstacle_update_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000007/item-obstacle")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"title":"An item obstacle","slug":null,"introduction":null,"background_dark":null,"background_light":null,"background_mirrored":false,"met_background_dark":null,"met_background_light":null,"met_background_mirrored":false,"overlay_dark":null,"overlay_light":null,"overlay_mirrored":false,"overlay_x":50,"overlay_y":50,"overlay_width":30,"slots":[],"consume_on_each_entry":false,"lock_minutes":0,"sound_not_met_enabled":false,"sound_not_met_id":null,"sound_met_enabled":false,"sound_met_id":null,"sound_transition_enabled":false,"sound_transition_id":null,"updated_at":"2026-11-07T17:00:00.000000Z"}"#))
                    .expect("a valid World Builder item-obstacle update request"),
            )
            .await
            .expect("World Builder item-obstacle update response");

        assert_eq!(item_obstacle_update_response.status(), 401);

        let obstacle_create_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000010/obstacle-activities")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"title":"An obstacle"}"#))
                    .expect("a valid World Builder obstacle create request"),
            )
            .await
            .expect("World Builder obstacle create response");

        assert_eq!(obstacle_create_response.status(), 401);

        let obstacle_update_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000007/obstacle")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"title":"An obstacle","slug":null,"introduction":null,"allowed_tool_ids":[],"background_dark":null,"background_light":null,"background_mirrored":false,"bubble_border_color_dark":null,"bubble_border_color_light":null,"bubble_color_dark":null,"bubble_color_light":null,"bubble_opacity_dark":92,"bubble_opacity_light":94,"obstacle_image_dark":null,"obstacle_image_light":null,"obstacle_image_mirrored":false,"persist_after_solved":true,"prompt_text":null,"obstacle_x":50,"obstacle_y":50,"obstacle_width":28,"revisit_background_dark":null,"revisit_background_light":null,"revisit_background_mirrored":false,"revisit_image_dark":null,"revisit_image_light":null,"revisit_image_mirrored":false,"revisit_text":null,"success_animation":"zoom","success_text":null,"typing_speed":24,"updated_at":"2026-11-07T17:00:00.000000Z"}"#))
                    .expect("a valid World Builder obstacle update request"),
            )
            .await
            .expect("World Builder obstacle update response");

        assert_eq!(obstacle_update_response.status(), 401);

        let template_list_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .uri("/api/v1/admin/activity-templates?page=1&per_page=8")
                    .body(Body::empty())
                    .expect("a valid reusable-template list request"),
            )
            .await
            .expect("reusable-template list response");

        assert_eq!(template_list_response.status(), 401);

        let template_create_response = router(state.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000007/templates")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"name":"Reusable practice"}"#))
                    .expect("a valid reusable-template create request"),
            )
            .await
            .expect("reusable-template create response");

        assert_eq!(template_create_response.status(), 401);

        let transition_response = router(state)
            .oneshot(
                Request::builder()
                    .method("PATCH")
                    .uri("/api/v1/admin/world-builder/activity-transitions/00000000-0000-4000-8000-000000000001")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"label":"Continue"}"#))
                    .expect("a valid World Builder transition request"),
            )
            .await
            .expect("World Builder transition response");

        assert_eq!(transition_response.status(), 401);
    }

    #[tokio::test]
    async fn learner_journal_export_requires_an_authenticated_session() {
        let state = AppState {
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
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
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
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
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
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
            ai_credential_cipher: ai_credential_crypto::AiCredentialCipher::new(
                *b"test-ai-credential-key-000000000",
            ),
            application_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            csrf_cookie_key:
                "test-csrf-cookie-key-material-must-be-at-least-sixty-four-bytes-long-0000"
                    .to_owned(),
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
            login_rate_limit_key: [0; 32],
            media_store: super::MediaStore::in_memory(),
            public_origin: "http://localhost:8081".to_owned(),
            session_cookie_secure: false,
            totp_secret_cipher: super::totp_crypto::TotpSecretCipher::new([0; 32]),
            email_delivery: test_email_delivery(),
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
