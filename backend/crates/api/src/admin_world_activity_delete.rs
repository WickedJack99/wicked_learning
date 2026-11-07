use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use uuid::Uuid;
use wicked_learning_application::admin_world_activity_delete::AdminWorldActivityDeleteCommand;
use wicked_learning_persistence::admin_world_activity_delete::PostgresAdminWorldActivityDeleteRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

/// Deletes an authored activity using the source activity-editor scope. The
/// frontend refetches the selected node after this no-content command, exactly
/// as the Laravel redirect reloads its graph.
pub async fn delete(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldActivityDeleteRepository::new(&state.application_database);
    let deleted = AdminWorldActivityDeleteCommand::new(&repository)
        .execute(&principal, activity_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    if !deleted {
        return Err(ApiError::not_found());
    }
    Ok(StatusCode::NO_CONTENT)
}
