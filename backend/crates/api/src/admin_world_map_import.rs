use axum::{
    Json,
    extract::{Multipart, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Serialize;
use uuid::Uuid;
use wicked_learning_application::{
    admin_world_map_create::CreateWorldMapForm,
    admin_world_map_import::{AdminWorldMapImportCommand, AdminWorldMapImportError},
};
use wicked_learning_persistence::admin_world_map_import::PostgresAdminWorldMapImportRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

const MAX_MANIFEST_BYTES: usize = 5 * 1024 * 1024;

#[derive(Serialize)]
pub struct ImportWorldMapResponse {
    pub map_id: Uuid,
}

/// Imports one preflight-compatible authored map manifest as a fresh draft in
/// the current World. The uploaded source never controls destination access.
pub async fn import(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    multipart: Multipart,
) -> Result<(StatusCode, Json<ImportWorldMapResponse>), ApiError> {
    let fields = fields(multipart).await?;
    let form = CreateWorldMapForm::parse(&fields.title, fields.slug.as_deref(), None)
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapImportRepository::new(&state.application_database);
    let map_id = AdminWorldMapImportCommand::new(&repository)
        .execute(&principal, &form, &fields.manifest)
        .await
        .map_err(|error| match error {
            AdminWorldMapImportError::Invalid => ApiError::invalid_request(),
            AdminWorldMapImportError::Unavailable => ApiError::service_unavailable(),
        })?
        .ok_or_else(ApiError::not_found)?;
    Ok((StatusCode::CREATED, Json(ImportWorldMapResponse { map_id })))
}

struct ImportFields {
    manifest: Vec<u8>,
    title: String,
    slug: Option<String>,
}

async fn fields(mut multipart: Multipart) -> Result<ImportFields, ApiError> {
    let mut manifest = None;
    let mut title = None;
    let mut slug = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| ApiError::invalid_request())?
    {
        match field.name() {
            Some("manifest") if manifest.is_none() => {
                let bytes = field
                    .bytes()
                    .await
                    .map_err(|_| ApiError::invalid_request())?;
                if bytes.is_empty() || bytes.len() > MAX_MANIFEST_BYTES {
                    return Err(ApiError::invalid_request());
                }
                manifest = Some(bytes.to_vec());
            }
            Some("title") if title.is_none() => {
                title = Some(
                    field
                        .text()
                        .await
                        .map_err(|_| ApiError::invalid_request())?,
                );
            }
            Some("slug") if slug.is_none() => {
                slug = Some(
                    field
                        .text()
                        .await
                        .map_err(|_| ApiError::invalid_request())?,
                );
            }
            _ => return Err(ApiError::invalid_request()),
        }
    }
    Ok(ImportFields {
        manifest: manifest.ok_or_else(ApiError::invalid_request)?,
        title: title.ok_or_else(ApiError::invalid_request)?,
        slug,
    })
}
