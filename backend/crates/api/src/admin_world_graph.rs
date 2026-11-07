use axum::{Json, extract::State};
use axum_login::AuthSession;
use wicked_learning_application::admin_world_graph::AdminWorldGraphQuery;
use wicked_learning_domain::world_content::AdminWorldGraph;
use wicked_learning_persistence::admin_world_graph::PostgresAdminWorldGraphRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

/// Returns the source-shaped World Builder overview for the signed-in author's
/// scoped maps. Authoring mutations stay deliberately outside this first read
/// contract.
pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminWorldGraph>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminWorldGraphRepository::new(&state.application_database);

    AdminWorldGraphQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
