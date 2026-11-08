use axum::{
    body::Body,
    extract::{Path, State},
    http::{HeaderValue, StatusCode, header},
    response::Response,
};
use axum_login::AuthSession;
use uuid::Uuid;
use wicked_learning_application::admin_world_map_asset_export::AdminWorldMapAssetExportQuery;
use wicked_learning_persistence::admin_world_map_asset_export::PostgresAdminWorldMapAssetExportRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

/// Downloads one source-shaped MapAsset manifest. It is always scoped through
/// the asset's editable map and does not include portal or learner records.
pub async fn export(
    State(state): State<AppState>,
    Path(asset_id): Path<String>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Response, ApiError> {
    let asset_id = Uuid::parse_str(&asset_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminWorldMapAssetExportRepository::new(&state.application_database);
    let exported = AdminWorldMapAssetExportQuery::new(&repository)
        .execute(&principal, asset_id)
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
