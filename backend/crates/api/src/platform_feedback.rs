use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Deserialize;
use wicked_learning_application::platform_feedback::{
    PlatformFeedbackDraft, SubmitPlatformFeedbackCommand,
};
use wicked_learning_persistence::platform_feedback::PostgresPlatformFeedbackRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct SubmitPlatformFeedbackRequest {
    category: String,
    message: String,
}

pub async fn submit(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SubmitPlatformFeedbackRequest>,
) -> Result<StatusCode, ApiError> {
    let draft = PlatformFeedbackDraft::parse(request.category, request.message)
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresPlatformFeedbackRepository::new(&state.application_database);

    SubmitPlatformFeedbackCommand::new(&repository)
        .execute(&principal, &draft)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(StatusCode::NO_CONTENT)
}
