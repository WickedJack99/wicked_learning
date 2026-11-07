use axum::{
    Json,
    extract::{Path, State},
};
use axum_login::AuthSession;
use uuid::Uuid;
use wicked_learning_application::admin_world_map::AdminWorldMapQuery;
use wicked_learning_domain::world_content::AdminEditableMap;
use wicked_learning_persistence::admin_world_map::PostgresAdminWorldMapRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

/// Reads the original World Builder's selected-map configuration projection.
/// The endpoint deliberately has no update method until its complete source
/// mutation, validation and optimistic-concurrency behavior is migrated.
pub async fn show(
    State(state): State<AppState>,
    Path(map_id): Path<String>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminEditableMap>, ApiError> {
    let map_id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminWorldMapRepository::new(&state.application_database);

    AdminWorldMapQuery::new(&repository)
        .execute(&principal, map_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
