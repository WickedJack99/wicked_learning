use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::learner_journal_feedback::{
    RequestJournalFeedbackResult, RequestLearnerJournalFeedback,
};
use wicked_learning_domain::learner_state::LearnerJournalPage;
use wicked_learning_persistence::learner_journal_feedback::PostgresLearnerJournalFeedbackRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct RequestJournalFeedbackBody {
    domain_key: String,
}

#[derive(serde::Serialize)]
pub struct LearnerJournalFeedbackResponse {
    page: LearnerJournalPage,
}

pub async fn request(
    State(state): State<AppState>,
    Path(page_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(body): Json<RequestJournalFeedbackBody>,
) -> Result<Json<LearnerJournalFeedbackResponse>, ApiError> {
    let page_id = Uuid::parse_str(&page_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerJournalFeedbackRepository::new(&state.application_database);
    let (result, page) = RequestLearnerJournalFeedback::new(&repository)
        .execute(&principal, page_id, &body.domain_key)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    match result {
        RequestJournalFeedbackResult::Requested => page
            .map(|page| Json(LearnerJournalFeedbackResponse { page }))
            .ok_or_else(ApiError::not_found),
        RequestJournalFeedbackResult::NotFound => Err(ApiError::not_found()),
        RequestJournalFeedbackResult::AlreadyResponded
        | RequestJournalFeedbackResult::Disabled
        | RequestJournalFeedbackResult::InvalidDomain => Err(ApiError::journal_feedback_rejected()),
    }
}
