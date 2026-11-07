use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};

use crate::{AppState, csrf, error::ApiError, identity::IdentityBackend};

const MAX_PASSWORD_BYTES: usize = 1_024;
pub const PASSWORD_CONFIRMATION_KEY: &str = "wicked_password_confirmed";
pub const PASSWORD_CONFIRMATION_TIMEOUT_SECONDS: i64 = 3 * 60 * 60;

#[derive(Clone, Deserialize, Serialize)]
struct PasswordConfirmation {
    confirmed_at_unix_seconds: i64,
    password_verifier: String,
}

#[derive(Deserialize)]
pub struct ConfirmPasswordRequest {
    password: String,
}

#[derive(Serialize)]
pub struct PasswordConfirmationStatusResponse {
    pub confirmed: bool,
}

pub async fn confirm(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<ConfirmPasswordRequest>,
) -> Result<Json<PasswordConfirmationStatusResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth_session
        .user
        .as_ref()
        .ok_or_else(ApiError::authentication_required)?;
    if request.password.len() > MAX_PASSWORD_BYTES
        || !subject
            .verifies_password(&request.password)
            .map_err(|_| ApiError::service_unavailable())?
    {
        return Err(ApiError::password_confirmation_rejected());
    }
    auth_session
        .session
        .insert(
            PASSWORD_CONFIRMATION_KEY,
            PasswordConfirmation {
                confirmed_at_unix_seconds: time::OffsetDateTime::now_utc().unix_timestamp(),
                password_verifier: subject.password_verifier().to_owned(),
            },
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(PasswordConfirmationStatusResponse { confirmed: true }))
}

pub async fn status(
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<PasswordConfirmationStatusResponse>, ApiError> {
    let confirmed = is_confirmed(&auth_session).await?;
    Ok(Json(PasswordConfirmationStatusResponse { confirmed }))
}

pub async fn require(auth_session: &AuthSession<IdentityBackend>) -> Result<(), ApiError> {
    if is_confirmed(auth_session).await? {
        Ok(())
    } else {
        Err(ApiError::password_confirmation_required())
    }
}

pub async fn confirm_with_passkey(
    auth_session: &AuthSession<IdentityBackend>,
) -> Result<PasswordConfirmationStatusResponse, ApiError> {
    let subject = auth_session
        .user
        .as_ref()
        .ok_or_else(ApiError::authentication_required)?;
    auth_session
        .session
        .insert(
            PASSWORD_CONFIRMATION_KEY,
            PasswordConfirmation {
                confirmed_at_unix_seconds: time::OffsetDateTime::now_utc().unix_timestamp(),
                password_verifier: subject.password_verifier().to_owned(),
            },
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(PasswordConfirmationStatusResponse { confirmed: true })
}

async fn is_confirmed(auth_session: &AuthSession<IdentityBackend>) -> Result<bool, ApiError> {
    let Some(subject) = auth_session.user.as_ref() else {
        return Ok(false);
    };
    let confirmation = auth_session
        .session
        .get::<PasswordConfirmation>(PASSWORD_CONFIRMATION_KEY)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(confirmation.is_some_and(|confirmation| {
        confirmation.password_verifier == subject.password_verifier()
            && confirmation_is_fresh(
                confirmation.confirmed_at_unix_seconds,
                time::OffsetDateTime::now_utc().unix_timestamp(),
            )
    }))
}

fn confirmation_is_fresh(confirmed_at: i64, now: i64) -> bool {
    now >= confirmed_at && now - confirmed_at <= PASSWORD_CONFIRMATION_TIMEOUT_SECONDS
}

#[cfg(test)]
mod tests {
    use super::{PASSWORD_CONFIRMATION_TIMEOUT_SECONDS, confirmation_is_fresh};

    #[test]
    fn password_confirmation_expires_after_the_source_three_hour_window() {
        assert!(confirmation_is_fresh(1_000, 1_000));
        assert!(confirmation_is_fresh(
            1_000,
            1_000 + PASSWORD_CONFIRMATION_TIMEOUT_SECONDS
        ));
        assert!(!confirmation_is_fresh(
            1_000,
            1_001 + PASSWORD_CONFIRMATION_TIMEOUT_SECONDS
        ));
        assert!(!confirmation_is_fresh(1_000, 999));
    }
}
