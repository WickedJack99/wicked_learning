use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use wicked_learning_application::learner_activity_replay_run::LearnerActivityReplayRunCommand;
use wicked_learning_domain::learner_state::LearnerActivityReplayRun;
use wicked_learning_persistence::learner_activity_replay_run::PostgresLearnerActivityReplayRunRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

/// Opens or resumes a server-authorized historical activity playback. The
/// activity slug is resolved against the caller's current visible World; the
/// browser cannot construct a normal route run from historical page data.
pub async fn open_or_resume(
    State(state): State<AppState>,
    Path(activity_slug): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerActivityReplayRun>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerActivityReplayRunRepository::new(&state.application_database);

    LearnerActivityReplayRunCommand::new(&repository)
        .open_or_resume(&principal, &activity_slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
