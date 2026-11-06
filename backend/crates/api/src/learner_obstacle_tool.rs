use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::learner_obstacle_tool::LearnerObstacleToolCommand;
use wicked_learning_domain::learner_state::LearnerObstacleToolResult;
use wicked_learning_persistence::learner_obstacle_tool::PostgresLearnerObstacleToolRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UseObstacleToolRequest {
    tool_slug: String,
}

pub async fn use_tool(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UseObstacleToolRequest>,
) -> Result<Json<LearnerObstacleToolResult>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerObstacleToolRepository::new(&state.application_database);

    LearnerObstacleToolCommand::new(&repository)
        .use_tool(&principal, play_run_id, &activity_slug, &request.tool_slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
