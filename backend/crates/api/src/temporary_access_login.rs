use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use uuid::Uuid;
use wicked_learning_application::temporary_access_login::{
    TemporaryAccessLoginCommand, TemporaryAccessLoginDraft,
};
use wicked_learning_persistence::temporary_access_login::PostgresTemporaryAccessLoginRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend, passwords,
    session_status::SessionStatusResponse,
};

pub async fn login(
    State(state): State<AppState>,
    Path(token): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    mut auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<SessionStatusResponse>, ApiError> {
    if token.trim().is_empty() || token.len() > 200 {
        return Err(ApiError::not_found());
    }
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let password_hash = passwords::hash(&Uuid::new_v4().to_string())
        .map_err(|_| ApiError::service_unavailable())?;
    let repository = PostgresTemporaryAccessLoginRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    let subject_id = TemporaryAccessLoginCommand::new(&repository)
        .execute(TemporaryAccessLoginDraft {
            password_hash,
            token_hash: sha256(token.trim()),
        })
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    let backend = IdentityBackend::new(state.identity_database.clone());
    let subject = backend
        .active_subject_for_id(subject_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::service_unavailable)?;
    auth_session
        .login(&subject)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(Json(SessionStatusResponse {
        authenticated: true,
        subject_id: Some(subject_id),
    }))
}

fn sha256(value: &str) -> String {
    use sha2::{Digest, Sha256};

    Sha256::digest(value.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}
