use std::str::FromStr;

use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use email_address::EmailAddress;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use wicked_learning_application::identity_registration::{
    IdentityRegistrationCommand, IdentityRegistrationDraft, IdentityRegistrationError,
};
use wicked_learning_domain::learner_state::LearnerAppearance;
use wicked_learning_persistence::identity_registration::PostgresIdentityRegistrationRepository;

use crate::{
    AppState, csrf,
    error::ApiError,
    identity::{IdentityBackend, PasswordCredentials},
    passwords,
    session_status::SessionStatusResponse,
};

const MAX_EMAIL_BYTES: usize = 320;
const MAX_PASSWORD_BYTES: usize = 1_024;
const MAX_REGISTRATION_TOKEN_BYTES: usize = 120;
const MAX_DISPLAY_NAME_CHARACTERS: usize = 255;

#[derive(Deserialize)]
pub struct RegistrationRequest {
    appearance: Option<String>,
    name: String,
    email: String,
    password: String,
    password_confirmation: String,
    registration_token: String,
}

pub async fn register(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    mut auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<RegistrationRequest>,
) -> Result<Json<SessionStatusResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let Some((appearance, display_name, normalized_email, registration_token)) =
        normalize_request(&request)
    else {
        return Err(ApiError::registration_rejected());
    };
    if request.password != request.password_confirmation
        || request.password.len() > MAX_PASSWORD_BYTES
    {
        return Err(ApiError::registration_rejected());
    }
    let password_hash =
        passwords::hash(&request.password).map_err(|_| ApiError::registration_rejected())?;
    let registration_token_hash = hex_sha256(&registration_token);
    let repository = PostgresIdentityRegistrationRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    let registration = IdentityRegistrationCommand::new(&repository)
        .execute(IdentityRegistrationDraft {
            appearance,
            display_name,
            normalized_email: normalized_email.clone(),
            password_hash,
            registration_token_hash,
        })
        .await
        .map_err(map_registration_error)?;
    let subject = auth_session
        .authenticate(PasswordCredentials {
            normalized_email,
            password: request.password,
        })
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .filter(|subject| subject.subject_id() == registration.subject_id)
        .ok_or_else(ApiError::service_unavailable)?;
    auth_session
        .login(&subject)
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(SessionStatusResponse {
        authenticated: true,
        subject_id: Some(subject.subject_id()),
        two_factor_required: false,
    }))
}

fn normalize_request(
    request: &RegistrationRequest,
) -> Option<(LearnerAppearance, String, String, String)> {
    let appearance = match request.appearance.as_deref() {
        Some(appearance) => LearnerAppearance::parse(appearance)?,
        None => LearnerAppearance::Light,
    };
    let display_name = request.name.trim();
    let normalized_email = request.email.trim().to_lowercase();
    let registration_token = request.registration_token.trim();
    if display_name.is_empty()
        || display_name.chars().count() > MAX_DISPLAY_NAME_CHARACTERS
        || normalized_email.is_empty()
        || normalized_email.len() > MAX_EMAIL_BYTES
        || EmailAddress::from_str(&normalized_email).is_err()
        || registration_token.is_empty()
        || registration_token.len() > MAX_REGISTRATION_TOKEN_BYTES
    {
        return None;
    }

    Some((
        appearance,
        display_name.to_owned(),
        normalized_email,
        registration_token.to_owned(),
    ))
}

fn hex_sha256(value: &str) -> String {
    Sha256::digest(value.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn map_registration_error(error: IdentityRegistrationError) -> ApiError {
    match error {
        // The browser gets one source-shaped rejection for an unavailable
        // address or an invalid/expired/consumed invitation. This avoids
        // turning registration into an identity or token enumeration oracle.
        IdentityRegistrationError::EmailUnavailable
        | IdentityRegistrationError::InvalidRegistrationToken => ApiError::registration_rejected(),
        IdentityRegistrationError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use wicked_learning_domain::learner_state::LearnerAppearance;

    use super::{RegistrationRequest, hex_sha256, normalize_request};

    #[test]
    fn normalizes_source_registration_input_without_retaining_whitespace() {
        let result = normalize_request(&RegistrationRequest {
            appearance: Some("dark".to_owned()),
            email: " Learner@Example.test ".to_owned(),
            name: "  Learner Name  ".to_owned(),
            password: "not-used-here".to_owned(),
            password_confirmation: "not-used-here".to_owned(),
            registration_token: "  a-valid-invitation  ".to_owned(),
        });

        assert_eq!(
            result,
            Some((
                LearnerAppearance::Dark,
                "Learner Name".to_owned(),
                "learner@example.test".to_owned(),
                "a-valid-invitation".to_owned(),
            )),
        );
    }

    #[test]
    fn rejects_blank_or_malformed_source_registration_fields() {
        let result = normalize_request(&RegistrationRequest {
            appearance: Some("system".to_owned()),
            email: "not-an-email".to_owned(),
            name: " ".to_owned(),
            password: "not-used-here".to_owned(),
            password_confirmation: "not-used-here".to_owned(),
            registration_token: " ".to_owned(),
        });

        assert_eq!(result, None);
    }

    #[test]
    fn invitation_hash_does_not_retain_the_plaintext_token() {
        let token = "one-time-invitation-token";
        let hash = hex_sha256(token);

        assert_ne!(hash, token);
        assert_eq!(hash.len(), 64);
    }
}
