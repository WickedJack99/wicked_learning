use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};
use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_application::admin_activity_feedback_guidance::ActivityFeedbackGuidanceForm;
use wicked_learning_persistence::admin_activity_feedback_guidance::{
    ActivityFeedbackGuidanceError, PostgresAdminActivityFeedbackGuidanceRepository,
};

#[derive(Deserialize)]
pub struct UpdateActivityFeedbackGuidanceRequest {
    evidence: Option<String>,
    independent_check_feedback: Option<String>,
    independent_check_prompt: Option<String>,
    next_action: Option<String>,
    purpose: Option<String>,
    response_feedback: Option<String>,
    rubric: Vec<String>,
    updated_at: String,
}
#[derive(Serialize)]
pub struct UpdateActivityFeedbackGuidanceResponse {
    pub activity_id: Uuid,
    pub updated_at: String,
}
pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateActivityFeedbackGuidanceRequest>,
) -> Result<Json<UpdateActivityFeedbackGuidanceResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let form = ActivityFeedbackGuidanceForm::parse(
        request.purpose.as_deref(),
        request.evidence.as_deref(),
        request.response_feedback.as_deref(),
        request.next_action.as_deref(),
        request.rubric.iter().map(String::as_str).collect(),
        request.independent_check_prompt.as_deref(),
        request.independent_check_feedback.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresAdminActivityFeedbackGuidanceRepository::new(&state.application_database);
    let updated = repository
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateActivityFeedbackGuidanceResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}
fn map_error(error: ActivityFeedbackGuidanceError) -> ApiError {
    match error {
        ActivityFeedbackGuidanceError::Conflict => ApiError::conflict(),
        ActivityFeedbackGuidanceError::Unavailable => ApiError::service_unavailable(),
    }
}
#[cfg(test)]
mod tests {
    use super::UpdateActivityFeedbackGuidanceRequest;
    #[test]
    fn requires_a_complete_feedback_guidance_form() {
        assert!(serde_json::from_str::<UpdateActivityFeedbackGuidanceRequest>(r#"{"purpose":null,"evidence":null,"response_feedback":null,"next_action":null,"rubric":[],"independent_check_prompt":null,"independent_check_feedback":null,"updated_at":"2026-11-08T09:00:00.000000Z"}"#).is_ok());
        assert!(
            serde_json::from_str::<UpdateActivityFeedbackGuidanceRequest>(
                r#"{"updated_at":"2026-11-08T09:00:00.000000Z"}"#
            )
            .is_err()
        );
    }
}
