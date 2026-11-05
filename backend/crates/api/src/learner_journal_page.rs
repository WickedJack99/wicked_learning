use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::learner_journal_page::{
    LearnerJournalPageCommand, LearnerJournalPageDraft,
};
use wicked_learning_domain::learner_state::LearnerJournalPage;
use wicked_learning_persistence::learner_journal_page::PostgresLearnerJournalPageRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct CreateLearnerJournalPageRequest {
    markdown: Option<String>,
    preferred_mode: Option<String>,
    subtopic: Option<String>,
    title: String,
    topic: String,
}

#[derive(Deserialize)]
pub struct UpdateLearnerJournalPageRequest {
    markdown: Option<String>,
    preferred_mode: String,
    subtopic: Option<String>,
    title: String,
    topic: String,
}

#[derive(Serialize)]
pub struct LearnerJournalPageResponse {
    page: LearnerJournalPage,
}

#[derive(Serialize)]
pub struct DeleteLearnerJournalPageResponse {
    deleted_page_id: String,
}

pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateLearnerJournalPageRequest>,
) -> Result<Json<LearnerJournalPageResponse>, ApiError> {
    let draft = LearnerJournalPageDraft::new(
        request.title,
        request.topic,
        request.subtopic,
        request.markdown,
        request.preferred_mode,
        "edit",
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerJournalPageRepository::new(&state.application_database);
    let page = LearnerJournalPageCommand::new(&repository)
        .create(&principal, &draft)
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(LearnerJournalPageResponse { page }))
}

pub async fn update(
    State(state): State<AppState>,
    Path(page_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateLearnerJournalPageRequest>,
) -> Result<Json<LearnerJournalPageResponse>, ApiError> {
    let page_id = Uuid::parse_str(&page_id).map_err(|_| ApiError::not_found())?;
    let draft = LearnerJournalPageDraft::new(
        request.title,
        request.topic,
        request.subtopic,
        request.markdown,
        Some(request.preferred_mode),
        "edit",
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerJournalPageRepository::new(&state.application_database);
    let page = LearnerJournalPageCommand::new(&repository)
        .update(&principal, page_id, &draft)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;

    Ok(Json(LearnerJournalPageResponse { page }))
}

pub async fn delete(
    State(state): State<AppState>,
    Path(page_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<DeleteLearnerJournalPageResponse>, ApiError> {
    let page_id = Uuid::parse_str(&page_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerJournalPageRepository::new(&state.application_database);
    let deleted = LearnerJournalPageCommand::new(&repository)
        .delete(&principal, page_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    if !deleted {
        return Err(ApiError::not_found());
    }

    Ok(Json(DeleteLearnerJournalPageResponse {
        deleted_page_id: page_id.to_string(),
    }))
}
