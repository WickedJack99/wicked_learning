use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::learner_support::{
    LearnerSupportDeskQuery, LearnerSupportRequestCommand, LearnerSupportRequestQuery,
};
use wicked_learning_domain::learner_state::{
    LearnerDeskSupportResponse, LearnerSupportRequestState,
};
use wicked_learning_persistence::learner_support::PostgresLearnerSupportRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct SubmitSupportRequest {
    body: String,
}

pub async fn show_current_request(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerSupportRequestState>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerSupportRepository::new(&state.application_database);

    LearnerSupportRequestQuery::new(&repository)
        .execute(&principal, play_run_id, &activity_slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn submit_current_request(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SubmitSupportRequest>,
) -> Result<Json<LearnerSupportRequestState>, ApiError> {
    if !(2..=280).contains(&request.body.trim().chars().count()) {
        return Err(ApiError::invalid_request());
    }
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerSupportRepository::new(&state.application_database);

    LearnerSupportRequestCommand::new(&repository)
        .execute(&principal, play_run_id, &activity_slug, &request.body)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn desk_responses(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<Vec<LearnerDeskSupportResponse>>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerSupportRepository::new(&state.application_database);

    LearnerSupportDeskQuery::new(&repository)
        .execute(&principal)
        .await
        .map(Json)
        .map_err(|_| ApiError::service_unavailable())
}
