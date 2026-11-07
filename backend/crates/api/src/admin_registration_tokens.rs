use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal, registration_tokens,
};

#[derive(Deserialize)]
pub struct CreateRegistrationTokenRequest {
    expires_at: Option<String>,
    note: Option<String>,
    roles: Option<Vec<String>>,
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
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let expires_at = normalized_expiry(request.expires_at)?;
    let note = normalized_note(request.note)?;
    let roles = normalized_roles(request.roles)?;
    let token = registration_tokens::issue_for_subject(
        &state.application_database,
        &state.identity_database,
        principal.subject_id,
        expires_at,
        note,
        roles,
    )
    .await
    .map_err(|error| match error {
        registration_tokens::RegistrationTokenError::InvalidRoles => ApiError::invalid_request(),
        registration_tokens::RegistrationTokenError::Database(_) => ApiError::service_unavailable(),
        registration_tokens::RegistrationTokenError::OutputFile(_) => {
            ApiError::internal_server_error()
        }
    })?;
    Ok(Json(CreateRegistrationTokenResponse { token }))
}

fn normalized_roles(value: Option<Vec<String>>) -> Result<Vec<String>, ApiError> {
    let mut roles = value.unwrap_or_else(|| vec!["learner".to_owned()]);
    if roles.is_empty() || roles.len() > 100 {
        return Err(ApiError::invalid_request());
    }
    for role in &mut roles {
        *role = role.trim().to_owned();
    }
    roles.sort();
    roles.dedup();
    if roles
        .iter()
        .any(|role| role.is_empty() || role.chars().count() > 80)
    {
        return Err(ApiError::invalid_request());
    }
    Ok(roles)
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
    use super::{normalized_expiry, normalized_note, normalized_roles};

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

    #[test]
    fn invitation_roles_default_to_learner_and_are_normalized() {
        assert_eq!(
            normalized_roles(None).ok(),
            Some(vec!["learner".to_owned()])
        );
        assert_eq!(
            normalized_roles(Some(vec![" learner ".to_owned(), "learner".to_owned()])).ok(),
            Some(vec!["learner".to_owned()])
        );
        assert!(normalized_roles(Some(vec![])).is_err());
    }
}
