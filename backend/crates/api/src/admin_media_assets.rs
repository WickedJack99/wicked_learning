use axum::{
    Json,
    body::Body,
    extract::{Multipart, Path, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::Response,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    AppState, csrf,
    error::ApiError,
    identity::IdentityBackend,
    image_upload::{image_content_type, single_image_upload},
    learner_route_run::authenticated_principal,
    media_store::MediaObjectKey,
};

const DEFAULT_PAGE_SIZE: i64 = 12;
const MAX_PAGE_SIZE: i64 = 12;

#[derive(Deserialize)]
pub struct AssetQuery {
    page: Option<i64>,
    per_page: Option<i64>,
    q: Option<String>,
    tag: Option<String>,
}

#[derive(Deserialize)]
pub struct DownloadQuery {
    download: Option<bool>,
}

#[derive(Deserialize)]
pub struct MetadataRequest {
    display_name: Option<String>,
    category: Option<String>,
    tags: Option<Vec<String>>,
    has_transparency: Option<bool>,
    is_animated: Option<bool>,
}

#[derive(Serialize)]
pub struct AssetPage {
    pub items: Vec<Asset>,
    pub pagination: AssetPagination,
}

#[derive(Serialize)]
pub struct AssetPagination {
    pub page: i64,
    pub per_page: i64,
    pub total: i64,
    pub last_page: i64,
}

#[derive(Serialize)]
pub struct AssetResponse {
    pub asset: Asset,
}

#[derive(Serialize)]
pub struct Asset {
    pub id: Uuid,
    pub can_delete: bool,
    pub can_view_path: bool,
    pub category: Option<String>,
    pub content_type: String,
    pub display_name: String,
    pub has_transparency: Option<bool>,
    pub is_animated: Option<bool>,
    pub reference_count: i64,
    pub reference_groups: Vec<AssetReferenceGroup>,
    pub tags: Vec<String>,
    pub updated_at: String,
    pub url: String,
}

#[derive(Serialize)]
pub struct AssetReferenceGroup {
    pub count: i64,
    pub label: String,
}

#[derive(FromRow)]
struct AssetRow {
    id: Uuid,
    #[allow(dead_code)]
    object_key: String,
    content_type: String,
    display_name: Option<String>,
    category: Option<String>,
    tags: Vec<String>,
    has_transparency: Option<bool>,
    is_animated: Option<bool>,
    updated_at: String,
    reference_count: i64,
}

#[derive(FromRow)]
struct StoredAsset {
    object_key: String,
    content_type: String,
}

pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<AssetQuery>,
    session: AuthSession<IdentityBackend>,
) -> Result<Json<AssetPage>, ApiError> {
    let principal = authenticated_principal(&state, session).await?;
    if !principal.has_permission("assets", "ro") {
        return Err(ApiError::not_found());
    }
    let page = query.page.unwrap_or(1);
    let per_page = query.per_page.unwrap_or(DEFAULT_PAGE_SIZE);
    let search = bounded(query.q.as_deref(), 120)?;
    let tag = bounded(query.tag.as_deref(), 40)?;
    if page < 1 || !(1..=MAX_PAGE_SIZE).contains(&per_page) {
        return Err(ApiError::invalid_request());
    }
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM reusable_media_assets WHERE content_type LIKE 'image/%' AND ($1::text IS NULL OR coalesce(display_name, '') ILIKE '%' || $1 || '%' OR coalesce(category, '') ILIKE '%' || $1 || '%' OR array_to_string(tags, ' ') ILIKE '%' || $1 || '%') AND ($2::text IS NULL OR $2 = ANY(tags))",
    )
    .bind(search.as_deref())
    .bind(tag.as_deref())
    .fetch_one(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?;
    let offset = (page - 1) * per_page;
    let rows = sqlx::query_as::<_, AssetRow>(
        "SELECT assets.id, assets.object_key, assets.content_type, assets.display_name, assets.category, assets.tags, assets.has_transparency, assets.is_animated, to_char(assets.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at, (SELECT COUNT(*) FROM reusable_media_asset_references AS media_references WHERE media_references.asset_id = assets.id)::bigint AS reference_count FROM reusable_media_assets AS assets WHERE assets.content_type LIKE 'image/%' AND ($1::text IS NULL OR coalesce(assets.display_name, '') ILIKE '%' || $1 || '%' OR coalesce(assets.category, '') ILIKE '%' || $1 || '%' OR array_to_string(assets.tags, ' ') ILIKE '%' || $1 || '%') AND ($2::text IS NULL OR $2 = ANY(assets.tags)) ORDER BY assets.updated_at DESC, assets.id DESC LIMIT $3 OFFSET $4",
    )
    .bind(search.as_deref())
    .bind(tag.as_deref())
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?;
    let can_delete = principal.has_permission("assets", "rud");
    let can_view_path = principal.has_permission("media_paths", "ro");
    Ok(Json(AssetPage {
        items: rows
            .into_iter()
            .map(|row| asset(row, can_delete, can_view_path))
            .collect(),
        pagination: AssetPagination {
            page,
            per_page,
            total,
            last_page: (total + per_page - 1).max(1) / per_page,
        },
    }))
}

pub async fn upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<AssetResponse>), ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let principal = authenticated_principal(&state, session).await?;
    if !principal.has_permission("assets", "ru") {
        return Err(ApiError::not_found());
    }
    let bytes = single_image_upload(&mut multipart).await?;
    let content_type = image_content_type(&bytes).ok_or_else(ApiError::profile_image_rejected)?;
    let byte_size = i32::try_from(bytes.len()).map_err(|_| ApiError::profile_image_rejected())?;
    let object_key = state
        .media_store
        .put(bytes.into())
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let id = Uuid::new_v4();
    let row = sqlx::query_as::<_, AssetRow>(
        "INSERT INTO reusable_media_assets (id, created_by_principal_id, object_key, content_type, byte_size, display_name) SELECT $1, id, $3, $4, $5, 'Uploaded visual' FROM application_principals WHERE identity_subject_id = $2 RETURNING id, object_key, content_type, display_name, category, tags, has_transparency, is_animated, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at, 0::bigint AS reference_count",
    )
    .bind(id).bind(principal.subject_id).bind(object_key.stored_value()).bind(content_type).bind(byte_size)
    .fetch_optional(&state.application_database).await;
    match row {
        Ok(Some(row)) => Ok((
            StatusCode::CREATED,
            Json(AssetResponse {
                asset: asset(
                    row,
                    principal.has_permission("assets", "rud"),
                    principal.has_permission("media_paths", "ro"),
                ),
            }),
        )),
        _ => {
            let _ = state.media_store.delete(&object_key).await;
            Err(ApiError::service_unavailable())
        }
    }
}

pub async fn update_metadata(
    State(state): State<AppState>,
    Path(asset_id): Path<Uuid>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<MetadataRequest>,
) -> Result<Json<AssetResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let principal = authenticated_principal(&state, session).await?;
    if !principal.has_permission("assets", "ru") {
        return Err(ApiError::not_found());
    }
    let metadata = validated_metadata(request)?;
    let row = sqlx::query_as::<_, AssetRow>(
        "UPDATE reusable_media_assets SET display_name = $2, category = $3, tags = $4, has_transparency = $5, is_animated = $6, updated_at = NOW() WHERE id = $1 AND content_type LIKE 'image/%' RETURNING id, object_key, content_type, display_name, category, tags, has_transparency, is_animated, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at, (SELECT COUNT(*) FROM reusable_media_asset_references WHERE asset_id = reusable_media_assets.id)::bigint AS reference_count",
    ).bind(asset_id).bind(metadata.0).bind(metadata.1).bind(metadata.2).bind(metadata.3).bind(metadata.4).fetch_optional(&state.application_database).await.map_err(|_| ApiError::service_unavailable())?.ok_or_else(ApiError::not_found)?;
    Ok(Json(AssetResponse {
        asset: asset(
            row,
            principal.has_permission("assets", "rud"),
            principal.has_permission("media_paths", "ro"),
        ),
    }))
}

pub async fn replace(
    State(state): State<AppState>,
    Path(asset_id): Path<Uuid>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    mut multipart: Multipart,
) -> Result<Json<AssetResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let principal = authenticated_principal(&state, session).await?;
    if !principal.has_permission("assets", "ru") {
        return Err(ApiError::not_found());
    }
    let bytes = single_image_upload(&mut multipart).await?;
    let content_type = image_content_type(&bytes).ok_or_else(ApiError::profile_image_rejected)?;
    let byte_size = i32::try_from(bytes.len()).map_err(|_| ApiError::profile_image_rejected())?;
    let new_key = state
        .media_store
        .put(bytes.into())
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let previous = sqlx::query_as::<_, StoredAsset>(
        "SELECT object_key, content_type FROM reusable_media_assets WHERE id = $1 AND content_type LIKE 'image/%' FOR UPDATE",
    )
    .bind(asset_id)
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?;
    let Some(previous) = previous else {
        let _ = state.media_store.delete(&new_key).await;
        return Err(ApiError::not_found());
    };
    let row = sqlx::query_as::<_, AssetRow>("UPDATE reusable_media_assets SET object_key = $2, content_type = $3, byte_size = $4, updated_at = NOW() WHERE id = $1 AND content_type LIKE 'image/%' RETURNING id, object_key, content_type, display_name, category, tags, has_transparency, is_animated, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at, (SELECT COUNT(*) FROM reusable_media_asset_references WHERE asset_id = reusable_media_assets.id)::bigint AS reference_count").bind(asset_id).bind(new_key.stored_value()).bind(content_type).bind(byte_size).fetch_one(&state.application_database).await;
    match row {
        Ok(row) => {
            if let Some(old) = MediaObjectKey::from_stored_value(&previous.object_key) {
                let _ = state.media_store.delete(&old).await;
            }
            Ok(Json(AssetResponse {
                asset: asset(
                    row,
                    principal.has_permission("assets", "rud"),
                    principal.has_permission("media_paths", "ro"),
                ),
            }))
        }
        Err(_) => {
            let _ = state.media_store.delete(&new_key).await;
            Err(ApiError::service_unavailable())
        }
    }
}

pub async fn delete(
    State(state): State<AppState>,
    Path(asset_id): Path<Uuid>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let principal = authenticated_principal(&state, session).await?;
    if !principal.has_permission("assets", "rud") {
        return Err(ApiError::not_found());
    }
    let previous = sqlx::query_scalar::<_, String>("DELETE FROM reusable_media_assets WHERE id = $1 AND content_type LIKE 'image/%' AND NOT EXISTS (SELECT 1 FROM reusable_media_asset_references WHERE asset_id = $1) RETURNING object_key").bind(asset_id).fetch_optional(&state.application_database).await.map_err(|_| ApiError::service_unavailable())?.ok_or_else(ApiError::not_found)?;
    if let Some(key) = MediaObjectKey::from_stored_value(&previous) {
        let _ = state.media_store.delete(&key).await;
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn content(
    State(state): State<AppState>,
    Path(asset_id): Path<Uuid>,
    Query(query): Query<DownloadQuery>,
    session: AuthSession<IdentityBackend>,
) -> Result<Response, ApiError> {
    let principal = authenticated_principal(&state, session).await?;
    if !principal.has_permission("assets", "ro") {
        return Err(ApiError::not_found());
    }
    let stored = sqlx::query_as::<_, StoredAsset>(
        "SELECT object_key, content_type FROM reusable_media_assets WHERE id = $1 AND content_type LIKE 'image/%'",
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
        HeaderValue::from_static("private, max-age=3600"),
    );
    if query.download.unwrap_or(false) {
        headers.insert(
            header::CONTENT_DISPOSITION,
            HeaderValue::from_static("attachment"),
        );
    }
    Ok(response)
}

fn asset(row: AssetRow, can_delete: bool, can_view_path: bool) -> Asset {
    Asset {
        id: row.id,
        can_delete,
        can_view_path,
        category: row.category,
        content_type: row.content_type,
        display_name: row
            .display_name
            .unwrap_or_else(|| "Uploaded visual".to_owned()),
        has_transparency: row.has_transparency,
        is_animated: row.is_animated,
        reference_count: row.reference_count,
        reference_groups: Vec::new(),
        tags: row.tags,
        updated_at: row.updated_at,
        url: format!("/api/v1/admin/media-assets/{}/content", row.id),
    }
}

fn bounded(value: Option<&str>, maximum: usize) -> Result<Option<String>, ApiError> {
    let value = value.map(str::trim).filter(|value| !value.is_empty());
    if value.is_some_and(|value| value.chars().count() > maximum) {
        return Err(ApiError::invalid_request());
    }
    Ok(value.map(ToOwned::to_owned))
}

type ValidatedMetadata = (
    Option<String>,
    Option<String>,
    Vec<String>,
    Option<bool>,
    Option<bool>,
);
fn validated_metadata(request: MetadataRequest) -> Result<ValidatedMetadata, ApiError> {
    let display_name = bounded(request.display_name.as_deref(), 160)?;
    let category = bounded(request.category.as_deref(), 80)?;
    let tags = request
        .tags
        .unwrap_or_default()
        .into_iter()
        .map(|tag| bounded(Some(&tag), 40))
        .collect::<Result<Vec<_>, _>>()?;
    if tags.len() > 12 || tags.iter().any(Option::is_none) {
        return Err(ApiError::invalid_request());
    }
    let tags = tags.into_iter().flatten().collect();
    Ok((
        display_name,
        category,
        tags,
        request.has_transparency,
        request.is_animated,
    ))
}

#[cfg(test)]
mod tests {
    use super::{MetadataRequest, validated_metadata};
    #[test]
    fn metadata_is_bounded_like_the_source_asset_workflow() {
        assert!(
            validated_metadata(MetadataRequest {
                display_name: Some("A visual".into()),
                category: Some("Scenes".into()),
                tags: vec!["forest".into(), "night".into()].into(),
                has_transparency: Some(true),
                is_animated: None
            })
            .is_ok()
        );
        assert!(
            validated_metadata(MetadataRequest {
                display_name: None,
                category: None,
                tags: Some((0..13).map(|index| index.to_string()).collect()),
                has_transparency: None,
                is_animated: None
            })
            .is_err()
        );
    }
}
