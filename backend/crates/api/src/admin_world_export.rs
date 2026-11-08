use axum::{
    body::Body,
    extract::State,
    http::{HeaderValue, StatusCode, header},
    response::Response,
};
use axum_login::AuthSession;
use wicked_learning_application::admin_world_export::AdminWorldExportQuery;
use wicked_learning_persistence::admin_world_export::PostgresAdminWorldExportRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

/// Downloads the source-shaped World bundle. Map selection happens before any
/// map graph is read, and learner, history and editor-assignment data stay out.
pub async fn export(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Response, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminWorldExportRepository::new(&state.application_database);
    let exported = AdminWorldExportQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    let bytes = serde_json::to_vec_pretty(&exported.payload)
        .map_err(|_| ApiError::internal_server_error())?;
    let mut response = Response::new(Body::from([bytes, b"\n".to_vec()].concat()));
    *response.status_mut() = StatusCode::OK;
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );
    response.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{}\"", exported.filename))
            .map_err(|_| ApiError::internal_server_error())?,
    );
    Ok(response)
}

/// Downloads the scoped World manifest and only its declared managed media.
pub async fn export_package(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Response, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminWorldExportRepository::new(&state.application_database);
    let exported = AdminWorldExportQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    crate::world_transfer_package::package_response(
        &state,
        &exported.payload,
        &exported.filename.replace(".json", ".zip"),
    )
    .await
}
