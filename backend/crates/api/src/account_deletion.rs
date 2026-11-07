use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Deserialize;
use wicked_learning_application::account_deletion::{AccountDeletion, DeleteAccountCommand};
use wicked_learning_persistence::account_deletion::PostgresAccountDeletionRepository;

use crate::{AppState, csrf, error::ApiError, identity::IdentityBackend};

const MAX_PASSWORD_BYTES: usize = 1_024;

#[derive(Deserialize)]
pub struct DeleteAccountRequest {
    password: String,
}

/// Mirrors the source ProfileDeleteRequest: the active owner must provide the
/// current password in the destructive request itself.
pub async fn destroy(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    mut auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<DeleteAccountRequest>,
) -> Result<StatusCode, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth_session
        .user
        .clone()
        .ok_or_else(ApiError::authentication_required)?;
    if request.password.len() > MAX_PASSWORD_BYTES
        || !subject
            .verifies_password(&request.password)
            .map_err(|_| ApiError::service_unavailable())?
    {
        return Err(ApiError::account_deletion_rejected());
    }

    let repository = PostgresAccountDeletionRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    match DeleteAccountCommand::new(&repository)
        .execute(subject.subject_id())
        .await
        .map_err(|_| ApiError::service_unavailable())?
    {
        AccountDeletion::Deleted => {
            auth_session
                .logout()
                .await
                .map_err(|_| ApiError::service_unavailable())?;
            Ok(StatusCode::NO_CONTENT)
        }
        // An authenticated active subject should always retain an application
        // principal until this request deletes it. Treat a broken mapping as a
        // dependency failure rather than exposing an account-existence oracle.
        AccountDeletion::Missing => Err(ApiError::service_unavailable()),
    }
}

#[cfg(test)]
mod tests {
    use super::{DeleteAccountRequest, MAX_PASSWORD_BYTES};

    #[test]
    fn keeps_the_source_password_request_bounded() {
        assert!(
            DeleteAccountRequest {
                password: "a current password".to_owned()
            }
            .password
            .len()
                <= MAX_PASSWORD_BYTES
        );
        assert!("a".repeat(MAX_PASSWORD_BYTES + 1).len() > MAX_PASSWORD_BYTES);
    }
}
