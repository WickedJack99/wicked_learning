mod config;

use std::process::ExitCode;

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
};
use serde::Serialize;
use sqlx::{PgPool, postgres::PgPoolOptions};
use tracing::{error, info};

use crate::config::Config;

static APPLICATION_MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations/application");
static IDENTITY_MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations/identity");

#[derive(Clone)]
struct AppState {
    application_database: PgPool,
    identity_database: PgPool,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
}

#[derive(Serialize)]
struct ProblemResponse {
    code: &'static str,
    title: &'static str,
}

struct NotReady;

impl IntoResponse for NotReady {
    fn into_response(self) -> Response {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ProblemResponse {
                code: "dependency_unavailable",
                title: "A required service is unavailable.",
            }),
        )
            .into_response()
    }
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

    let application_database = match PgPoolOptions::new()
        .max_connections(10)
        .connect(&configuration.application_database_url)
        .await
    {
        Ok(pool) => pool,
        Err(error) => {
            error!(%error, "could not connect to the application database");
            return ExitCode::FAILURE;
        }
    };
    let identity_database = match PgPoolOptions::new()
        .max_connections(10)
        .connect(&configuration.identity_database_url)
        .await
    {
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
        .with_state(state)
}

async fn live() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

async fn ready(State(state): State<AppState>) -> Result<Json<HealthResponse>, NotReady> {
    sqlx::query("SELECT 1")
        .execute(&state.application_database)
        .await
        .map_err(|_| NotReady)?;
    sqlx::query("SELECT 1")
        .execute(&state.identity_database)
        .await
        .map_err(|_| NotReady)?;

    Ok(Json(HealthResponse { status: "ok" }))
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
