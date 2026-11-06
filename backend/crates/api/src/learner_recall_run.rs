use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use uuid::Uuid;
use wicked_learning_application::learner_recall_run::LearnerRecallRunCommand;
use wicked_learning_domain::learner_state::LearnerRecallRun;
use wicked_learning_persistence::learner_recall_run::PostgresLearnerRecallRunRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

/// Opens or resumes the caller's private queued question. The item ID is only
/// an opaque handle: the database derives activity/context after owner and
/// current map-access checks.
pub async fn open_or_resume(
    State(state): State<AppState>,
    Path(recall_item_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerRecallRun>, ApiError> {
    let recall_item_id = Uuid::parse_str(&recall_item_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerRecallRunRepository::new(&state.application_database);

    LearnerRecallRunCommand::new(&repository)
        .open_or_resume(&principal, recall_item_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
