use axum::{Json, extract::State};
use axum_login::AuthSession;
use serde::Serialize;
use std::collections::BTreeMap;
use wicked_learning_application::learner_platform_translation::LearnerPlatformTranslationQuery;
use wicked_learning_persistence::learner_platform_translation::PostgresLearnerPlatformTranslationRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Serialize)]
pub struct LearnerPlatformTranslationResponse {
    pub locale: String,
    pub translations: BTreeMap<String, String>,
}

/// Resolves the signed-in learner's platform strings from their private
/// enabled locale preference, with canonical English as a safe fallback.
pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerPlatformTranslationResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerPlatformTranslationRepository::new(&state.application_database);
    let catalog = LearnerPlatformTranslationQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(LearnerPlatformTranslationResponse {
        locale: catalog.locale,
        translations: catalog.translations,
    }))
}
