use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

use crate::{AppState, csrf, error::ApiError, identity::IdentityBackend, registration_tokens};

#[derive(Deserialize)]
pub struct CreateRegistrationTokenRequest {
    expires_at: Option<String>,
    note: Option<String>,
}
#[derive(Serialize)]
pub struct CreateRegistrationTokenResponse {
    pub token: String,
}

pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateRegistrationTokenRequest>,
) -> Result<Json<CreateRegistrationTokenResponse>, ApiError> {
    let subject = auth_session
        .user
        .ok_or_else(ApiError::authentication_required)?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let expires_at = match request.expires_at {
        Some(value) => Some(
            OffsetDateTime::parse(&value, &Rfc3339)
                .ok()
                .filter(|time| *time > OffsetDateTime::now_utc())
                .ok_or_else(ApiError::invalid_request)?
                .format(&Rfc3339)
                .map_err(|_| ApiError::invalid_request())?,
        ),
        None => None,
    };
    let note = request
        .note
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .filter(|value| value.chars().count() <= 500);
    let token = registration_tokens::issue_for_subject(
        &state.identity_database,
        subject.subject_id(),
        expires_at,
        note,
    )
    .await
    .map_err(|_| ApiError::service_unavailable())?;
    Ok(Json(CreateRegistrationTokenResponse { token }))
}
