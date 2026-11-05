use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use uuid::Uuid;
use wicked_learning_application::{
    current_user::CurrentUserQuery, learner_route_run::LearnerRouteRunCommand,
};
use wicked_learning_domain::learner_state::LearnerRouteRun;
use wicked_learning_persistence::{
    current_user::PostgresCurrentUserRepository,
    learner_route_run::PostgresLearnerRouteRunRepository,
};

use crate::{AppState, csrf, error::ApiError, identity::IdentityBackend};

pub async fn start_or_resume(
    State(state): State<AppState>,
    Path(start_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerRouteRun>, ApiError> {
    let start_id = Uuid::parse_str(&start_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerRouteRunRepository::new(&state.application_database);

    LearnerRouteRunCommand::new(&repository)
        .start_or_resume(&principal, start_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn reset(
    State(state): State<AppState>,
    Path(start_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerRouteRun>, ApiError> {
    let start_id = Uuid::parse_str(&start_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerRouteRunRepository::new(&state.application_database);

    LearnerRouteRunCommand::new(&repository)
        .reset(&principal, start_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

async fn authenticated_principal(
    state: &AppState,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<wicked_learning_domain::identity_access::AuthorizedPrincipal, ApiError> {
    let subject = auth_session
        .user
        .ok_or_else(ApiError::authentication_required)?;
    let repository = PostgresCurrentUserRepository::new(&state.application_database);

    CurrentUserQuery::new(&repository)
        .execute(subject.subject_id())
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::forbidden)
}
