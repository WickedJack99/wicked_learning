use axum::{
    Json,
    body::Body,
    extract::{Multipart, Path, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::Response,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use wicked_learning_application::admin_dialogue_typing_sound_set::{
    AdminDialogueTypingSoundSetCommand, AdminDialogueTypingSoundSetError,
    DialogueTypingSoundAssignment, DialogueTypingSoundSetForm,
};
use wicked_learning_domain::world_content::AdminDialogueTypingSoundSet;
use wicked_learning_persistence::admin_dialogue_typing_sound_set::PostgresAdminDialogueTypingSoundSetRepository;

use crate::{
    AppState,
    audio_upload::{MAX_AUDIO_BYTES, single_audio_upload},
    csrf,
    error::ApiError,
    identity::IdentityBackend,
    learner_route_run::authenticated_principal,
    media_store::MediaObjectKey,
};

pub const AUDIO_MULTIPART_BODY_LIMIT: usize = MAX_AUDIO_BYTES + 16 * 1024;

#[derive(Deserialize)]
pub struct SetRequest {
    is_default: bool,
    name: String,
    slug: String,
    sounds: Vec<SoundAssignmentRequest>,
    #[serde(default)]
    tags: Vec<String>,
}

#[derive(Deserialize)]
pub struct MetadataRequest {
    is_default: bool,
    name: String,
    slug: String,
    #[serde(default)]
    tags: Vec<String>,
}

#[derive(Deserialize)]
pub struct SoundAssignmentRequest {
    asset_id: Uuid,
    letter: String,
}

#[derive(Serialize)]
pub struct SetListResponse {
    pub sets: Vec<AdminDialogueTypingSoundSet>,
}

#[derive(Serialize)]
pub struct SetResponse {
    pub set: AdminDialogueTypingSoundSet,
}

#[derive(Serialize)]
pub struct SoundMediaUploadResponse {
    pub asset_id: Uuid,
    pub url: String,
}

#[derive(FromRow)]
struct StoredAsset {
    content_type: String,
    object_key: String,
}

pub async fn index(
    State(state): State<AppState>,
    session: AuthSession<IdentityBackend>,
) -> Result<Json<SetListResponse>, ApiError> {
    let principal = authenticated_principal(&state, session).await?;
    let repository =
        PostgresAdminDialogueTypingSoundSetRepository::new(&state.application_database);
    let sets = AdminDialogueTypingSoundSetCommand::new(&repository)
        .list(&principal)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(SetListResponse { sets }))
}

pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<SetRequest>,
) -> Result<(StatusCode, Json<SetResponse>), ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let form = set_form(
        &request.name,
        &request.slug,
        &request.tags,
        request.is_default,
    )?;
    let assignments = assignments(&request.sounds)?;
    let principal = authenticated_principal(&state, session).await?;
    let repository =
        PostgresAdminDialogueTypingSoundSetRepository::new(&state.application_database);
    let set = AdminDialogueTypingSoundSetCommand::new(&repository)
        .create(&principal, &form, &assignments)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((StatusCode::CREATED, Json(SetResponse { set })))
}

pub async fn update(
    State(state): State<AppState>,
    Path(set_id): Path<Uuid>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<MetadataRequest>,
) -> Result<Json<SetResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let form = set_form(
        &request.name,
        &request.slug,
        &request.tags,
        request.is_default,
    )?;
    let principal = authenticated_principal(&state, session).await?;
    let repository =
        PostgresAdminDialogueTypingSoundSetRepository::new(&state.application_database);
    let set = AdminDialogueTypingSoundSetCommand::new(&repository)
        .update(&principal, set_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(SetResponse { set }))
}

pub async fn replace_all(
    State(state): State<AppState>,
    Path(set_id): Path<Uuid>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<Vec<SoundAssignmentRequest>>,
) -> Result<Json<SetResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let assignments = assignments(&request)?;
    let principal = authenticated_principal(&state, session).await?;
    let repository =
        PostgresAdminDialogueTypingSoundSetRepository::new(&state.application_database);
    let mutation = AdminDialogueTypingSoundSetCommand::new(&repository)
        .replace_all(&principal, set_id, &assignments)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    release_objects(&state, mutation.released_object_keys).await;
    Ok(Json(SetResponse { set: mutation.set }))
}

pub async fn replace_letter(
    State(state): State<AppState>,
    Path((set_id, letter)): Path<(Uuid, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<SoundAssignmentRequest>,
) -> Result<Json<SetResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    if request.letter != letter {
        return Err(ApiError::invalid_request());
    }
    let assignment = DialogueTypingSoundAssignment::parse(&letter, request.asset_id)
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, session).await?;
    let repository =
        PostgresAdminDialogueTypingSoundSetRepository::new(&state.application_database);
    let mutation = AdminDialogueTypingSoundSetCommand::new(&repository)
        .replace_letter(&principal, set_id, &assignment)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    release_objects(&state, mutation.released_object_keys).await;
    Ok(Json(SetResponse { set: mutation.set }))
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
    if upload.content_type != "audio/wav" {
        return Err(ApiError::invalid_request());
    }
    let byte_size = i32::try_from(upload.bytes.len()).map_err(|_| ApiError::invalid_request())?;
    let object_key = state
        .media_store
        .put(upload.bytes.into())
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let asset_id = Uuid::new_v4();
    let inserted = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO reusable_media_assets (id, created_by_principal_id, object_key, content_type, byte_size, display_name) SELECT $1, id, $3, 'audio/wav', $4, 'Dialogue typing WAV' FROM application_principals WHERE identity_subject_id = $2 RETURNING id",
    )
    .bind(asset_id)
    .bind(principal.subject_id)
    .bind(object_key.stored_value())
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

/// Cancels only the caller's own unattached staging upload. This lets the
/// source whole-set form clean up a failed 26-file submission without granting
/// the wider `sounds.rud` library-delete capability.
pub async fn discard_media(
    State(state): State<AppState>,
    Path(asset_id): Path<Uuid>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let principal = authenticated_principal(&state, session).await?;
    if !principal.has_permission("sounds", "ru") {
        return Err(ApiError::not_found());
    }
    let object_key = sqlx::query_scalar::<_, String>(
        "DELETE FROM reusable_media_assets WHERE id = $1 AND content_type = 'audio/wav' AND created_by_principal_id = (SELECT id FROM application_principals WHERE identity_subject_id = $2) AND NOT EXISTS (SELECT 1 FROM reusable_media_asset_references WHERE asset_id = $1) RETURNING object_key",
    )
    .bind(asset_id)
    .bind(principal.subject_id)
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;
    release_objects(&state, vec![object_key]).await;
    Ok(StatusCode::NO_CONTENT)
}

/// A learner-visible route must still be authenticated and actively playing
/// the dialogue that resolves this configured/default set. The audio object is
/// delivered only while its sound record has the normalized managed reference;
/// bundled legacy URLs continue to work unchanged.
pub async fn learner_content(
    State(state): State<AppState>,
    Path(sound_id): Path<Uuid>,
    session: AuthSession<IdentityBackend>,
) -> Result<Response, ApiError> {
    let principal = authenticated_principal(&state, session).await?;
    let stored = sqlx::query_as::<_, StoredAsset>(
        "SELECT media.content_type, media.object_key FROM learning_dialogue_typing_sounds AS sounds INNER JOIN learning_dialogue_typing_sound_sets AS sets ON sets.id = sounds.sound_set_id INNER JOIN reusable_media_assets AS media ON media.id = sounds.audio_asset_id WHERE sounds.id = $1 AND EXISTS (SELECT 1 FROM reusable_media_asset_references AS sound_references WHERE sound_references.asset_id = media.id AND sound_references.owner_kind = 'dialogue_typing_sound' AND sound_references.owner_id = sounds.id AND sound_references.field_key = 'audio') AND EXISTS (SELECT 1 FROM application_principals AS principals INNER JOIN learner_route_progress AS progress ON progress.principal_id = principals.id INNER JOIN learning_npc_dialogue_nodes AS nodes ON nodes.activity_id = progress.current_activity_id WHERE principals.identity_subject_id = $2 AND progress.status = 'in_progress' AND nodes.node_config ->> 'typingSoundEnabled' = 'true' AND (nodes.node_config ->> 'typingSoundSetId' = sets.id::text OR (nodes.node_config ->> 'typingSoundSetId' IS NULL AND sets.is_default)) UNION SELECT 1 FROM application_principals AS principals INNER JOIN learner_activity_replay_runs AS runs ON runs.principal_id = principals.id INNER JOIN learning_npc_dialogue_nodes AS nodes ON nodes.activity_id = runs.activity_id WHERE principals.identity_subject_id = $2 AND runs.status = 'in_progress' AND nodes.node_config ->> 'typingSoundEnabled' = 'true' AND (nodes.node_config ->> 'typingSoundSetId' = sets.id::text OR (nodes.node_config ->> 'typingSoundSetId' IS NULL AND sets.is_default)))",
    )
    .bind(sound_id)
    .bind(principal.subject_id)
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;
    media_response(&state, stored).await
}

fn set_form(
    name: &str,
    slug: &str,
    tags: &[String],
    is_default: bool,
) -> Result<DialogueTypingSoundSetForm, ApiError> {
    DialogueTypingSoundSetForm::parse(name, slug, tags, is_default)
        .ok_or_else(ApiError::invalid_request)
}

fn assignments(
    requests: &[SoundAssignmentRequest],
) -> Result<Vec<DialogueTypingSoundAssignment>, ApiError> {
    requests
        .iter()
        .map(|request| {
            DialogueTypingSoundAssignment::parse(&request.letter, request.asset_id)
                .ok_or_else(ApiError::invalid_request)
        })
        .collect()
}

fn map_error(error: AdminDialogueTypingSoundSetError) -> ApiError {
    match error {
        AdminDialogueTypingSoundSetError::Conflict => ApiError::conflict(),
        AdminDialogueTypingSoundSetError::Invalid => ApiError::invalid_request(),
        AdminDialogueTypingSoundSetError::Unavailable => ApiError::service_unavailable(),
    }
}

async fn media_response(state: &AppState, stored: StoredAsset) -> Result<Response, ApiError> {
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
        HeaderValue::from_static("private, max-age=300"),
    );
    Ok(response)
}

async fn release_objects(state: &AppState, object_keys: Vec<String>) {
    for object_key in object_keys {
        if let Some(object_key) = MediaObjectKey::from_stored_value(&object_key)
            && let Err(error) = state.media_store.delete(&object_key).await
        {
            tracing::error!(%error, "could not remove released dialogue typing sound bytes");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{SetRequest, assignments, set_form};

    #[test]
    fn parses_the_source_shaped_complete_set_request() {
        let request: SetRequest = serde_json::from_str(
            r#"{"name":"Soft keys","slug":"soft-keys","tags":["dialogue","typing"],"is_default":true,"sounds":[{"letter":"a","asset_id":"00000000-0000-4000-8000-000000000001"}]}"#,
        )
        .expect("request");
        assert!(
            set_form(
                &request.name,
                &request.slug,
                &request.tags,
                request.is_default
            )
            .is_ok()
        );
        assert!(assignments(&request.sounds).is_ok());
    }
}
