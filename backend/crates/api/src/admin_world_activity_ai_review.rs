use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use wicked_learning_application::admin_activity_ai_review::validate_activity_review;
use wicked_learning_persistence::admin_activity_ai_review::PostgresAdminActivityAiReviewRepository;

use crate::{
    AppState, ai_provider::AiProvider, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct ReviewActivityRequest {
    template_id: Uuid,
}

#[derive(Serialize)]
pub struct ReviewActivityResponse {
    pub activity_id: Uuid,
    pub ai_review_status: String,
    pub ai_reviewed_at: String,
    pub ai_review: Value,
}

/// Executes one explicitly requested, source-scoped authoring review. The
/// model result is validated before the write; no review value can alter an
/// activity's authored metadata or learner state.
pub async fn create(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<ReviewActivityRequest>,
) -> Result<Json<ReviewActivityResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    if !principal.has_permission("ai", "ru") {
        return Err(ApiError::forbidden());
    }
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminActivityAiReviewRepository::new(&state.application_database);
    let execution = repository
        .prepare(&principal, activity_id, request.template_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    let provider = execution.provider.clone();
    let model = execution.model.clone();
    let output = AiProvider::review_activity(execution, &state.ai_credential_cipher)
        .await
        .map_err(|_| ApiError::ai_review_rejected())?;
    let review =
        validate_activity_review(output.review).map_err(|_| ApiError::ai_review_rejected())?;
    let saved = repository
        .save(
            &principal,
            activity_id,
            request.template_id,
            &provider,
            &model,
            review,
            output.usage,
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(ReviewActivityResponse {
        activity_id: saved.activity_id,
        ai_review_status: saved.ai_review_status,
        ai_reviewed_at: saved.ai_reviewed_at,
        ai_review: saved.ai_review,
    }))
}

#[cfg(test)]
mod tests {
    use super::ReviewActivityRequest;

    #[test]
    fn accepts_the_source_template_selection_shape() {
        let request = serde_json::from_str::<ReviewActivityRequest>(
            r#"{"template_id":"00000000-0000-4000-8000-000000000001"}"#,
        )
        .expect("request");
        assert_eq!(
            request.template_id.to_string(),
            "00000000-0000-4000-8000-000000000001"
        );
    }
}
