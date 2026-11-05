use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use uuid::Uuid;
use wicked_learning_application::learner_playback::{
    LearnerPlaybackCompletionCommand, LearnerPlaybackQuery,
};
use wicked_learning_domain::learner_state::{
    LearnerPlaybackCompletionResult, LearnerPlaybackDocument,
};
use wicked_learning_persistence::learner_playback::PostgresLearnerPlaybackRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

pub async fn show(
    State(state): State<AppState>,
    Path(play_run_id): Path<String>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerPlaybackDocument>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerPlaybackRepository::new(&state.application_database);

    LearnerPlaybackQuery::new(&repository)
        .execute(&principal, play_run_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn complete_open_practice(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerPlaybackCompletionResult>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerPlaybackRepository::new(&state.application_database);

    LearnerPlaybackCompletionCommand::new(&repository)
        .execute(&principal, play_run_id, &activity_slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
