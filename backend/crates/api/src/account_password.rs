use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend, passwords,
    session_status::SessionStatusResponse,
};

const MAX_PASSWORD_BYTES: usize = 1_024;

#[derive(Deserialize)]
pub struct UpdatePasswordRequest {
    current_password: String,
    password: String,
    password_confirmation: String,
}

/// Updates the current subject's Rust-owned password credential.
///
/// The replacement verifier is also written into the current session. Sessions
/// authenticated with the prior verifier therefore stop being valid, while the
/// browser which proved the current password stays signed in.
pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    mut auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdatePasswordRequest>,
) -> Result<Json<SessionStatusResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth_session
        .user
        .clone()
        .ok_or_else(ApiError::authentication_required)?;
    if !is_valid_request(&request) {
        return Err(ApiError::password_update_rejected());
    }
    if !subject
        .verifies_password(&request.current_password)
        .map_err(|_| ApiError::service_unavailable())?
    {
        return Err(ApiError::password_update_rejected());
    }

    let password_hash =
        passwords::hash(&request.password).map_err(|_| ApiError::password_update_rejected())?;
    let password_replaced = replace_password_hash(
        &state.identity_database,
        subject.subject_id(),
        subject.password_verifier(),
        &password_hash,
    )
    .await
    .map_err(|_| ApiError::service_unavailable())?;
    if !password_replaced {
        return Err(ApiError::password_update_rejected());
    }
    let refreshed_subject = subject.with_replaced_password_hash(password_hash);
    auth_session
        .login(&refreshed_subject)
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(SessionStatusResponse {
        authenticated: true,
        subject_id: Some(refreshed_subject.subject_id()),
    }))
}

fn is_valid_request(request: &UpdatePasswordRequest) -> bool {
    request.current_password.len() <= MAX_PASSWORD_BYTES
        && request.password.len() <= MAX_PASSWORD_BYTES
        && request.password_confirmation.len() <= MAX_PASSWORD_BYTES
        && request.password == request.password_confirmation
}

async fn replace_password_hash(
    identity_database: &PgPool,
    subject_id: uuid::Uuid,
    expected_password_hash: &str,
    password_hash: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        "UPDATE identity_password_credentials SET password_hash = $3, updated_at = NOW() WHERE subject_id = $1 AND password_hash = $2",
    )
    .bind(subject_id)
    .bind(expected_password_hash)
    .bind(password_hash)
    .execute(identity_database)
    .await?;
    Ok(result.rows_affected() == 1)
}

#[cfg(test)]
mod tests {
    use super::{UpdatePasswordRequest, is_valid_request};

    #[test]
    fn accepts_matching_bounded_password_fields() {
        assert!(is_valid_request(&UpdatePasswordRequest {
            current_password: "current password".to_owned(),
            password: "replacement password".to_owned(),
            password_confirmation: "replacement password".to_owned(),
        }));
    }

    #[test]
    fn rejects_confirmation_mismatch_and_oversized_fields() {
        assert!(!is_valid_request(&UpdatePasswordRequest {
            current_password: "current password".to_owned(),
            password: "replacement password".to_owned(),
            password_confirmation: "different password".to_owned(),
        }));
        assert!(!is_valid_request(&UpdatePasswordRequest {
            current_password: "a".repeat(1_025),
            password: "replacement password".to_owned(),
            password_confirmation: "replacement password".to_owned(),
        }));
    }
}
