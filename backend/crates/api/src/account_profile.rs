use std::{collections::BTreeMap, str::FromStr};

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
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

#[derive(Debug, Serialize)]
pub(crate) struct ProfileValidationProblem {
    code: &'static str,
    errors: BTreeMap<&'static str, &'static str>,
    title: &'static str,
}

impl ProfileValidationProblem {
    fn field(field: &'static str, message: &'static str) -> Self {
        Self {
            code: "profile_update_rejected",
            errors: BTreeMap::from([(field, message)]),
            title: "The profile could not be updated with these details.",
        }
    }
}

pub(crate) enum ProfileUpdateError {
    Api(ApiError),
    Validation(ProfileValidationProblem),
}

impl From<ApiError> for ProfileUpdateError {
    fn from(error: ApiError) -> Self {
        Self::Api(error)
    }
}

impl From<ProfileValidationProblem> for ProfileUpdateError {
    fn from(problem: ProfileValidationProblem) -> Self {
        Self::Validation(problem)
    }
}

impl IntoResponse for ProfileUpdateError {
    fn into_response(self) -> Response {
        match self {
            Self::Api(error) => error.into_response(),
            Self::Validation(problem) => {
                (StatusCode::UNPROCESSABLE_ENTITY, Json(problem)).into_response()
            }
        }
    }
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
        .map_err(map_profile_read_error)?
        .ok_or_else(ApiError::forbidden)?;
    Ok(Json(profile_response(profile)))
}

pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    mut auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateAccountProfileRequest>,
) -> Result<Json<AccountProfileResponse>, ProfileUpdateError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let subject = auth_session
        .user
        .clone()
        .ok_or_else(ApiError::authentication_required)?;
    let draft = normalize_request(request)?;
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

fn normalize_request(
    request: UpdateAccountProfileRequest,
) -> Result<AccountProfileDraft, ProfileValidationProblem> {
    let display_name = request.name.trim();
    let email = request.email.trim().to_lowercase();
    let public_username = request.username.map(|username| username.trim().to_owned());
    let public_username =
        public_username.and_then(|username| (!username.is_empty()).then_some(username));
    if display_name.is_empty() {
        return Err(ProfileValidationProblem::field(
            "name",
            "The name field is required.",
        ));
    }
    if display_name.chars().count() > MAX_DISPLAY_NAME_CHARACTERS {
        return Err(ProfileValidationProblem::field(
            "name",
            "The name field must not be greater than 255 characters.",
        ));
    }
    if email.is_empty() {
        return Err(ProfileValidationProblem::field(
            "email",
            "The email field is required.",
        ));
    }
    if email.len() > MAX_EMAIL_BYTES {
        return Err(ProfileValidationProblem::field(
            "email",
            "The email field must not be greater than 255 characters.",
        ));
    }
    if EmailAddress::from_str(&email).is_err() {
        return Err(ProfileValidationProblem::field(
            "email",
            "The email field must be a valid email address.",
        ));
    }
    if let Some(username) = public_username.as_deref() {
        if username.len() < 3 {
            return Err(ProfileValidationProblem::field(
                "username",
                "The username field must be at least 3 characters.",
            ));
        }
        if username.len() > 32 {
            return Err(ProfileValidationProblem::field(
                "username",
                "The username field must not be greater than 32 characters.",
            ));
        }
        if !username
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
        {
            return Err(ProfileValidationProblem::field(
                "username",
                "The username field format is invalid.",
            ));
        }
    }
    Ok(AccountProfileDraft {
        display_name: display_name.to_owned(),
        email,
        public_username,
        profile_image_id: request.profile_image_id,
    })
}

fn map_profile_error(error: AccountProfileError) -> ProfileUpdateError {
    match error {
        AccountProfileError::EmailConflict => ProfileUpdateError::Validation(
            ProfileValidationProblem::field("email", "The email has already been taken."),
        ),
        AccountProfileError::Missing => ApiError::forbidden().into(),
        AccountProfileError::ProfileImageRejected => {
            ProfileUpdateError::Validation(ProfileValidationProblem::field(
                "profile_image",
                "The selected profile image is not available.",
            ))
        }
        AccountProfileError::Unavailable => ApiError::service_unavailable().into(),
        AccountProfileError::UsernameConflict => ProfileUpdateError::Validation(
            ProfileValidationProblem::field("username", "The username has already been taken."),
        ),
    }
}

fn map_profile_read_error(error: AccountProfileError) -> ApiError {
    match error {
        AccountProfileError::Missing => ApiError::forbidden(),
        AccountProfileError::Unavailable => ApiError::service_unavailable(),
        AccountProfileError::EmailConflict
        | AccountProfileError::ProfileImageRejected
        | AccountProfileError::UsernameConflict => ApiError::internal_server_error(),
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
    use super::{
        ProfileUpdateError, UpdateAccountProfileRequest, map_profile_error, normalize_request,
    };
    use wicked_learning_application::account_profile::AccountProfileError;

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
                .is_err()
            );
        }
    }

    #[test]
    fn identifies_the_source_field_for_each_invalid_profile_value() {
        let invalid_email = normalize_request(UpdateAccountProfileRequest {
            name: "Learner".to_owned(),
            email: "not an email".to_owned(),
            username: None,
            profile_image_id: None,
        })
        .expect_err("invalid email");
        assert!(invalid_email.errors.contains_key("email"));

        let invalid_name = normalize_request(UpdateAccountProfileRequest {
            name: " ".to_owned(),
            email: "learner@example.test".to_owned(),
            username: None,
            profile_image_id: None,
        })
        .expect_err("blank name");
        assert!(invalid_name.errors.contains_key("name"));
    }

    #[test]
    fn maps_persisted_profile_conflicts_to_the_matching_source_field() {
        let ProfileUpdateError::Validation(username) =
            map_profile_error(AccountProfileError::UsernameConflict)
        else {
            panic!("username conflict must be a source field error");
        };
        assert!(username.errors.contains_key("username"));

        let ProfileUpdateError::Validation(email) =
            map_profile_error(AccountProfileError::EmailConflict)
        else {
            panic!("email conflict must be a source field error");
        };
        assert!(email.errors.contains_key("email"));
    }
}
