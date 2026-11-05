use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use wicked_learning_application::learner_bookmark::{
    LearnerBookmarkCommand, LearnerBookmarkTarget,
};
use wicked_learning_domain::learner_state::LearnerBookmarkResult;
use wicked_learning_persistence::learner_bookmark::PostgresLearnerBookmarkRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

pub async fn create(
    State(state): State<AppState>,
    Path((map_slug, node_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerBookmarkResult>, ApiError> {
    let target =
        LearnerBookmarkTarget::parse(&map_slug, &node_slug).ok_or_else(ApiError::not_found)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerBookmarkRepository::new(&state.application_database);

    LearnerBookmarkCommand::new(&repository)
        .bookmark(&principal, &target)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn delete(
    State(state): State<AppState>,
    Path((map_slug, node_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerBookmarkResult>, ApiError> {
    let target =
        LearnerBookmarkTarget::parse(&map_slug, &node_slug).ok_or_else(ApiError::not_found)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerBookmarkRepository::new(&state.application_database);

    LearnerBookmarkCommand::new(&repository)
        .unbookmark(&principal, &target)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
