use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use wicked_learning_application::learner_appearance_preference::LearnerAppearancePreferenceCommand;
use wicked_learning_domain::learner_state::LearnerAppearance;
use wicked_learning_persistence::learner_appearance_preference::PostgresLearnerAppearancePreferenceRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdateLearnerAppearanceRequest {
    appearance: String,
}

#[derive(Serialize)]
pub struct LearnerAppearancePreferenceResponse {
    pub appearance: LearnerAppearance,
}

pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateLearnerAppearanceRequest>,
) -> Result<Json<LearnerAppearancePreferenceResponse>, ApiError> {
    let appearance =
        LearnerAppearance::parse(&request.appearance).ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresLearnerAppearancePreferenceRepository::new(&state.application_database);
    let appearance = LearnerAppearancePreferenceCommand::new(&repository)
        .execute(&principal, appearance)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(Json(LearnerAppearancePreferenceResponse { appearance }))
}
