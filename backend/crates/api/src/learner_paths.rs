use axum::{
    Json,
    extract::{Query, State},
};
use axum_login::AuthSession;
use serde::Deserialize;
use wicked_learning_application::learner_paths::{LearnerPathsQuery, LearnerPathsRequest};
use wicked_learning_domain::learner_state::LearnerPaths;
use wicked_learning_persistence::learner_paths::PostgresLearnerPathsRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct LearnerPathsQueryParameters {
    page: Option<String>,
    purpose: Option<String>,
    time: Option<String>,
    topic: Option<String>,
}

pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<LearnerPathsQueryParameters>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerPaths>, ApiError> {
    let request = LearnerPathsRequest::source_normalized(
        query.page.as_deref().and_then(|value| value.parse().ok()),
        query.purpose.as_deref(),
        query.time.as_deref().and_then(|value| value.parse().ok()),
        query.topic.as_deref(),
    );
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerPathsRepository::new(&state.application_database);

    LearnerPathsQuery::new(&repository)
        .execute(&principal, &request)
        .await
        .map_err(|_| ApiError::service_unavailable())
        .map(Json)
}
