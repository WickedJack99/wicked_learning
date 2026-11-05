use axum::{Json, extract::State};
use axum_login::AuthSession;
use wicked_learning_application::learner_bookmark_map::LearnerBookmarkMapQuery;
use wicked_learning_domain::learner_state::LearnerBookmarkMap;
use wicked_learning_persistence::learner_bookmark_map::PostgresLearnerBookmarkMapRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerBookmarkMap>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerBookmarkMapRepository::new(&state.application_database);

    LearnerBookmarkMapQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::forbidden)
}
