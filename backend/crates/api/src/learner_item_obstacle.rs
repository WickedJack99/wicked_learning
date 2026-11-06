use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::learner_item_obstacle::LearnerItemObstacleCommand;
use wicked_learning_domain::learner_state::LearnerItemObstacleResult;
use wicked_learning_persistence::learner_item_obstacle::PostgresLearnerItemObstacleRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct PlaceItemRequest {
    item_slug: String,
}

pub async fn place_item(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug, slot_index)): Path<(String, String, i16)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<PlaceItemRequest>,
) -> Result<Json<LearnerItemObstacleResult>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerItemObstacleRepository::new(&state.application_database);

    LearnerItemObstacleCommand::new(&repository)
        .place(
            &principal,
            play_run_id,
            &activity_slug,
            &request.item_slug,
            slot_index,
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn continue_obstacle(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerItemObstacleResult>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerItemObstacleRepository::new(&state.application_database);

    LearnerItemObstacleCommand::new(&repository)
        .continue_obstacle(&principal, play_run_id, &activity_slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
