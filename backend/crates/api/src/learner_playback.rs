use axum::{
    Json,
    extract::{Path, State},
};
use axum_login::AuthSession;
use uuid::Uuid;
use wicked_learning_application::learner_playback::LearnerPlaybackQuery;
use wicked_learning_domain::learner_state::LearnerPlaybackDocument;
use wicked_learning_persistence::learner_playback::PostgresLearnerPlaybackRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
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
