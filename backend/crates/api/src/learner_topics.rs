use axum::{
    Json,
    extract::{Query, State},
};
use axum_login::AuthSession;
use serde::Deserialize;
use wicked_learning_application::learner_topics::{
    LearnerTopicDirectoryQuery, LearnerTopicDirectoryRequest,
};
use wicked_learning_domain::learner_state::LearnerTopicDirectory;
use wicked_learning_persistence::learner_topics::PostgresLearnerTopicDirectoryRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct LearnerTopicQueryParameters {
    area: Option<String>,
    page: Option<i64>,
    search: Option<String>,
}

pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<LearnerTopicQueryParameters>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerTopicDirectory>, ApiError> {
    let request = LearnerTopicDirectoryRequest::parse(
        query.area.as_deref(),
        query.page,
        query.search.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerTopicDirectoryRepository::new(&state.application_database);

    LearnerTopicDirectoryQuery::new(&repository)
        .execute(&principal, &request)
        .await
        .map_err(|_| ApiError::service_unavailable())
        .map(Json)
}
