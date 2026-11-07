use axum::{
    Json,
    extract::{Path, State},
};
use axum_login::AuthSession;
use uuid::Uuid;
use wicked_learning_application::admin_world_node::AdminWorldNodeQuery;
use wicked_learning_domain::world_content::AdminEditableNode;
use wicked_learning_persistence::admin_world_node::PostgresAdminWorldNodeRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

/// Reads the original World Builder's selected-node activity graph. This is a
/// read-only prerequisite for lifting its existing React editor; no authoring
/// mutation is enabled by this route.
pub async fn show(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminEditableNode>, ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminWorldNodeRepository::new(&state.application_database);

    AdminWorldNodeQuery::new(&repository)
        .execute(&principal, node_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
