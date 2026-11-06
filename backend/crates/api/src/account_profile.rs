use std::str::FromStr;

use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use email_address::EmailAddress;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::account_profile::{
    AccountProfile, AccountProfileDraft, AccountProfileError, AccountProfileQuery,
    UpdateAccountProfileCommand,
};
use wicked_learning_persistence::account_profile::PostgresAccountProfileRepository;

use crate::{AppState, csrf, error::ApiError, identity::IdentityBackend};

const MAX_DISPLAY_NAME_CHARACTERS: usize = 255;
const MAX_EMAIL_BYTES: usize = 255;

#[derive(Deserialize)]
pub struct UpdateAccountProfileRequest {
    name: String,
    email: String,
    username: Option<String>,
    profile_image_id: Option<Uuid>,
}

#[derive(Serialize)]
pub struct AccountProfileResponse {
    pub name: String,
    pub email: String,
    pub username: Option<String>,
    pub profile_image_id: Option<Uuid>,
    pub profile_image_url: Option<String>,
}

pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AccountProfileResponse>, ApiError> {
    let subject = auth_session
        .user
        .ok_or_else(ApiError::authentication_required)?;
    let repository = PostgresAccountProfileRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    let profile = AccountProfileQuery::new(&repository)
        .execute(subject.subject_id())
        .await
        .map_err(map_profile_error)?
        .ok_or_else(ApiError::forbidden)?;
    Ok(Json(profile_response(profile)))
}

pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    mut auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateAccountProfileRequest>,
) -> Result<Json<AccountProfileResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth_session
        .user
        .clone()
        .ok_or_else(ApiError::authentication_required)?;
    let draft = normalize_request(request).ok_or_else(ApiError::profile_update_rejected)?;
    let repository = PostgresAccountProfileRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    let profile = UpdateAccountProfileCommand::new(&repository)
        .execute(subject.subject_id(), draft)
        .await
        .map_err(map_profile_error)?;
    let refreshed_subject = subject.with_normalized_email(profile.email.clone());
    auth_session
        .login(&refreshed_subject)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(Json(profile_response(profile)))
}

fn normalize_request(request: UpdateAccountProfileRequest) -> Option<AccountProfileDraft> {
    let display_name = request.name.trim();
    let email = request.email.trim().to_lowercase();
    let public_username = request.username?.trim().to_owned();
    let public_username = (!public_username.is_empty()).then_some(public_username);
    if display_name.is_empty()
        || display_name.chars().count() > MAX_DISPLAY_NAME_CHARACTERS
        || email.is_empty()
        || email.len() > MAX_EMAIL_BYTES
        || EmailAddress::from_str(&email).is_err()
        || public_username.as_deref().is_some_and(|username| {
            username.len() < 3
                || username.len() > 32
                || !username
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
        })
    {
        return None;
    }
    Some(AccountProfileDraft {
        display_name: display_name.to_owned(),
        email,
        public_username,
        profile_image_id: request.profile_image_id,
    })
}

fn map_profile_error(error: AccountProfileError) -> ApiError {
    match error {
        AccountProfileError::Conflict => ApiError::profile_update_rejected(),
        AccountProfileError::Missing => ApiError::forbidden(),
        AccountProfileError::Unavailable => ApiError::service_unavailable(),
    }
}

fn profile_response(profile: AccountProfile) -> AccountProfileResponse {
    AccountProfileResponse {
        name: profile.display_name,
        email: profile.email,
        username: profile.public_username,
        profile_image_id: profile.profile_image_id,
        profile_image_url: profile
            .profile_image_id
            .map(|id| format!("/api/v1/profile-images/{id}")),
    }
}

#[cfg(test)]
mod tests {
    use super::{UpdateAccountProfileRequest, normalize_request};

    #[test]
    fn normalizes_the_source_profile_fields() {
        let profile = normalize_request(UpdateAccountProfileRequest {
            name: "  Learner Name ".to_owned(),
            email: " Learner@Example.test ".to_owned(),
            username: Some(" learner_name ".to_owned()),
            profile_image_id: None,
        })
        .expect("valid source profile fields");

        assert_eq!(profile.display_name, "Learner Name");
        assert_eq!(profile.email, "learner@example.test");
        assert_eq!(profile.public_username.as_deref(), Some("learner_name"));
    }

    #[test]
    fn rejects_invalid_or_too_short_public_usernames() {
        for username in ["no", "bad name", "a".repeat(33).as_str()] {
            assert!(
                normalize_request(UpdateAccountProfileRequest {
                    name: "Learner".to_owned(),
                    email: "learner@example.test".to_owned(),
                    username: Some(username.to_owned()),
                    profile_image_id: None,
                })
                .is_none()
            );
        }
    }
}
