use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::learner_question::LearnerQuestionAnswerCommand;
use wicked_learning_domain::learner_state::LearnerQuestionAnswerResult;
use wicked_learning_persistence::learner_question::PostgresLearnerQuestionRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct AnswerQuestionRequest {
    confidence: Option<String>,
    option_keys: Vec<String>,
}

pub async fn answer(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<AnswerQuestionRequest>,
) -> Result<Json<LearnerQuestionAnswerResult>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerQuestionRepository::new(&state.application_database);

    LearnerQuestionAnswerCommand::new(&repository)
        .execute(
            &principal,
            play_run_id,
            &activity_slug,
            &request.option_keys,
            request.confidence.as_deref(),
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
