use axum::{
    Json,
    body::Body,
    extract::{Multipart, Path, State},
    http::{HeaderMap, HeaderValue, header},
    response::Response,
};
use axum_login::AuthSession;
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend, media_store::MediaObjectKey,
};

pub const MAX_PROFILE_IMAGE_BYTES: usize = 5 * 1024 * 1024;

#[derive(Serialize)]
pub struct ProfileImageUploadResponse {
    pub profile_image_id: Uuid,
    pub url: String,
}

pub async fn upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    mut multipart: Multipart,
) -> Result<Json<ProfileImageUploadResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth_session
        .user
        .ok_or_else(ApiError::authentication_required)?;
    let principal_id = principal_id(&state.application_database, subject.subject_id()).await?;
    let file = single_upload(&mut multipart).await?;
    let content_type =
        profile_image_content_type(&file).ok_or_else(ApiError::profile_image_rejected)?;
    let byte_size = i32::try_from(file.len()).map_err(|_| ApiError::profile_image_rejected())?;

    let object_key = state
        .media_store
        .put(file.into())
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let profile_image_id = Uuid::new_v4();
    let inserted = sqlx::query(
        "INSERT INTO application_profile_images (id, principal_id, object_key, content_type, byte_size) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(profile_image_id)
    .bind(principal_id)
    .bind(object_key.stored_value())
    .bind(content_type)
    .bind(byte_size)
    .execute(&state.application_database)
    .await;
    if inserted.is_err() {
        let _ = state.media_store.delete(&object_key).await;
        return Err(ApiError::service_unavailable());
    }

    Ok(Json(ProfileImageUploadResponse {
        profile_image_id,
        url: profile_image_url(profile_image_id),
    }))
}

pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
    Path(profile_image_id): Path<Uuid>,
) -> Result<Response, ApiError> {
    let subject = auth_session
        .user
        .ok_or_else(ApiError::authentication_required)?;
    let image = sqlx::query_as::<_, StoredProfileImage>(
        "SELECT images.object_key, images.content_type, \
         EXISTS (SELECT 1 FROM application_public_profiles AS profiles WHERE profiles.profile_image_id = images.id) AS is_attached \
         FROM application_profile_images AS images \
         WHERE images.id = $1 AND (images.principal_id = (SELECT id FROM application_principals WHERE identity_subject_id = $2) \
             OR EXISTS (SELECT 1 FROM application_public_profiles AS profiles WHERE profiles.profile_image_id = images.id))",
    )
    .bind(profile_image_id)
    .bind(subject.subject_id())
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;
    let object_key =
        MediaObjectKey::from_stored_value(&image.object_key).ok_or_else(ApiError::not_found)?;
    let bytes = state
        .media_store
        .get(&object_key)
        .await
        .map_err(|_| ApiError::not_found())?
        .bytes()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let mut response = Response::new(Body::from(bytes));
    let headers = response.headers_mut();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&image.content_type)
            .map_err(|_| ApiError::internal_server_error())?,
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(
            "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
        ),
    );
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(if image.is_attached {
            "private, max-age=3600"
        } else {
            "no-store"
        }),
    );
    Ok(response)
}

async fn single_upload(multipart: &mut Multipart) -> Result<Vec<u8>, ApiError> {
    let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| ApiError::profile_image_rejected())?
    else {
        return Err(ApiError::profile_image_rejected());
    };
    if field.name() != Some("file") {
        return Err(ApiError::profile_image_rejected());
    }
    let bytes = field
        .bytes()
        .await
        .map_err(|_| ApiError::profile_image_rejected())?;
    if bytes.is_empty() || bytes.len() > MAX_PROFILE_IMAGE_BYTES {
        return Err(ApiError::profile_image_rejected());
    }
    if multipart
        .next_field()
        .await
        .map_err(|_| ApiError::profile_image_rejected())?
        .is_some()
    {
        return Err(ApiError::profile_image_rejected());
    }
    Ok(bytes.to_vec())
}

fn profile_image_content_type(bytes: &[u8]) -> Option<&'static str> {
    match infer::get(bytes).map(|kind| kind.mime_type()) {
        Some("image/gif") => Some("image/gif"),
        Some("image/jpeg") => Some("image/jpeg"),
        Some("image/png") => Some("image/png"),
        Some("image/webp") => Some("image/webp"),
        _ if looks_like_svg(bytes) => Some("image/svg+xml"),
        _ => None,
    }
}

fn looks_like_svg(bytes: &[u8]) -> bool {
    let Ok(prefix) = std::str::from_utf8(&bytes[..bytes.len().min(1024)]) else {
        return false;
    };
    let prefix = prefix.trim_start_matches(['\u{feff}', ' ', '\n', '\r', '\t']);
    prefix.starts_with("<svg") || (prefix.starts_with("<?xml") && prefix.contains("<svg"))
}

async fn principal_id(application_database: &PgPool, subject_id: Uuid) -> Result<Uuid, ApiError> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(subject_id)
        .fetch_optional(application_database)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::forbidden)
}

fn profile_image_url(profile_image_id: Uuid) -> String {
    format!("/api/v1/profile-images/{profile_image_id}")
}

#[derive(sqlx::FromRow)]
struct StoredProfileImage {
    object_key: String,
    content_type: String,
    is_attached: bool,
}

#[cfg(test)]
mod tests {
    use super::{MAX_PROFILE_IMAGE_BYTES, looks_like_svg, profile_image_content_type};

    #[test]
    fn only_accepts_source_image_formats_after_byte_inspection() {
        assert_eq!(profile_image_content_type(b"GIF89a"), Some("image/gif"));
        assert_eq!(
            profile_image_content_type(b"\x89PNG\r\n\x1a\n"),
            Some("image/png")
        );
        assert_eq!(profile_image_content_type(b"not an image"), None);
        assert!(looks_like_svg(
            b"\xef\xbb\xbf <svg xmlns='http://www.w3.org/2000/svg'/>"
        ));
        assert_eq!(MAX_PROFILE_IMAGE_BYTES, 5_242_880);
    }
}
