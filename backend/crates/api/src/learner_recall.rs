use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::learner_recall::{
    LearnerRecallCommand, LearnerRecallQuery, valid_recall_confidence,
};
use wicked_learning_domain::learner_state::{LearnerRecallItem, LearnerRecallQueue};
use wicked_learning_persistence::learner_recall::PostgresLearnerRecallRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Serialize)]
pub struct RemoveLearnerRecallItemResult {
    pub recall_item_id: String,
    pub removed: bool,
}

#[derive(Serialize)]
pub struct RemoveCurrentRecallResult {
    removed: bool,
}

#[derive(Serialize)]
pub struct UpdateRecallFeedbackResult {
    updated: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateRecallFeedbackRequest {
    confidence_after_feedback: Option<String>,
}

pub async fn remove_current_question(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<RemoveCurrentRecallResult>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerRecallRepository::new(&state.application_database);
    let removed = LearnerRecallCommand::new(&repository)
        .remove_current_question(&principal, play_run_id, &activity_slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(RemoveCurrentRecallResult { removed }))
}

pub async fn update_current_question_feedback(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateRecallFeedbackRequest>,
) -> Result<Json<UpdateRecallFeedbackResult>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    if !valid_recall_confidence(request.confidence_after_feedback.as_deref()) {
        return Err(ApiError::invalid_request());
    }
    let repository = PostgresLearnerRecallRepository::new(&state.application_database);
    let updated = LearnerRecallCommand::new(&repository)
        .update_current_question_feedback(
            &principal,
            play_run_id,
            &activity_slug,
            request.confidence_after_feedback.as_deref(),
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateRecallFeedbackResult { updated }))
}

pub async fn index(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerRecallQueue>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerRecallRepository::new(&state.application_database);

    LearnerRecallQuery::new(&repository)
        .execute(&principal)
        .await
        .map(Json)
        .map_err(|_| ApiError::service_unavailable())
}

pub async fn queue_current_question(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerRecallItem>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerRecallRepository::new(&state.application_database);

    LearnerRecallCommand::new(&repository)
        .queue_current_question(&principal, play_run_id, &activity_slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn remove(
    State(state): State<AppState>,
    Path(recall_item_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<RemoveLearnerRecallItemResult>, ApiError> {
    let recall_item_id = Uuid::parse_str(&recall_item_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerRecallRepository::new(&state.application_database);
    let removed = LearnerRecallCommand::new(&repository)
        .remove(&principal, recall_item_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    if !removed {
        return Err(ApiError::not_found());
    }

    Ok(Json(RemoveLearnerRecallItemResult {
        recall_item_id: recall_item_id.to_string(),
        removed,
    }))
}

pub async fn postpone(
    State(state): State<AppState>,
    Path(recall_item_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerRecallItem>, ApiError> {
    let recall_item_id = Uuid::parse_str(&recall_item_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerRecallRepository::new(&state.application_database);

    LearnerRecallCommand::new(&repository)
        .postpone(&principal, recall_item_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
