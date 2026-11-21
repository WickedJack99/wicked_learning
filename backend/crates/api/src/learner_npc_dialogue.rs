use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::learner_npc_dialogue::LearnerNpcDialogueCommand;
use wicked_learning_domain::learner_state::{
    LearnerNpcDialogueAnswerResult, LearnerNpcDialogueState,
};
use wicked_learning_persistence::learner_npc_dialogue::PostgresLearnerNpcDialogueRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct AnswerNpcDialogueRequest {
    answer_node_id: String,
    expected_node_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct SaveNpcDialogueReflectionRequest {
    reflection: String,
    expected_node_id: Option<Uuid>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SaveNpcDialogueCursorRequest {
    current_node_id: String,
    history: Vec<String>,
}

pub async fn grant_current_tool(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug, dialogue_node_id)): Path<(String, String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerNpcDialogueState>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let dialogue_node_id = Uuid::parse_str(&dialogue_node_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerNpcDialogueRepository::new(&state.application_database);
    LearnerNpcDialogueCommand::new(&repository)
        .grant_current_tool(&principal, play_run_id, &activity_slug, dialogue_node_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn save_cursor(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveNpcDialogueCursorRequest>,
) -> Result<Json<LearnerNpcDialogueState>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    if request.history.len() > 40 {
        return Err(ApiError::invalid_request());
    }
    let current_node_id =
        Uuid::parse_str(&request.current_node_id).map_err(|_| ApiError::invalid_request())?;
    let history = request
        .history
        .iter()
        .map(|id| Uuid::parse_str(id))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| ApiError::invalid_request())?;
    let repository = PostgresLearnerNpcDialogueRepository::new(&state.application_database);
    LearnerNpcDialogueCommand::new(&repository)
        .save_cursor(
            &principal,
            play_run_id,
            &activity_slug,
            current_node_id,
            &history,
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn continue_dialogue(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerNpcDialogueState>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerNpcDialogueRepository::new(&state.application_database);
    LearnerNpcDialogueCommand::new(&repository)
        .continue_dialogue(&principal, play_run_id, &activity_slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn answer(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<AnswerNpcDialogueRequest>,
) -> Result<Json<LearnerNpcDialogueAnswerResult>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let answer_node_id =
        Uuid::parse_str(&request.answer_node_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerNpcDialogueRepository::new(&state.application_database);
    LearnerNpcDialogueCommand::new(&repository)
        .answer(
            &principal,
            play_run_id,
            &activity_slug,
            answer_node_id,
            request.expected_node_id,
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn go_back(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerNpcDialogueState>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerNpcDialogueRepository::new(&state.application_database);
    LearnerNpcDialogueCommand::new(&repository)
        .go_back(&principal, play_run_id, &activity_slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn save_reflection(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveNpcDialogueReflectionRequest>,
) -> Result<Json<LearnerNpcDialogueState>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerNpcDialogueRepository::new(&state.application_database);
    LearnerNpcDialogueCommand::new(&repository)
        .save_reflection(
            &principal,
            play_run_id,
            &activity_slug,
            &request.reflection,
            request.expected_node_id,
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
