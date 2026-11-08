use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::admin_world_node_manual_unlock::{
    AdminWorldNodeManualUnlockCommand, SetWorldNodeManualUnlockForm,
};
use wicked_learning_persistence::admin_world_node_manual_unlock::PostgresAdminWorldNodeManualUnlockRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct SetWorldNodeManualUnlockRequest {
    enabled: bool,
    learner_subject_id: Uuid,
}

/// Applies or revokes an explicit, support-scoped override for a locked node.
/// The server rechecks both editable-map and learner-signal scopes; a browser
/// cannot use this route to select an otherwise unavailable learner.
pub async fn set_manual_unlock(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SetWorldNodeManualUnlockRequest>,
) -> Result<StatusCode, ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNodeManualUnlockRepository::new(&state.application_database);
    AdminWorldNodeManualUnlockCommand::new(&repository)
        .execute(
            &principal,
            node_id,
            SetWorldNodeManualUnlockForm {
                enabled: request.enabled,
                learner_subject_id: request.learner_subject_id,
            },
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .then_some(())
        .ok_or_else(ApiError::not_found)?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::SetWorldNodeManualUnlockRequest;

    #[test]
    fn manual_unlock_request_requires_learner_and_state() {
        assert!(
            serde_json::from_str::<SetWorldNodeManualUnlockRequest>(
                r#"{"learner_subject_id":"00000000-0000-4000-8000-000000000001","enabled":true}"#,
            )
            .is_ok()
        );
        assert!(
            serde_json::from_str::<SetWorldNodeManualUnlockRequest>(r#"{"enabled":true}"#,)
                .is_err()
        );
    }
}
