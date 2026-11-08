use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_application::admin_activity_learning_design::{
    LearningDesignForm, SubmittedCompetenceTopic,
};
use wicked_learning_persistence::admin_activity_learning_design::{
    ActivityLearningDesignError, PostgresAdminActivityLearningDesignRepository,
};

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdateActivityLearningDesignRequest {
    learning_intent: NullableString,
    competence_topics: Vec<CompetenceTopicRequest>,
    updated_at: String,
}

#[derive(Deserialize)]
pub struct CompetenceTopicRequest {
    topic: String,
    weight: f64,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum NullableString {
    Text(String),
    Null(()),
}

impl NullableString {
    fn as_deref(&self) -> Option<&str> {
        match self {
            Self::Text(value) => Some(value),
            Self::Null(()) => None,
        }
    }
}

#[derive(Serialize)]
pub struct UpdateActivityLearningDesignResponse {
    pub activity_id: Uuid,
    pub updated_at: String,
}

/// Saves a tutor-reviewed learning-design draft. This endpoint never receives
/// a provider response; an AI review can only prefill the browser form.
pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateActivityLearningDesignRequest>,
) -> Result<Json<UpdateActivityLearningDesignResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let form = LearningDesignForm::parse(
        request.learning_intent.as_deref(),
        request
            .competence_topics
            .iter()
            .map(|topic| SubmittedCompetenceTopic {
                name: &topic.topic,
                weight: topic.weight,
            })
            .collect(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresAdminActivityLearningDesignRepository::new(&state.application_database);
    let updated = repository
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateActivityLearningDesignResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}

fn map_error(error: ActivityLearningDesignError) -> ApiError {
    match error {
        ActivityLearningDesignError::Conflict => ApiError::conflict(),
        ActivityLearningDesignError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateActivityLearningDesignRequest;

    #[test]
    fn requires_an_explicit_complete_learning_design_save() {
        assert!(serde_json::from_str::<UpdateActivityLearningDesignRequest>(
            r#"{"learning_intent":"explain","competence_topics":[{"topic":"Systems Thinking","weight":1}],"updated_at":"2026-11-08T09:00:00.000000Z"}"#,
        )
        .is_ok());
        assert!(
            serde_json::from_str::<UpdateActivityLearningDesignRequest>(
                r#"{"learning_intent":null,"updated_at":"2026-11-08T09:00:00.000000Z"}"#,
            )
            .is_err()
        );
    }
}
