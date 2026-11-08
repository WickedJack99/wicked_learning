use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use uuid::Uuid;
use wicked_learning_application::admin_world_node_unlock::{
    AdminWorldNodeUnlockCommand, ResetWorldNodeUnlocksResult,
};
use wicked_learning_persistence::admin_world_node_unlock::PostgresAdminWorldNodeUnlockRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

/// Resets the source's learner-specific tool unlock records for one editable
/// node. Explicit support overrides and discovery records are intentionally
/// separate learner-state contracts.
pub async fn reset_tool_unlocks(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<ResetWorldNodeUnlocksResult>, ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNodeUnlockRepository::new(&state.application_database);
    AdminWorldNodeUnlockCommand::new(&repository)
        .reset_tool_unlocks(&principal, node_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
