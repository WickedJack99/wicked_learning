use axum::{
    Json,
    extract::{Path, State},
};
use axum_login::AuthSession;
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;
use wicked_learning_application::learner_activity_translation::LearnerActivityTranslationQuery;
use wicked_learning_persistence::learner_activity_translation::PostgresLearnerActivityTranslationRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Serialize)]
pub struct ActiveActivityTranslationResponse {
    pub translation: Option<Value>,
}

/// Returns only learner-facing translated copy for the authenticated learner's
/// current route activity. This deliberately does not expose an arbitrary
/// activity translation lookup and cannot alter player behavior.
pub async fn show(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<ActiveActivityTranslationResponse>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerActivityTranslationRepository::new(&state.application_database);
    let active_translation = LearnerActivityTranslationQuery::new(&repository)
        .execute(&principal, play_run_id, &activity_slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;

    Ok(Json(ActiveActivityTranslationResponse {
        translation: active_translation.translation,
    }))
}
