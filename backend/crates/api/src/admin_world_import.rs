use axum::{
    Json,
    extract::{Multipart, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Serialize;
use uuid::Uuid;
use wicked_learning_application::admin_world_import::{
    AdminWorldImportCommand, AdminWorldImportError, WorldImportPreflightResult,
    preflight_world_manifest,
};
use wicked_learning_persistence::admin_world_import::PostgresAdminWorldImportRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

pub const MAX_WORLD_MANIFEST_BYTES: usize = crate::world_transfer_package::MAX_PACKAGE_BYTES;

#[derive(Serialize)]
pub struct ImportWorldResponse {
    pub map_ids: Vec<Uuid>,
}

/// Checks a JSON world bundle without creating or changing authored content.
pub async fn preflight(
    State(state): State<AppState>,
    session: AuthSession<IdentityBackend>,
    multipart: Multipart,
) -> Result<Json<WorldImportPreflightResult>, ApiError> {
    let principal = authenticated_principal(&state, session).await?;
    if !principal.has_permission("world_maps", "ru") {
        return Err(ApiError::not_found());
    }
    let manifest = preflight_manifest(manifest_bytes(multipart).await?)?;
    Ok(Json(preflight_world_manifest(&manifest)))
}

fn preflight_manifest(manifest: Vec<u8>) -> Result<Vec<u8>, ApiError> {
    if !crate::world_transfer_package::is_package(&manifest) {
        return Ok(manifest);
    }
    let package = crate::world_transfer_package::read_package(manifest)
        .map_err(|_| ApiError::invalid_request())?;
    serde_json::to_vec(&package.manifest).map_err(|_| ApiError::invalid_request())
}

/// Imports a bounded authored world bundle as fresh maps in the current World.
pub async fn import(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    multipart: Multipart,
) -> Result<(StatusCode, Json<ImportWorldResponse>), ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let manifest = manifest_bytes(multipart).await?;
    let repository = PostgresAdminWorldImportRepository::new(&state.application_database);
    let imported = if crate::world_transfer_package::is_package(&manifest) {
        let package = crate::world_transfer_package::read_package(manifest)
            .map_err(|_| ApiError::invalid_request())?;
        let materialized = crate::world_transfer_package::materialize_package(
            &state,
            principal.subject_id,
            package,
        )
        .await?;
        let result = AdminWorldImportCommand::new(&repository)
            .execute(&principal, &materialized.manifest)
            .await;
        match result {
            Ok(Some(imported)) => imported,
            Ok(None) => {
                crate::world_transfer_package::cleanup_materialized(&state, &materialized).await;
                return Err(ApiError::not_found());
            }
            Err(AdminWorldImportError::Invalid) => {
                crate::world_transfer_package::cleanup_materialized(&state, &materialized).await;
                return Err(ApiError::invalid_request());
            }
            Err(AdminWorldImportError::Unavailable) => {
                crate::world_transfer_package::cleanup_materialized(&state, &materialized).await;
                return Err(ApiError::service_unavailable());
            }
        }
    } else {
        AdminWorldImportCommand::new(&repository)
            .execute(&principal, &manifest)
            .await
            .map_err(|error| match error {
                AdminWorldImportError::Invalid => ApiError::invalid_request(),
                AdminWorldImportError::Unavailable => ApiError::service_unavailable(),
            })?
            .ok_or_else(ApiError::not_found)?
    };
    Ok((
        StatusCode::CREATED,
        Json(ImportWorldResponse {
            map_ids: imported.map_ids,
        }),
    ))
}

async fn manifest_bytes(mut multipart: Multipart) -> Result<Vec<u8>, ApiError> {
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
    if manifest.is_empty() || manifest.len() > MAX_WORLD_MANIFEST_BYTES {
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
