use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::learner_shared_task::{
    LearnerSharedTaskCommand, SharedTaskResponseType, valid_checklist, valid_contribution,
    valid_follow_up, valid_project_step, valid_review,
};
use wicked_learning_domain::learner_state::{LearnerSharedTaskChecklist, LearnerSharedTaskState};
use wicked_learning_persistence::learner_shared_task::PostgresLearnerSharedTaskRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct SubmitContributionRequest {
    body: String,
    project_step_index: Option<i16>,
    share_with_peers: bool,
}

#[derive(Deserialize)]
pub struct ReviseContributionRequest {
    body: String,
}

#[derive(Deserialize)]
pub struct SubmitReviewRequest {
    body: String,
    project_step_index: Option<i16>,
    response_type: Option<String>,
    submission_id: String,
}

#[derive(Deserialize)]
pub struct UpdateHelpfulnessRequest {
    helpful: bool,
}

#[derive(Deserialize)]
pub struct SaveFollowUpRequest {
    body: Option<String>,
}

#[derive(Deserialize)]
pub struct SaveChecklistRequest {
    completed_step_indexes: Vec<i16>,
}

pub async fn submit_contribution(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SubmitContributionRequest>,
) -> Result<Json<LearnerSharedTaskState>, ApiError> {
    if valid_contribution(&request.body).is_none()
        || valid_project_step(request.project_step_index).is_none()
    {
        return Err(ApiError::invalid_request());
    }
    let play_run_id = parse_uuid(&play_run_id)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerSharedTaskRepository::new(&state.application_database);
    LearnerSharedTaskCommand::new(&repository)
        .submit_contribution(
            &principal,
            play_run_id,
            &activity_slug,
            &request.body,
            request.share_with_peers,
            request.project_step_index,
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn revise_contribution(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug, submission_id)): Path<(String, String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<ReviseContributionRequest>,
) -> Result<Json<LearnerSharedTaskState>, ApiError> {
    if valid_contribution(&request.body).is_none() {
        return Err(ApiError::invalid_request());
    }
    let play_run_id = parse_uuid(&play_run_id)?;
    let submission_id = parse_uuid(&submission_id)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerSharedTaskRepository::new(&state.application_database);
    LearnerSharedTaskCommand::new(&repository)
        .revise_contribution(
            &principal,
            play_run_id,
            &activity_slug,
            submission_id,
            &request.body,
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn submit_review(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SubmitReviewRequest>,
) -> Result<Json<LearnerSharedTaskState>, ApiError> {
    if valid_review(&request.body).is_none()
        || SharedTaskResponseType::parse(request.response_type.as_deref()).is_none()
        || valid_project_step(request.project_step_index).is_none()
    {
        return Err(ApiError::invalid_request());
    }
    let play_run_id = parse_uuid(&play_run_id)?;
    let submission_id = parse_uuid(&request.submission_id)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerSharedTaskRepository::new(&state.application_database);
    LearnerSharedTaskCommand::new(&repository)
        .submit_review(
            &principal,
            play_run_id,
            &activity_slug,
            submission_id,
            &request.body,
            request.response_type.as_deref(),
            request.project_step_index,
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn update_helpfulness(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug, review_id)): Path<(String, String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateHelpfulnessRequest>,
) -> Result<Json<LearnerSharedTaskState>, ApiError> {
    let play_run_id = parse_uuid(&play_run_id)?;
    let review_id = parse_uuid(&review_id)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerSharedTaskRepository::new(&state.application_database);
    LearnerSharedTaskCommand::new(&repository)
        .mark_review_helpful(
            &principal,
            play_run_id,
            &activity_slug,
            review_id,
            request.helpful,
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn save_follow_up(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug, review_id)): Path<(String, String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveFollowUpRequest>,
) -> Result<Json<LearnerSharedTaskState>, ApiError> {
    if valid_follow_up(request.body.as_deref()).is_none() {
        return Err(ApiError::invalid_request());
    }
    let play_run_id = parse_uuid(&play_run_id)?;
    let review_id = parse_uuid(&review_id)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerSharedTaskRepository::new(&state.application_database);
    LearnerSharedTaskCommand::new(&repository)
        .save_review_follow_up(
            &principal,
            play_run_id,
            &activity_slug,
            review_id,
            request.body.as_deref(),
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn save_checklist(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveChecklistRequest>,
) -> Result<Json<LearnerSharedTaskChecklist>, ApiError> {
    if !valid_checklist(&request.completed_step_indexes) {
        return Err(ApiError::invalid_request());
    }
    let play_run_id = parse_uuid(&play_run_id)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerSharedTaskRepository::new(&state.application_database);
    LearnerSharedTaskCommand::new(&repository)
        .save_checklist(
            &principal,
            play_run_id,
            &activity_slug,
            &request.completed_step_indexes,
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

fn parse_uuid(value: &str) -> Result<Uuid, ApiError> {
    Uuid::parse_str(value).map_err(|_| ApiError::not_found())
}
