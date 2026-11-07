use axum::{
    Json,
    body::Body,
    extract::{Multipart, Path, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::Response,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    AppState, csrf,
    error::ApiError,
    identity::IdentityBackend,
    image_upload::{image_content_type, single_image_upload},
    media_store::MediaObjectKey,
};

#[derive(Serialize)]
pub struct UploadResponse {
    pub url: String,
}
#[derive(Deserialize)]
pub struct ReportRequest {
    pub reason: Option<String>,
}

pub async fn upload(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth.user.ok_or_else(ApiError::authentication_required)?;
    let file = single_image_upload(&mut multipart).await?;
    let content_type = image_content_type(&file).ok_or_else(ApiError::profile_image_rejected)?;
    let byte_size = i32::try_from(file.len()).map_err(|_| ApiError::profile_image_rejected())?;
    let object_key = state
        .media_store
        .put(file.into())
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let icon_id = Uuid::new_v4();
    let result = save_icon(
        &state.application_database,
        subject.subject_id(),
        &slug,
        icon_id,
        &object_key.stored_value(),
        content_type,
        byte_size,
    )
    .await;
    if result.is_err() {
        let _ = state.media_store.delete(&object_key).await;
    }
    let replaced_object_key = result?;
    if let Some(replaced_object_key) = replaced_object_key {
        if let Some(replaced_object_key) = MediaObjectKey::from_stored_value(&replaced_object_key) {
            let _ = state.media_store.delete(&replaced_object_key).await;
        }
    }
    Ok(Json(UploadResponse {
        url: format!("/api/v1/organization-icons/{icon_id}"),
    }))
}

pub async fn show(
    State(state): State<AppState>,
    Path(icon_id): Path<Uuid>,
    auth: AuthSession<IdentityBackend>,
) -> Result<Response, ApiError> {
    auth.user.ok_or_else(ApiError::authentication_required)?;
    let icon = sqlx::query_as::<_, (String, String)>("SELECT object_key, content_type FROM organization_icons WHERE id = $1 AND EXISTS (SELECT 1 FROM organizations WHERE icon_id = organization_icons.id)")
        .bind(icon_id).fetch_optional(&state.application_database).await.map_err(|_| ApiError::service_unavailable())?.ok_or_else(ApiError::not_found)?;
    let key = MediaObjectKey::from_stored_value(&icon.0).ok_or_else(ApiError::not_found)?;
    let bytes = state
        .media_store
        .get(&key)
        .await
        .map_err(|_| ApiError::not_found())?
        .bytes()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let mut response = Response::new(Body::from(bytes));
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&icon.1).map_err(|_| ApiError::internal_server_error())?,
    );
    response.headers_mut().insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    response.headers_mut().insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(
            "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
        ),
    );
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=3600"),
    );
    Ok(response)
}

pub async fn report(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
    Json(request): Json<ReportRequest>,
) -> Result<StatusCode, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth.user.ok_or_else(ApiError::authentication_required)?;
    let reason = request
        .reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if reason.is_some_and(|value| value.chars().count() > 1000) {
        return Err(ApiError::invalid_request());
    }
    let inserted = sqlx::query("INSERT INTO organization_icon_reports (id, organization_id, reported_by_principal_id, icon_id, icon_set_by_principal_id, icon_object_key, reason) SELECT $1, organizations.id, reporter.id, organization_icons.id, organizations.icon_set_by_principal_id, organization_icons.object_key, $4 FROM organizations JOIN application_principals AS reporter ON reporter.identity_subject_id = $2 JOIN organization_icons ON organization_icons.id = organizations.icon_id WHERE organizations.slug = $3")
        .bind(Uuid::new_v4()).bind(subject.subject_id()).bind(&slug).bind(reason).execute(&state.application_database).await.map_err(|_| ApiError::service_unavailable())?;
    if inserted.rows_affected() != 1 {
        return Err(ApiError::not_found());
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn save_icon(
    pool: &PgPool,
    subject_id: Uuid,
    slug: &str,
    icon_id: Uuid,
    object_key: &str,
    content_type: &str,
    byte_size: i32,
) -> Result<Option<String>, ApiError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let owner = sqlx::query_as::<_, (Uuid, Uuid)>("SELECT organizations.id, principals.id FROM organizations JOIN application_principals AS principals ON principals.identity_subject_id = $1 WHERE organizations.slug = $2 AND EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = organizations.id AND principal_id = principals.id AND role = 'leader') FOR UPDATE")
        .bind(subject_id).bind(slug).fetch_optional(&mut *tx).await.map_err(|_| ApiError::service_unavailable())?.ok_or_else(ApiError::not_found)?;
    let replaced_object_key = sqlx::query_scalar::<_, String>(
        "SELECT object_key FROM organization_icons WHERE organization_id = $1",
    )
    .bind(owner.0)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| ApiError::service_unavailable())?;
    sqlx::query("UPDATE organizations SET icon_id = NULL WHERE id = $1")
        .bind(owner.0)
        .execute(&mut *tx)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    sqlx::query("DELETE FROM organization_icons WHERE organization_id = $1")
        .bind(owner.0)
        .execute(&mut *tx)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    sqlx::query("INSERT INTO organization_icons (id, organization_id, object_key, content_type, byte_size) VALUES ($1, $2, $3, $4, $5)").bind(icon_id).bind(owner.0).bind(object_key).bind(content_type).bind(byte_size).execute(&mut *tx).await.map_err(|_| ApiError::service_unavailable())?;
    sqlx::query("UPDATE organizations SET icon_id = $2, icon_set_by_principal_id = $3, updated_at = NOW() WHERE id = $1").bind(owner.0).bind(icon_id).bind(owner.1).execute(&mut *tx).await.map_err(|_| ApiError::service_unavailable())?;
    tx.commit()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(replaced_object_key)
}
