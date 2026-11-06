use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};
use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use wicked_learning_application::feedback_prompt_preference::{
    FeedbackPromptAction, FeedbackPromptPreference, FeedbackPromptPreferenceQuery,
    UpdateFeedbackPromptPreferenceCommand,
};
use wicked_learning_persistence::feedback_prompt_preference::PostgresFeedbackPromptPreferenceRepository;
#[derive(Deserialize)]
pub struct UpdateFeedbackPromptPreferenceRequest {
    action: String,
}
#[derive(Serialize)]
pub struct FeedbackPromptPreferenceResponse {
    pub status: String,
}
pub async fn show(
    State(state): State<AppState>,
    auth: AuthSession<IdentityBackend>,
) -> Result<Json<FeedbackPromptPreferenceResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth).await?;
    let repository = PostgresFeedbackPromptPreferenceRepository::new(&state.application_database);
    FeedbackPromptPreferenceQuery::new(&repository)
        .execute(&principal)
        .await
        .map(response)
        .map(Json)
        .map_err(|_| ApiError::service_unavailable())
}
pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateFeedbackPromptPreferenceRequest>,
) -> Result<Json<FeedbackPromptPreferenceResponse>, ApiError> {
    let action =
        FeedbackPromptAction::parse(&request.action).ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresFeedbackPromptPreferenceRepository::new(&state.application_database);
    UpdateFeedbackPromptPreferenceCommand::new(&repository)
        .execute(&principal, action)
        .await
        .map(response)
        .map(Json)
        .map_err(|_| ApiError::service_unavailable())
}
fn response(preference: FeedbackPromptPreference) -> FeedbackPromptPreferenceResponse {
    FeedbackPromptPreferenceResponse {
        status: preference.status,
    }
}
