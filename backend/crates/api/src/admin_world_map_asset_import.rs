use axum::{
    Json,
    extract::{Multipart, Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Serialize;
use uuid::Uuid;
use wicked_learning_application::{
    admin_world_map_asset_import::{
        AdminWorldMapAssetImportCommand, AdminWorldMapAssetImportError, validate_asset_manifest,
    },
    admin_world_map_export_preflight::MapExportPreflightResult,
};
use wicked_learning_persistence::admin_world_map_asset_import::PostgresAdminWorldMapAssetImportRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

pub const MAX_ASSET_MANIFEST_BYTES: usize = 5 * 1024 * 1024;

#[derive(Serialize)]
pub struct ImportMapAssetResponse {
    pub asset_id: Uuid,
}

pub async fn preflight(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
    multipart: Multipart,
) -> Result<Json<MapExportPreflightResult>, ApiError> {
    let manifest = manifest(multipart).await?;
    let principal = authenticated_principal(&state, auth_session).await?;
    if !principal.has_permission("world_maps", "ru") {
        return Err(ApiError::not_found());
    }
    Ok(Json(validate_asset_manifest(&manifest)))
}

pub async fn import(
    State(state): State<AppState>,
    Path(map_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    multipart: Multipart,
) -> Result<(StatusCode, Json<ImportMapAssetResponse>), ApiError> {
    let map_id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let manifest = manifest(multipart).await?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapAssetImportRepository::new(&state.application_database);
    let asset_id = AdminWorldMapAssetImportCommand::new(&repository)
        .execute(&principal, map_id, &manifest)
        .await
        .map_err(|error| match error {
            AdminWorldMapAssetImportError::Invalid => ApiError::invalid_request(),
            AdminWorldMapAssetImportError::Unavailable => ApiError::service_unavailable(),
        })?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(ImportMapAssetResponse { asset_id }),
    ))
}

async fn manifest(mut multipart: Multipart) -> Result<Vec<u8>, ApiError> {
    let mut manifest = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| ApiError::invalid_request())?
    {
        if field.name() != Some("manifest") || manifest.is_some() {
            return Err(ApiError::invalid_request());
        }
        let bytes = field
            .bytes()
            .await
            .map_err(|_| ApiError::invalid_request())?;
        if bytes.is_empty() || bytes.len() > MAX_ASSET_MANIFEST_BYTES {
            return Err(ApiError::invalid_request());
        }
        manifest = Some(bytes.to_vec());
    }
    manifest.ok_or_else(ApiError::invalid_request)
}
