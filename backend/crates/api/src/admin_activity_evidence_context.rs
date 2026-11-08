use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_application::admin_activity_evidence_context::ActivityEvidenceContextForm;
use wicked_learning_persistence::admin_activity_evidence_context::{
    ActivityEvidenceContextError, PostgresAdminActivityEvidenceContextRepository,
};

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdateActivityEvidenceContextRequest {
    evidence_concepts: Vec<String>,
    evidence_objective: Option<String>,
    updated_at: String,
}
#[derive(Serialize)]
pub struct UpdateActivityEvidenceContextResponse {
    pub activity_id: Uuid,
    pub updated_at: String,
}

pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateActivityEvidenceContextRequest>,
) -> Result<Json<UpdateActivityEvidenceContextResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let form = ActivityEvidenceContextForm::parse(
        request.evidence_objective.as_deref(),
        request
            .evidence_concepts
            .iter()
            .map(String::as_str)
            .collect(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresAdminActivityEvidenceContextRepository::new(&state.application_database);
    let updated = repository
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateActivityEvidenceContextResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}
fn map_error(error: ActivityEvidenceContextError) -> ApiError {
    match error {
        ActivityEvidenceContextError::Conflict => ApiError::conflict(),
        ActivityEvidenceContextError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateActivityEvidenceContextRequest;
    #[test]
    fn requires_the_complete_source_orientation_form() {
        assert!(serde_json::from_str::<UpdateActivityEvidenceContextRequest>(r#"{"evidence_objective":null,"evidence_concepts":[],"updated_at":"2026-11-08T09:00:00.000000Z"}"#).is_ok());
        assert!(
            serde_json::from_str::<UpdateActivityEvidenceContextRequest>(
                r#"{"updated_at":"2026-11-08T09:00:00.000000Z"}"#
            )
            .is_err()
        );
    }
}
