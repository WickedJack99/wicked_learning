use axum::{Json, extract::State};
use axum_login::AuthSession;
use wicked_learning_application::{
    current_user::CurrentUserQuery, learner_world::LearnerWorldQuery,
};
use wicked_learning_domain::learner_state::LearnerWorldSnapshot;
use wicked_learning_persistence::{
    current_user::PostgresCurrentUserRepository, learner_world::PostgresLearnerWorldRepository,
};

use crate::{AppState, error::ApiError, identity::IdentityBackend};

pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerWorldSnapshot>, ApiError> {
    let subject = auth_session
        .user
        .ok_or_else(ApiError::authentication_required)?;
    let principal_repository = PostgresCurrentUserRepository::new(&state.application_database);
    let current_user = CurrentUserQuery::new(&principal_repository)
        .execute(subject.subject_id())
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::forbidden)?;
    let world_repository = PostgresLearnerWorldRepository::new(&state.application_database);

    LearnerWorldQuery::new(&world_repository)
        .execute(&current_user.principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
