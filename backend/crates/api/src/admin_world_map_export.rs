use axum::{
    body::Body,
    extract::{Path, State},
    http::{HeaderValue, StatusCode, header},
    response::Response,
};
use axum_login::AuthSession;
use uuid::Uuid;
use wicked_learning_application::admin_world_map_export::AdminWorldMapExportQuery;
use wicked_learning_persistence::admin_world_map_export::PostgresAdminWorldMapExportRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

/// Downloads the source-shaped authored map manifest. Learner records, review
/// payloads, history and editor assignments are never selected by this read.
pub async fn export(
    State(state): State<AppState>,
    Path(map_id): Path<String>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Response, ApiError> {
    let map_id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminWorldMapExportRepository::new(&state.application_database);
    let exported = AdminWorldMapExportQuery::new(&repository)
        .execute(&principal, map_id)
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
