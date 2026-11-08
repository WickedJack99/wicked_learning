use axum::{
    Json,
    extract::{Multipart, State},
};
use axum_login::AuthSession;
use wicked_learning_application::admin_world_map_export_preflight::{
    AdminWorldMapExportPreflightQuery, MapExportPreflightResult,
};

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

const MAX_MANIFEST_BYTES: usize = 5 * 1024 * 1024;

/// Checks an uploaded manifest without creating or changing authored content.
pub async fn preflight(
    State(state): State<AppState>,
    session: AuthSession<IdentityBackend>,
    mut multipart: Multipart,
) -> Result<Json<MapExportPreflightResult>, ApiError> {
    let principal = authenticated_principal(&state, session).await?;
    let manifest = manifest_bytes(&mut multipart).await?;
    let result = AdminWorldMapExportPreflightQuery::execute(&principal, &manifest)
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(result))
}

async fn manifest_bytes(multipart: &mut Multipart) -> Result<Vec<u8>, ApiError> {
    let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| ApiError::invalid_request())?
    else {
        return Err(ApiError::invalid_request());
    };
    if field.name() != Some("manifest") {
        return Err(ApiError::invalid_request());
    }
    let manifest = field
        .bytes()
        .await
        .map_err(|_| ApiError::invalid_request())?;
    if manifest.is_empty() || manifest.len() > MAX_MANIFEST_BYTES {
        return Err(ApiError::invalid_request());
    }
    if multipart
        .next_field()
        .await
        .map_err(|_| ApiError::invalid_request())?
        .is_some()
    {
        return Err(ApiError::invalid_request());
    }
    Ok(manifest.to_vec())
}
