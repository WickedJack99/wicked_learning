mod config;
mod error;
mod passwords;
mod public_pages;

use std::{process::ExitCode, time::Duration};

use axum::{Json, Router, extract::State, http::HeaderName, routing::get};
use serde::Serialize;
use sqlx::{PgPool, postgres::PgPoolOptions};
use tower::ServiceBuilder;
use tower_http::{
    limit::RequestBodyLimitLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};
use tower_sessions_sqlx_store::PostgresStore;
use tracing::{error, info};

use crate::{config::Config, error::ApiError};

static APPLICATION_MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations/application");
static IDENTITY_MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations/identity");

const REQUEST_ID_HEADER: HeaderName = HeaderName::from_static("x-request-id");

#[derive(Clone)]
pub(crate) struct AppState {
    application_database: PgPool,
    identity_database: PgPool,
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

    if std::env::args().nth(1).as_deref() == Some("migrate") {
        return run_migrations(&configuration).await;
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

    let state = AppState {
        application_database,
        identity_database,
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

fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/v1/health/live", get(live))
        .route("/api/v1/health/ready", get(ready))
        .route("/api/v1/public/pages/{slug}", get(public_pages::show))
        .with_state(state)
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
            identity_database: PgPoolOptions::new()
                .connect_lazy("postgres://unavailable:unavailable@localhost/unavailable")
                .expect("a syntactically valid test connection URL"),
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
}
