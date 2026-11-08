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
use wicked_learning_application::admin_sound::{AdminSoundCommand, AdminSoundError, SoundForm};
use wicked_learning_domain::world_content::AdminSound;
use wicked_learning_persistence::admin_sound::PostgresAdminSoundRepository;

use crate::{
    AppState,
    audio_upload::{MAX_AUDIO_BYTES, single_audio_upload},
    csrf,
    error::ApiError,
    identity::IdentityBackend,
    learner_route_run::authenticated_principal,
    media_store::MediaObjectKey,
};

#[derive(Deserialize)]
pub struct SoundQuery {
    q: Option<String>,
}

#[derive(Deserialize)]
pub struct SoundRequest {
    audio_asset_id: Option<Uuid>,
    icon: String,
    loop_enabled: bool,
    name: String,
    play_seconds: Option<f64>,
    slug: Option<String>,
    volume: f64,
}

#[derive(Serialize)]
pub struct SoundListResponse {
    pub sounds: Vec<AdminSound>,
}

#[derive(Serialize)]
pub struct SoundResponse {
    pub sound: AdminSound,
}

#[derive(Serialize)]
pub struct SoundMediaUploadResponse {
    pub asset_id: Uuid,
    pub url: String,
}

#[derive(FromRow)]
struct StoredAsset {
    object_key: String,
    content_type: String,
}

pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<SoundQuery>,
    session: AuthSession<IdentityBackend>,
) -> Result<Json<SoundListResponse>, ApiError> {
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminSoundRepository::new(&state.application_database);
    let mut sounds = AdminSoundCommand::new(&repository)
        .list(&principal)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    if let Some(query) = query
        .q
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if query.chars().count() > 120 {
            return Err(ApiError::invalid_request());
        }
        let query = query.to_ascii_lowercase();
        sounds.retain(|sound| {
            [
                sound.name.as_str(),
                sound.slug.as_str(),
                sound.icon.as_str(),
            ]
            .into_iter()
            .any(|value| value.to_ascii_lowercase().contains(&query))
        });
    }
    Ok(Json(SoundListResponse { sounds }))
}

pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<SoundRequest>,
) -> Result<(StatusCode, Json<SoundResponse>), ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let form = form(request)?;
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminSoundRepository::new(&state.application_database);
    let sound = AdminSoundCommand::new(&repository)
        .create(&principal, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((StatusCode::CREATED, Json(SoundResponse { sound })))
}

pub async fn update(
    State(state): State<AppState>,
    Path(sound_id): Path<Uuid>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<SoundRequest>,
) -> Result<Json<SoundResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let form = form(request)?;
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminSoundRepository::new(&state.application_database);
    let mutation = AdminSoundCommand::new(&repository)
        .update(&principal, sound_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    release_objects(&state, mutation.released_object_keys).await;
    Ok(Json(SoundResponse {
        sound: mutation.sound,
    }))
}

pub async fn delete(
    State(state): State<AppState>,
    Path(sound_id): Path<Uuid>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminSoundRepository::new(&state.application_database);
    let deleted = AdminSoundCommand::new(&repository)
        .delete(&principal, sound_id)
        .await
        .map_err(map_error)?;
    let deleted = deleted.ok_or_else(ApiError::not_found)?;
    release_objects(&state, deleted.released_object_keys).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn upload_media(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<SoundMediaUploadResponse>), ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let principal = authenticated_principal(&state, session).await?;
    if !principal.has_permission("sounds", "ru") {
        return Err(ApiError::not_found());
    }
    let upload = single_audio_upload(&mut multipart).await?;
    let byte_size = i32::try_from(upload.bytes.len()).map_err(|_| ApiError::invalid_request())?;
    let object_key = state
        .media_store
        .put(upload.bytes.into())
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let asset_id = Uuid::new_v4();
    let inserted = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO reusable_media_assets (id, created_by_principal_id, object_key, content_type, byte_size, display_name) SELECT $1, id, $3, $4, $5, 'Uploaded sound' FROM application_principals WHERE identity_subject_id = $2 RETURNING id",
    )
    .bind(asset_id)
    .bind(principal.subject_id)
    .bind(object_key.stored_value())
    .bind(upload.content_type)
    .bind(byte_size)
    .fetch_optional(&state.application_database)
    .await;
    match inserted {
        Ok(Some(asset_id)) => Ok((
            StatusCode::CREATED,
            Json(SoundMediaUploadResponse {
                asset_id,
                url: format!("/api/v1/admin/sounds/media/{asset_id}/content"),
            }),
        )),
        _ => {
            let _ = state.media_store.delete(&object_key).await;
            Err(ApiError::service_unavailable())
        }
    }
}

pub async fn admin_content(
    State(state): State<AppState>,
    Path(asset_id): Path<Uuid>,
    session: AuthSession<IdentityBackend>,
) -> Result<Response, ApiError> {
    let principal = authenticated_principal(&state, session).await?;
    if !principal.has_permission("sounds", "ro") {
        return Err(ApiError::not_found());
    }
    let stored = sqlx::query_as::<_, StoredAsset>(
        "SELECT object_key, content_type FROM reusable_media_assets WHERE id = $1 AND content_type LIKE 'audio/%'",
    )
    .bind(asset_id)
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;
    media_response(&state, stored, "private, max-age=3600").await
}

pub async fn delete_media(
    State(state): State<AppState>,
    Path(asset_id): Path<Uuid>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let principal = authenticated_principal(&state, session).await?;
    if !principal.has_permission("sounds", "rud") {
        return Err(ApiError::not_found());
    }
    let object_key = sqlx::query_scalar::<_, String>(
        "DELETE FROM reusable_media_assets WHERE id = $1 AND content_type LIKE 'audio/%' AND NOT EXISTS (SELECT 1 FROM reusable_media_asset_references WHERE asset_id = $1) RETURNING object_key",
    )
    .bind(asset_id)
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;
    release_objects(&state, vec![object_key]).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn public_content(
    State(state): State<AppState>,
    Path(sound_id): Path<Uuid>,
) -> Result<Response, ApiError> {
    let stored = sqlx::query_as::<_, StoredAsset>(
        "SELECT media.object_key, media.content_type FROM learning_sounds AS sounds INNER JOIN reusable_media_assets AS media ON media.id = sounds.audio_asset_id WHERE sounds.id = $1 AND sounds.published_at IS NOT NULL AND EXISTS (SELECT 1 FROM reusable_media_asset_references AS sound_references WHERE sound_references.asset_id = media.id AND sound_references.owner_kind = 'learning_sound' AND sound_references.owner_id = sounds.id AND sound_references.field_key = 'audio')",
    )
    .bind(sound_id)
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;
    media_response(&state, stored, "public, max-age=300").await
}

fn form(request: SoundRequest) -> Result<SoundForm, ApiError> {
    SoundForm::parse(
        &request.name,
        request.slug.as_deref(),
        &request.icon,
        request.volume,
        request.play_seconds,
        request.loop_enabled,
        request.audio_asset_id,
    )
    .ok_or_else(ApiError::invalid_request)
}

fn map_error(error: AdminSoundError) -> ApiError {
    match error {
        AdminSoundError::Invalid => ApiError::invalid_request(),
        AdminSoundError::Conflict => ApiError::conflict(),
        AdminSoundError::Unavailable => ApiError::service_unavailable(),
    }
}

async fn media_response(
    state: &AppState,
    stored: StoredAsset,
    cache_control: &'static str,
) -> Result<Response, ApiError> {
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
        header::CACHE_CONTROL,
        HeaderValue::from_static(cache_control),
    );
    Ok(response)
}

async fn release_objects(state: &AppState, object_keys: Vec<String>) {
    for object_key in object_keys {
        if let Some(object_key) = MediaObjectKey::from_stored_value(&object_key) {
            if let Err(error) = state.media_store.delete(&object_key).await {
                tracing::error!(%error, "could not remove released reusable sound bytes");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{SoundRequest, form};

    #[test]
    fn keeps_the_source_sound_fields_bounded_by_the_server_form() {
        let request: SoundRequest = serde_json::from_str(
            r#"{"name":"Signal chime","slug":"signal-chime","icon":"ui","volume":62,"play_seconds":null,"loop_enabled":false,"audio_asset_id":null}"#,
        )
        .expect("request");
        assert!(form(request).is_ok());
    }
}

pub const AUDIO_MULTIPART_BODY_LIMIT: usize = MAX_AUDIO_BYTES + 16 * 1024;
