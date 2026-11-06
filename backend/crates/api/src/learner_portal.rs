use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use uuid::Uuid;
use wicked_learning_application::learner_portal::LearnerPortalTravelCommand;
use wicked_learning_domain::learner_state::LearnerPortalTravelResult;
use wicked_learning_persistence::learner_portal::PostgresLearnerPortalRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

pub async fn travel(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerPortalTravelResult>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerPortalRepository::new(&state.application_database);

    LearnerPortalTravelCommand::new(&repository)
        .execute(&principal, play_run_id, &activity_slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
