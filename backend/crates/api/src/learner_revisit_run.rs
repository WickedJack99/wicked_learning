use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use uuid::Uuid;
use wicked_learning_application::learner_revisit_run::LearnerRevisitRunCommand;
use wicked_learning_domain::learner_state::LearnerRevisitRun;
use wicked_learning_persistence::learner_revisit_run::PostgresLearnerRevisitRunRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

/// Opens or resumes the caller's already-due private revisit. The server
/// derives its activity and playback ID from the invitation; the request
/// contains no browser-selected activity or revisit flag.
pub async fn open_or_resume(
    State(state): State<AppState>,
    Path(check_in_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerRevisitRun>, ApiError> {
    let check_in_id = Uuid::parse_str(&check_in_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerRevisitRunRepository::new(&state.application_database);

    LearnerRevisitRunCommand::new(&repository)
        .open_or_resume_due_invitation(&principal, check_in_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
