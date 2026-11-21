use axum::{
    Json,
    body::Body,
    extract::{Multipart, Path, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::Response,
};
use axum_login::AuthSession;
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;
use wicked_learning_persistence::admin_world_map_visuals::can_edit_map_visuals;

use crate::{
    AppState, csrf,
    error::ApiError,
    identity::IdentityBackend,
    image_upload::{image_content_type, single_named_image_upload},
    learner_route_run::authenticated_principal,
};

/// Source Map Configuration accepts up to 50 MiB at its scoped
/// `/settings/worlds/node-images` endpoint, including Markdown video. Keep
/// binary-type detection server-side and generic image-library writes separate.
pub const MAX_MAP_VISUAL_BYTES: usize = 50 * 1024 * 1024;

#[derive(Serialize)]
pub struct UploadMapVisualResponse {
    pub url: String,
    pub preview_url: String,
}

#[derive(FromRow)]
struct CreatedAsset {
    id: Uuid,
}

#[derive(FromRow)]
struct StoredAsset {
    content_type: String,
    object_key: String,
}

#[derive(serde::Deserialize)]
pub struct DownloadQuery {
    download: Option<bool>,
}

/// Uploads a visual only after the caller has passed the same map-editor
/// authorization boundary as Map Configuration writes. The reusable-media
/// store remains the Rust transport implementation; the endpoint deliberately
/// does not grant generic asset-library upload authority.
pub async fn upload(
    State(state): State<AppState>,
    Path(map_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<UploadMapVisualResponse>), ApiError> {
    let map_id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    if !principal.has_permission("world_nodes", "ru")
        || !can_edit_map_visuals(&state.application_database, &principal, map_id)
            .await
            .map_err(|_| ApiError::service_unavailable())?
    {
        return Err(ApiError::not_found());
    }

    let bytes = single_named_image_upload(&mut multipart, "file", MAX_MAP_VISUAL_BYTES).await?;
    let content_type = image_content_type(&bytes)
        .or_else(|| crate::video_media::content_type(&bytes))
        .ok_or_else(ApiError::profile_image_rejected)?;
    let byte_size = i32::try_from(bytes.len()).map_err(|_| ApiError::profile_image_rejected())?;
    let object_key = state
        .media_store
        .put(bytes.into())
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let asset_id = Uuid::new_v4();
    let created = sqlx::query_as::<_, CreatedAsset>(
        "WITH inserted AS (INSERT INTO reusable_media_assets (id, created_by_principal_id, object_key, content_type, byte_size, display_name) SELECT $1, id, $3, $4, $5, 'Uploaded map visual' FROM application_principals WHERE identity_subject_id = $2 RETURNING id) INSERT INTO map_media_uploads(asset_id,map_id) SELECT id,$6 FROM inserted RETURNING asset_id AS id",
    )
    .bind(asset_id)
    .bind(principal.subject_id)
    .bind(object_key.stored_value())
    .bind(content_type)
    .bind(byte_size)
    .bind(map_id)
    .fetch_optional(&state.application_database)
    .await;

    match created {
        Ok(Some(asset)) => Ok((
            StatusCode::CREATED,
            Json(UploadMapVisualResponse {
                url: format!("/api/v1/admin/media-assets/{}/content", asset.id),
                preview_url: preview_url(map_id, asset.id),
            }),
        )),
        _ => {
            let _ = state.media_store.delete(&object_key).await;
            Err(ApiError::service_unavailable())
        }
    }
}

/// Serves an unsaved map-visual upload only to the same scoped editor that
/// created it. Once the source-derived form is saved, its adapter persists the
/// canonical reusable-media URL, so learner projections continue to use the
/// existing map-reference media authorization rather than this preview seam.
pub async fn preview(
    State(state): State<AppState>,
    Path((map_id, asset_id)): Path<(String, String)>,
    Query(query): Query<DownloadQuery>,
    headers: HeaderMap,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Response, ApiError> {
    let map_id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let asset_id = Uuid::parse_str(&asset_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    if !principal.has_permission("world_nodes", "ru")
        || !can_edit_map_visuals(&state.application_database, &principal, map_id)
            .await
            .map_err(|_| ApiError::service_unavailable())?
    {
        return Err(ApiError::not_found());
    }
    let stored = sqlx::query_as::<_, StoredAsset>(
        "SELECT media.object_key, media.content_type FROM reusable_media_assets AS media INNER JOIN application_principals AS principals ON principals.id = media.created_by_principal_id WHERE media.id = $1 AND principals.identity_subject_id = $2 AND (media.content_type LIKE 'image/%' OR media.content_type LIKE 'video/%') AND NOT EXISTS (SELECT 1 FROM map_media_uploads uploads WHERE uploads.asset_id=media.id AND uploads.map_id IS DISTINCT FROM $3)",
    )
    .bind(asset_id)
    .bind(principal.subject_id)
    .bind(map_id)
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;
    if stored.content_type.starts_with("video/") {
        let mut response = crate::video_media::response(
            &state,
            &stored.object_key,
            &stored.content_type,
            &headers,
        )
        .await?;
        if query.download.unwrap_or(false) {
            response.headers_mut().insert(
                header::CONTENT_DISPOSITION,
                HeaderValue::from_static("attachment"),
            );
        }
        return Ok(response);
    }
    let key = crate::media_store::MediaObjectKey::from_stored_value(&stored.object_key)
        .ok_or_else(ApiError::not_found)?;
    let bytes = state
        .media_store
        .get(&key)
        .await
        .map_err(|_| ApiError::not_found())?
        .bytes()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let mut response = Response::new(Body::from(bytes));
    let headers = response.headers_mut();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&stored.content_type)
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
        HeaderValue::from_static("private, max-age=300"),
    );
    if query.download.unwrap_or(false) {
        headers.insert(
            header::CONTENT_DISPOSITION,
            HeaderValue::from_static("attachment"),
        );
    }
    Ok(response)
}

pub async fn delete(
    State(state): State<AppState>,
    Path((map_id, asset_id)): Path<(Uuid, Uuid)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let principal = authenticated_principal(&state, session).await?;
    if !principal.has_permission("world_nodes", "ru")
        || !can_edit_map_visuals(&state.application_database, &principal, map_id)
            .await
            .map_err(|_| ApiError::service_unavailable())?
    {
        return Err(ApiError::not_found());
    }
    // Retain the registry entry when storage fails so cleanup can be retried.
    // Lock the asset while checking references and removing the object; foreign
    // key checks on newly saved references must wait for this transaction.
    let mut transaction = state
        .application_database
        .begin()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let key = sqlx::query_scalar::<_, String>("SELECT media.object_key FROM reusable_media_assets media JOIN map_media_uploads uploads ON uploads.asset_id=media.id JOIN application_principals principals ON principals.id=media.created_by_principal_id WHERE media.id=$1 AND uploads.map_id=$2 AND principals.identity_subject_id=$3 FOR UPDATE OF media")
        .bind(asset_id).bind(map_id).bind(principal.subject_id).fetch_optional(&mut *transaction).await.map_err(|_| ApiError::service_unavailable())?.ok_or_else(ApiError::not_found)?;
    // Use a fresh statement snapshot after acquiring the row lock, including
    // any reference committed while the lock acquisition was waiting.
    let referenced = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM reusable_media_asset_references WHERE asset_id=$1)",
    )
    .bind(asset_id)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|_| ApiError::service_unavailable())?;
    if referenced {
        return Err(ApiError::not_found());
    }
    let key = crate::media_store::MediaObjectKey::from_stored_value(&key)
        .ok_or_else(ApiError::internal_server_error)?;
    match state.media_store.delete(&key).await {
        Ok(())
        | Err(crate::media_store::MediaStoreError::ObjectStore(object_store::Error::NotFound {
            ..
        })) => {}
        Err(_) => return Err(ApiError::service_unavailable()),
    }
    sqlx::query("DELETE FROM reusable_media_assets WHERE id=$1")
        .bind(asset_id)
        .execute(&mut *transaction)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    transaction
        .commit()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(StatusCode::NO_CONTENT)
}

fn preview_url(map_id: Uuid, asset_id: Uuid) -> String {
    format!("/api/v1/admin/world-builder/maps/{map_id}/visual-media/{asset_id}/content")
}

#[cfg(test)]
mod tests {
    use super::MAX_MAP_VISUAL_BYTES;

    #[test]
    fn retains_the_source_map_visual_upload_limit() {
        assert_eq!(MAX_MAP_VISUAL_BYTES, 50 * 1024 * 1024);
    }

    #[test]
    fn keeps_unsaved_preview_paths_scoped_to_the_selected_map_and_media() {
        let map_id = uuid::Uuid::nil();
        let asset_id = uuid::Uuid::from_u128(1);
        assert_eq!(
            super::preview_url(map_id, asset_id),
            "/api/v1/admin/world-builder/maps/00000000-0000-0000-0000-000000000000/visual-media/00000000-0000-0000-0000-000000000001/content",
        );
    }
}
