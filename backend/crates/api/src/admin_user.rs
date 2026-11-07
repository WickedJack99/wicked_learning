use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Deserialize;
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_application::admin_user::{
    AdminUserAccessForm, AdminUserAccessUpdate, AdminUserDeletion, AdminUsersCommand,
    AdminUsersQuery,
};
use wicked_learning_domain::identity_access::AdminUsers;
use wicked_learning_persistence::admin_user::PostgresAdminUserRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdateAdminUserAccessRequest {
    pub banned_until: Option<String>,
    pub login_disabled: bool,
    pub roles: Vec<String>,
}

pub async fn index(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminUsers>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository =
        PostgresAdminUserRepository::new(&state.application_database, &state.identity_database);
    AdminUsersQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn update_access(
    State(state): State<AppState>,
    Path(subject_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateAdminUserAccessRequest>,
) -> Result<StatusCode, ApiError> {
    let subject_id = Uuid::parse_str(&subject_id).map_err(|_| ApiError::not_found())?;
    let form = AdminUserAccessForm::parse(
        request.login_disabled,
        normalized_ban_until(request.banned_until)?,
        request.roles,
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresAdminUserRepository::new(&state.application_database, &state.identity_database);
    match AdminUsersCommand::new(&repository)
        .update_access(&principal, subject_id, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
    {
        AdminUserAccessUpdate::Updated => Ok(StatusCode::NO_CONTENT),
        AdminUserAccessUpdate::Invalid => Err(ApiError::invalid_request()),
        AdminUserAccessUpdate::Missing => Err(ApiError::not_found()),
    }
}

pub async fn destroy(
    State(state): State<AppState>,
    Path(subject_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let subject_id = Uuid::parse_str(&subject_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresAdminUserRepository::new(&state.application_database, &state.identity_database);
    match AdminUsersCommand::new(&repository)
        .delete(&principal, subject_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
    {
        AdminUserDeletion::Deleted => Ok(StatusCode::NO_CONTENT),
        AdminUserDeletion::Invalid => Err(ApiError::invalid_request()),
        AdminUserDeletion::Missing => Err(ApiError::not_found()),
    }
}

fn normalized_ban_until(value: Option<String>) -> Result<Option<String>, ApiError> {
    value
        .map(|value| {
            let value = value.trim();
            if value.is_empty() {
                return Ok(None);
            }
            OffsetDateTime::parse(value, &Rfc3339)
                .map_err(|_| ApiError::invalid_request())?
                .format(&Rfc3339)
                .map_err(|_| ApiError::invalid_request())
                .map(Some)
        })
        .transpose()
        .map(Option::flatten)
}

#[cfg(test)]
mod tests {
    use super::normalized_ban_until;

    #[test]
    fn ban_until_uses_a_normalized_rfc3339_timestamp_or_is_empty() {
        assert_eq!(normalized_ban_until(Some("  ".to_owned())).ok(), Some(None));
        assert!(normalized_ban_until(Some("tomorrow".to_owned())).is_err());
        assert_eq!(
            normalized_ban_until(Some("2099-01-01T00:00:00Z".to_owned())).ok(),
            Some(Some("2099-01-01T00:00:00Z".to_owned()))
        );
    }
}
