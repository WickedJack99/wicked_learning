use axum::{
    Json,
    extract::{Query, State},
    response::{IntoResponse, Response},
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::learner_companion::{
    LearnerCompanionError, LearnerCompanionQuery, LearnerCompanionRequest,
};
use wicked_learning_persistence::learner_companion::PostgresLearnerCompanionRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct LearnerCompanionQueryParameters {
    activity_id: Option<String>,
    map_slug: Option<String>,
    surface: String,
}

pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
    Query(query): Query<LearnerCompanionQueryParameters>,
) -> Result<Response, ApiError> {
    let activity_id = query
        .activity_id
        .as_deref()
        .map(Uuid::parse_str)
        .transpose()
        .map_err(|_| ApiError::invalid_request())?;
    let request =
        LearnerCompanionRequest::parse(&query.surface, query.map_slug.as_deref(), activity_id)
            .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerCompanionRepository::new(&state.application_database);
    match LearnerCompanionQuery::new(&repository)
        .execute(&principal, &request)
        .await
        .map_err(map_error)?
    {
        Some(companion) => Ok(Json(companion).into_response()),
        None => Ok(axum::http::StatusCode::NO_CONTENT.into_response()),
    }
}

fn map_error(error: LearnerCompanionError) -> ApiError {
    match error {
        LearnerCompanionError::Unavailable => ApiError::service_unavailable(),
    }
}
