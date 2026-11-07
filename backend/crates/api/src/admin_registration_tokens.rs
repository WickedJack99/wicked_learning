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
    let expires_at = normalized_expiry(request.expires_at)?;
    let note = normalized_note(request.note)?;
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

fn normalized_expiry(value: Option<String>) -> Result<Option<String>, ApiError> {
    value
        .map(|value| {
            OffsetDateTime::parse(&value, &Rfc3339)
                .ok()
                .filter(|time| *time > OffsetDateTime::now_utc())
                .ok_or_else(ApiError::invalid_request)?
                .format(&Rfc3339)
                .map_err(|_| ApiError::invalid_request())
        })
        .transpose()
}

fn normalized_note(value: Option<String>) -> Result<Option<String>, ApiError> {
    let Some(value) = value else {
        return Ok(None);
    };
    let value = value.trim().to_owned();
    if value.chars().count() > 500 {
        return Err(ApiError::invalid_request());
    }
    Ok((!value.is_empty()).then_some(value))
}

#[cfg(test)]
mod tests {
    use super::{normalized_expiry, normalized_note};

    #[test]
    fn note_is_trimmed_and_rejects_values_over_the_source_limit() {
        assert_eq!(
            normalized_note(Some("  biology pilot group  ".to_owned()))
                .ok()
                .flatten(),
            Some("biology pilot group".to_owned())
        );
        assert_eq!(normalized_note(Some("   ".to_owned())).ok().flatten(), None,);
        assert!(normalized_note(Some("x".repeat(501))).is_err());
    }

    #[test]
    fn expiry_must_be_valid_rfc3339_and_in_the_future() {
        assert!(normalized_expiry(Some("not a timestamp".to_owned())).is_err());
        assert!(normalized_expiry(Some("2000-01-01T00:00:00Z".to_owned())).is_err());
        assert!(normalized_expiry(Some("2099-01-01T00:00:00Z".to_owned())).is_ok());
    }
}
