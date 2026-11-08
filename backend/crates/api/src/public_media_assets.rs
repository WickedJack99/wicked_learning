use axum::{
    body::Body,
    extract::{Path, State},
    http::{HeaderValue, header},
    response::Response,
};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{AppState, error::ApiError, media_store::MediaObjectKey};

#[derive(FromRow)]
struct StoredAsset {
    object_key: String,
    content_type: String,
}

/// A reusable visual is anonymous-public only when the saved, platform-owned
/// public presentation currently references it. Other library visuals retain
/// their existing protected delivery policy.
pub async fn content(
    State(state): State<AppState>,
    Path(asset_id): Path<Uuid>,
) -> Result<Response, ApiError> {
    let stored = sqlx::query_as::<_, StoredAsset>(
        "SELECT media.object_key, media.content_type FROM reusable_media_assets AS media WHERE media.id = $1 AND EXISTS (SELECT 1 FROM reusable_media_asset_references AS media_references WHERE media_references.asset_id = media.id AND media_references.owner_kind = 'public_presentation')",
    )
    .bind(asset_id)
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;
    let key =
        MediaObjectKey::from_stored_value(&stored.object_key).ok_or_else(ApiError::not_found)?;
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
        HeaderValue::from_static("public, max-age=300"),
    );
    Ok(response)
}
