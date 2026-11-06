use axum::{Json, extract::State};
use axum_login::AuthSession;
use serde::Serialize;
use uuid::Uuid;
use wicked_learning_application::current_user::CurrentUserQuery;
use wicked_learning_domain::learner_state::LearnerAppearance;
use wicked_learning_persistence::current_user::PostgresCurrentUserRepository;

use crate::{AppState, error::ApiError, identity::IdentityBackend};

#[derive(Serialize)]
pub struct CurrentUserResponse {
    pub appearance: LearnerAppearance,
    pub email: String,
    pub subject_id: Uuid,
    pub roles: Vec<String>,
}

pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<CurrentUserResponse>, ApiError> {
    let subject = auth_session
        .user
        .ok_or_else(ApiError::authentication_required)?;
    let subject_id = subject.subject_id();
    let repository = PostgresCurrentUserRepository::new(&state.application_database);
    let current_user = CurrentUserQuery::new(&repository)
        .execute(subject_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::forbidden)?;

    Ok(Json(CurrentUserResponse {
        appearance: current_user.appearance,
        email: subject.normalized_email().to_owned(),
        subject_id: current_user.principal.subject_id,
        roles: current_user.principal.roles,
    }))
}
