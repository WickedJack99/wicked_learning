use std::collections::BTreeSet;

use axum::{
    Json,
    extract::{Multipart, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use wicked_learning_application::admin_world_map_export_preflight::{
    AdminWorldMapExportPreflightError, AdminWorldMapExportPreflightQuery, MapExportPreflightResult,
};
use wicked_learning_persistence::admin_world_map_import::PostgresAdminWorldMapImportRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

const MAX_MANIFEST_BYTES: usize = 5 * 1024 * 1024;

/// Checks an uploaded manifest without creating or changing authored content.
pub async fn preflight(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    mut multipart: Multipart,
) -> Result<Json<MapExportPreflightResult>, ApiError> {
    let principal = authenticated_principal(&state, session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let manifest = manifest_bytes(&mut multipart).await?;
    let manifest = package_manifest(manifest)?;
    let repository = PostgresAdminWorldMapImportRepository::new(&state.application_database);
    let result = AdminWorldMapExportPreflightQuery::new(&repository)
        .execute(&principal, &manifest.manifest, &manifest.package_media_urls)
        .await
        .map_err(|error| match error {
            AdminWorldMapExportPreflightError::Unavailable => ApiError::service_unavailable(),
        })?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(result))
}

struct PreflightManifest {
    manifest: Vec<u8>,
    package_media_urls: BTreeSet<String>,
}

fn package_manifest(manifest: Vec<u8>) -> Result<PreflightManifest, ApiError> {
    if !crate::world_transfer_package::is_package(&manifest) {
        return Ok(PreflightManifest {
            manifest,
            package_media_urls: BTreeSet::new(),
        });
    }
    let package = crate::world_transfer_package::read_package(manifest)
        .map_err(|_| ApiError::invalid_request())?;
    let package_media_urls = package
        .media
        .iter()
        .map(|media| media.source_url.clone())
        .collect();
    let manifest =
        serde_json::to_vec(&package.manifest).map_err(|_| ApiError::invalid_request())?;
    Ok(PreflightManifest {
        manifest,
        package_media_urls,
    })
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
