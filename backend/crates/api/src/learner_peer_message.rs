use axum::{
    Json,
    extract::{Path, Query, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::learner_peer_message::{
    PeerMessagePromptQuery, PeerWallCommand, PeerWallQuery, valid_body, valid_response_type,
};
use wicked_learning_domain::learner_state::{
    LearnerPeerMessagePromptState, LearnerPeerMessageWall,
};
use wicked_learning_persistence::learner_peer_message::PostgresLearnerPeerMessageRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct Page {
    page: Option<i64>,
    per_page: Option<i64>,
}
#[derive(Deserialize)]
pub struct Contribution {
    body: String,
}
#[derive(Deserialize)]
pub struct Response {
    body: String,
    response_type: Option<String>,
}
#[derive(Deserialize)]
pub struct Helpfulness {
    helpful: bool,
}

pub async fn wall(
    State(state): State<AppState>,
    Path((run, slug)): Path<(String, String)>,
    Query(page): Query<Page>,
    auth: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerPeerMessageWall>, ApiError> {
    let run = Uuid::parse_str(&run).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth).await?;
    let repository = PostgresLearnerPeerMessageRepository::new(&state.application_database);
    PeerWallQuery::new(&repository)
        .execute(
            &principal,
            run,
            &slug,
            page.page.unwrap_or(1),
            page.per_page.unwrap_or(12),
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn contribute(
    State(state): State<AppState>,
    Path((run, slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
    Json(request): Json<Contribution>,
) -> Result<Json<LearnerPeerMessagePromptState>, ApiError> {
    if valid_body(&request.body).is_none() {
        return Err(ApiError::invalid_request());
    }
    let run = Uuid::parse_str(&run).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerPeerMessageRepository::new(&state.application_database);
    PeerWallCommand::new(&repository)
        .contribute(&principal, run, &slug, &request.body)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn prompt(
    State(state): State<AppState>,
    Path((run, slug)): Path<(String, String)>,
    auth: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerPeerMessagePromptState>, ApiError> {
    let run = Uuid::parse_str(&run).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth).await?;
    let repository = PostgresLearnerPeerMessageRepository::new(&state.application_database);
    PeerMessagePromptQuery::new(&repository)
        .execute(&principal, run, &slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn respond(
    State(state): State<AppState>,
    Path((run, slug, message_id)): Path<(String, String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
    Json(request): Json<Response>,
) -> Result<Json<LearnerPeerMessageWall>, ApiError> {
    if valid_body(&request.body).is_none()
        || valid_response_type(request.response_type.as_deref()).is_none()
    {
        return Err(ApiError::invalid_request());
    }
    let run = Uuid::parse_str(&run).map_err(|_| ApiError::not_found())?;
    let message_id = Uuid::parse_str(&message_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerPeerMessageRepository::new(&state.application_database);
    PeerWallCommand::new(&repository)
        .respond(
            &principal,
            run,
            &slug,
            message_id,
            &request.body,
            request.response_type.as_deref(),
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn helpful(
    State(state): State<AppState>,
    Path((run, slug, message_id, response_id)): Path<(String, String, String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
    Json(request): Json<Helpfulness>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let run = Uuid::parse_str(&run).map_err(|_| ApiError::not_found())?;
    let message_id = Uuid::parse_str(&message_id).map_err(|_| ApiError::not_found())?;
    let response_id = Uuid::parse_str(&response_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerPeerMessageRepository::new(&state.application_database);
    let helpful = PeerWallCommand::new(&repository)
        .mark_helpful(
            &principal,
            run,
            &slug,
            message_id,
            response_id,
            request.helpful,
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(serde_json::json!({"helpful": helpful})))
}
