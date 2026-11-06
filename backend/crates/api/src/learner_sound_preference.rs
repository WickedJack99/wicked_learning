use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};
use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use serde::Deserialize;
use wicked_learning_application::learner_sound_preference::{
    LearnerSoundPreferenceCommand, LearnerSoundPreferenceDraft, LearnerSoundPreferenceQuery,
};
use wicked_learning_domain::learner_state::LearnerSoundPreferences;
use wicked_learning_persistence::learner_sound_preference::PostgresLearnerSoundPreferenceRepository;

#[derive(Deserialize)]
pub struct UpdateLearnerSoundPreferencesRequest {
    muted: bool,
    effects_volume: i16,
    ambience_volume: i16,
}
pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerSoundPreferences>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerSoundPreferenceRepository::new(&state.application_database);
    LearnerSoundPreferenceQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())
        .map(Json)
}
pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateLearnerSoundPreferencesRequest>,
) -> Result<Json<LearnerSoundPreferences>, ApiError> {
    let draft = LearnerSoundPreferenceDraft::parse(
        request.muted,
        request.effects_volume,
        request.ambience_volume,
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerSoundPreferenceRepository::new(&state.application_database);
    LearnerSoundPreferenceCommand::new(&repository)
        .execute(&principal, draft)
        .await
        .map_err(|_| ApiError::service_unavailable())
        .map(Json)
}
