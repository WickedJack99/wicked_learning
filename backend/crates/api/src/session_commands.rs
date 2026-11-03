use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Deserialize;

use crate::{
    AppState, csrf,
    error::ApiError,
    identity::{IdentityBackend, PasswordCredentials},
    session_status::SessionStatusResponse,
};

const MAX_EMAIL_BYTES: usize = 320;
const MAX_PASSWORD_BYTES: usize = 1_024;

#[derive(Deserialize)]
pub struct LoginRequest {
    email: String,
    password: String,
}

pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    mut auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<SessionStatusResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let normalized_email = request.email.trim().to_lowercase();
    if normalized_email.is_empty()
        || normalized_email.len() > MAX_EMAIL_BYTES
        || request.password.len() > MAX_PASSWORD_BYTES
    {
        return Err(ApiError::invalid_credentials());
    }

    let subject = auth_session
        .authenticate(PasswordCredentials {
            normalized_email,
            password: request.password,
        })
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::invalid_credentials)?;
    auth_session
        .login(&subject)
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(SessionStatusResponse {
        authenticated: true,
        subject_id: Some(subject.subject_id()),
    }))
}

pub async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    mut auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    auth_session
        .logout()
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    Ok(StatusCode::NO_CONTENT)
}
