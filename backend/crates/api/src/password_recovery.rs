use std::str::FromStr;

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use email_address::EmailAddress;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{AppState, csrf, error::ApiError, passwords};

const MAX_EMAIL_BYTES: usize = 320;
const MAX_PASSWORD_BYTES: usize = 1_024;
const MAX_TOKEN_BYTES: usize = 128;
const PASSWORD_RESET_EXPIRY_SECONDS: i64 = 60 * 60;
const PASSWORD_RESET_THROTTLE_SECONDS: i64 = 60;

#[derive(Deserialize)]
pub struct RequestPasswordResetLinkRequest {
    email: String,
}

#[derive(Deserialize)]
pub struct ResetPasswordRequest {
    email: String,
    password: String,
    password_confirmation: String,
    token: String,
}

#[derive(Serialize)]
pub struct PasswordResetLinkResponse {
    message: &'static str,
}

#[derive(FromRow)]
struct PasswordResetRow {
    subject_id: Uuid,
    token_hash: String,
}

pub async fn request_link(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    Json(request): Json<RequestPasswordResetLinkRequest>,
) -> Result<Json<PasswordResetLinkResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let normalized_email =
        normalize_email(&request.email).ok_or_else(ApiError::password_reset_request_rejected)?;
    let mut transaction = state
        .identity_database
        .begin()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let subject_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT subjects.id FROM identity_subjects AS subjects \
         INNER JOIN identity_password_credentials AS credentials ON credentials.subject_id = subjects.id \
         WHERE subjects.normalized_email = $1 AND subjects.status <> 'deleting' \
         FOR UPDATE OF subjects",
    )
    .bind(&normalized_email)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::password_reset_request_rejected)?;
    let is_throttled = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM identity_password_reset_tokens \
         WHERE subject_id = $1 \
           AND created_at > NOW() - ($2::bigint * INTERVAL '1 second'))",
    )
    .bind(subject_id)
    .bind(PASSWORD_RESET_THROTTLE_SECONDS)
    .fetch_one(&mut *transaction)
    .await
    .map_err(|_| ApiError::service_unavailable())?;
    if is_throttled {
        return Err(ApiError::too_many_requests());
    }

    let token = Uuid::new_v4().simple().to_string();
    let token_hash = passwords::hash(&token).map_err(|_| ApiError::service_unavailable())?;
    sqlx::query(
        "INSERT INTO identity_password_reset_tokens (subject_id, token_hash, expires_at) \
         VALUES ($1, $2, NOW() + ($3::bigint * INTERVAL '1 second')) \
         ON CONFLICT (subject_id) DO UPDATE \
         SET token_hash = EXCLUDED.token_hash, created_at = NOW(), expires_at = EXCLUDED.expires_at",
    )
    .bind(subject_id)
    .bind(token_hash)
    .bind(PASSWORD_RESET_EXPIRY_SECONDS)
    .execute(&mut *transaction)
    .await
    .map_err(|_| ApiError::service_unavailable())?;
    transaction
        .commit()
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    state
        .email_delivery
        .send_password_reset(&normalized_email, &token)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(Json(PasswordResetLinkResponse {
        message: "We have emailed your password reset link.",
    }))
}

pub async fn reset(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    Json(request): Json<ResetPasswordRequest>,
) -> Result<StatusCode, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let normalized_email =
        normalize_email(&request.email).ok_or_else(ApiError::password_reset_rejected)?;
    if !is_valid_reset_request(&request) {
        return Err(ApiError::password_reset_rejected());
    }
    let mut transaction = state
        .identity_database
        .begin()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let reset = sqlx::query_as::<_, PasswordResetRow>(
        "SELECT reset.subject_id, reset.token_hash \
         FROM identity_password_reset_tokens AS reset \
         INNER JOIN identity_subjects AS subjects ON subjects.id = reset.subject_id \
         INNER JOIN identity_password_credentials AS credentials ON credentials.subject_id = subjects.id \
         WHERE subjects.normalized_email = $1 \
           AND subjects.status <> 'deleting' \
           AND reset.expires_at >= NOW() \
         FOR UPDATE OF reset, credentials",
    )
    .bind(normalized_email)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::password_reset_rejected)?;
    if !passwords::verify(&request.token, &reset.token_hash)
        .map_err(|_| ApiError::service_unavailable())?
    {
        return Err(ApiError::password_reset_rejected());
    }
    let password_hash =
        passwords::hash(&request.password).map_err(|_| ApiError::password_reset_rejected())?;
    sqlx::query(
        "UPDATE identity_password_credentials SET password_hash = $2, updated_at = NOW() WHERE subject_id = $1",
    )
    .bind(reset.subject_id)
    .bind(password_hash)
    .execute(&mut *transaction)
    .await
    .map_err(|_| ApiError::service_unavailable())?;
    sqlx::query("DELETE FROM identity_password_reset_tokens WHERE subject_id = $1")
        .bind(reset.subject_id)
        .execute(&mut *transaction)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    transaction
        .commit()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(StatusCode::NO_CONTENT)
}

fn normalize_email(email: &str) -> Option<String> {
    let normalized_email = email.trim().to_lowercase();
    (normalized_email.len() <= MAX_EMAIL_BYTES && EmailAddress::from_str(&normalized_email).is_ok())
        .then_some(normalized_email)
}

fn is_valid_reset_request(request: &ResetPasswordRequest) -> bool {
    !request.token.is_empty()
        && request.token.len() <= MAX_TOKEN_BYTES
        && request.password.len() <= MAX_PASSWORD_BYTES
        && request.password_confirmation.len() <= MAX_PASSWORD_BYTES
        && request.password == request.password_confirmation
}

#[cfg(test)]
mod tests {
    use super::{MAX_TOKEN_BYTES, ResetPasswordRequest, is_valid_reset_request, normalize_email};

    #[test]
    fn password_reset_input_keeps_source_email_normalization_and_bounds() {
        assert_eq!(
            normalize_email(" Learner@Example.test "),
            Some("learner@example.test".to_owned())
        );
        assert_eq!(normalize_email("not-an-email"), None);
    }

    #[test]
    fn password_reset_requires_matching_bounded_password_and_token_fields() {
        let valid = ResetPasswordRequest {
            email: "learner@example.test".to_owned(),
            password: "a sufficiently long password".to_owned(),
            password_confirmation: "a sufficiently long password".to_owned(),
            token: "a valid opaque token".to_owned(),
        };
        assert!(is_valid_reset_request(&valid));
        assert!(!is_valid_reset_request(&ResetPasswordRequest {
            password_confirmation: "different".to_owned(),
            ..valid
        }));
        assert!(!is_valid_reset_request(&ResetPasswordRequest {
            email: "learner@example.test".to_owned(),
            password: "a sufficiently long password".to_owned(),
            password_confirmation: "a sufficiently long password".to_owned(),
            token: "x".repeat(MAX_TOKEN_BYTES + 1),
        }));
    }
}
