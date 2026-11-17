use std::collections::BTreeMap;

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use tracing::warn;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend, passwords, security_access_audit,
    session_status::SessionStatusResponse,
};

const MAX_PASSWORD_BYTES: usize = 1_024;

#[derive(Deserialize)]
pub struct UpdatePasswordRequest {
    current_password: String,
    password: String,
    password_confirmation: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct PasswordValidationProblem {
    code: &'static str,
    errors: BTreeMap<&'static str, &'static str>,
    title: &'static str,
}

impl PasswordValidationProblem {
    fn field(field: &'static str, message: &'static str) -> Self {
        Self {
            code: "password_update_rejected",
            errors: BTreeMap::from([(field, message)]),
            title: "The password could not be updated with these details.",
        }
    }
}

pub(crate) enum PasswordUpdateError {
    Api(ApiError),
    Validation(PasswordValidationProblem),
}

impl From<ApiError> for PasswordUpdateError {
    fn from(error: ApiError) -> Self {
        Self::Api(error)
    }
}

impl From<PasswordValidationProblem> for PasswordUpdateError {
    fn from(problem: PasswordValidationProblem) -> Self {
        Self::Validation(problem)
    }
}

impl IntoResponse for PasswordUpdateError {
    fn into_response(self) -> Response {
        match self {
            Self::Api(error) => error.into_response(),
            Self::Validation(problem) => {
                (StatusCode::UNPROCESSABLE_ENTITY, Json(problem)).into_response()
            }
        }
    }
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
) -> Result<Json<SessionStatusResponse>, PasswordUpdateError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth_session
        .user
        .clone()
        .ok_or_else(ApiError::authentication_required)?;
    validate_request(&request)?;
    if !subject
        .verifies_password(&request.current_password)
        .map_err(|_| ApiError::service_unavailable())?
    {
        return Err(PasswordValidationProblem::field(
            "current_password",
            "The current password is incorrect.",
        )
        .into());
    }

    let password_hash = passwords::hash(&request.password).map_err(|_| {
        PasswordValidationProblem::field(
            "password",
            "The password could not be updated with these details.",
        )
    })?;
    let mut transaction = state
        .identity_database
        .begin()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let password_replaced = replace_password_hash(
        &mut transaction,
        subject.subject_id(),
        subject.password_verifier(),
        &password_hash,
    )
    .await
    .map_err(|_| ApiError::service_unavailable())?;
    if !password_replaced {
        return Err(PasswordValidationProblem::field(
            "current_password",
            "The current password is incorrect.",
        )
        .into());
    }
    security_access_audit::queue_password_change(&mut transaction, subject.subject_id())
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    transaction
        .commit()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    if let Err(error) = security_access_audit::deliver_pending(
        &state.identity_database,
        &state.application_database,
    )
    .await
    {
        warn!(%error, subject_id = %subject.subject_id(), "password change audit delivery will be retried");
    }
    let refreshed_subject = subject.with_replaced_password_hash(password_hash);
    auth_session
        .session
        .cycle_id()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    auth_session
        .login(&refreshed_subject)
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(SessionStatusResponse {
        authenticated: true,
        subject_id: Some(refreshed_subject.subject_id()),
        two_factor_required: false,
    }))
}

fn validate_request(request: &UpdatePasswordRequest) -> Result<(), PasswordValidationProblem> {
    if request.current_password.is_empty() || request.current_password.len() > MAX_PASSWORD_BYTES {
        return Err(PasswordValidationProblem::field(
            "current_password",
            "The current password is required.",
        ));
    }
    if request.password.len() < 12 || request.password.len() > MAX_PASSWORD_BYTES {
        return Err(PasswordValidationProblem::field(
            "password",
            "The password must be at least 12 characters.",
        ));
    }
    if request.password_confirmation.len() > MAX_PASSWORD_BYTES
        || request.password != request.password_confirmation
    {
        return Err(PasswordValidationProblem::field(
            "password_confirmation",
            "The password confirmation does not match.",
        ));
    }

    Ok(())
}

async fn replace_password_hash(
    transaction: &mut Transaction<'_, Postgres>,
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
    .execute(&mut **transaction)
    .await?;
    Ok(result.rows_affected() == 1)
}

#[cfg(test)]
mod tests {
    use super::{UpdatePasswordRequest, validate_request};

    #[test]
    fn accepts_matching_bounded_password_fields() {
        assert!(
            validate_request(&UpdatePasswordRequest {
                current_password: "current password".to_owned(),
                password: "replacement password".to_owned(),
                password_confirmation: "replacement password".to_owned(),
            })
            .is_ok()
        );
    }

    #[test]
    fn rejects_confirmation_mismatch_and_oversized_fields() {
        assert!(
            validate_request(&UpdatePasswordRequest {
                current_password: "current password".to_owned(),
                password: "replacement password".to_owned(),
                password_confirmation: "different password".to_owned(),
            })
            .is_err()
        );
        assert!(
            validate_request(&UpdatePasswordRequest {
                current_password: "a".repeat(1_025),
                password: "replacement password".to_owned(),
                password_confirmation: "replacement password".to_owned(),
            })
            .is_err()
        );
    }
}
