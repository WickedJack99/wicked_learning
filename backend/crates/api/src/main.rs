mod bootstrap;
mod config;
mod csrf;
mod current_user;
mod error;
mod identity;
mod learner_route_run;
mod learner_world;
mod login_rate_limit;
pub mod media_store;
mod passwords;
mod public_map_assets;
mod public_pages;
mod public_routes;
mod public_search;
mod public_source_links;
mod public_world;
mod session_commands;
mod session_status;

use std::{process::ExitCode, time::Duration};

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderName, Method},
    response::IntoResponse,
    routing::{get, post},
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

use crate::{
    config::{BootstrapAdminConfig, Config},
    error::ApiError,
    identity::IdentityBackend,
    media_store::MediaStore,
};

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

    let state = AppState {
        application_database,
        csrf_cookie_key: configuration.csrf_cookie_key,
        identity_database,
        media_store,
        public_origin: configuration.public_origin,
        session_cookie_secure: configuration.session_cookie_secure,
    };
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
    let login_routes = Router::new()
        .route("/api/v1/session/login", post(session_commands::login))
        .layer(
            GovernorLayer::new(login_rate_limit)
                .error_handler(|_| ApiError::too_many_requests().into_response()),
        );

    Router::new()
        .merge(login_routes)
        .route("/api/v1/health/live", get(live))
        .route("/api/v1/health/ready", get(ready))
        .route("/api/v1/security/csrf", get(csrf::show))
        .route("/api/v1/me", get(current_user::show))
        .route("/api/v1/learner/world", get(learner_world::show))
        .route(
            "/api/v1/learner/activity-starts/{start_id}/start",
            post(learner_route_run::start_or_resume),
        )
        .route(
            "/api/v1/learner/activity-starts/{start_id}/reset",
            post(learner_route_run::reset),
        )
        .route("/api/v1/session", get(session_status::show))
        .route("/api/v1/session/logout", post(session_commands::logout))
        .route("/api/v1/public/pages/{slug}", get(public_pages::show))
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
                .layer(RequestBodyLimitLayer::new(64 * 1024))
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

    use super::{AppState, router};

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
            "{\"authenticated\":false,\"subject_id\":null}"
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
