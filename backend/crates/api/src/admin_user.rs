use axum::{Json, extract::State};
use axum_login::AuthSession;
use wicked_learning_application::admin_user::AdminUsersQuery;
use wicked_learning_domain::identity_access::AdminUsers;
use wicked_learning_persistence::admin_user::PostgresAdminUserRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

pub async fn index(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminUsers>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository =
        PostgresAdminUserRepository::new(&state.application_database, &state.identity_database);
    AdminUsersQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
