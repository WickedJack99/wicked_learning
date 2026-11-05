use axum::{
    Json,
    extract::{Path, Query, State},
};
use axum_login::AuthSession;
use serde::Deserialize;
use wicked_learning_application::learner_topic_detail::{
    LearnerTopicDetailQuery, LearnerTopicDetailRequest,
};
use wicked_learning_domain::learner_state::{LearnerTopicMaps, LearnerTopicOverview};
use wicked_learning_persistence::learner_topic_detail::PostgresLearnerTopicDetailRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct TopicDetailQueryParameters {
    maps_page: Option<i64>,
    subtopics_page: Option<i64>,
}

pub async fn maps(
    State(state): State<AppState>,
    Path(topic_slug): Path<String>,
    Query(query): Query<TopicDetailQueryParameters>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerTopicMaps>, ApiError> {
    let request = LearnerTopicDetailRequest::parse(&topic_slug, query.maps_page)
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerTopicDetailRepository::new(&state.application_database);

    LearnerTopicDetailQuery::new(&repository)
        .maps(&principal, &request)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn overview(
    State(state): State<AppState>,
    Path(topic_slug): Path<String>,
    Query(query): Query<TopicDetailQueryParameters>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerTopicOverview>, ApiError> {
    let request = LearnerTopicDetailRequest::parse(&topic_slug, query.subtopics_page)
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerTopicDetailRepository::new(&state.application_database);

    LearnerTopicDetailQuery::new(&repository)
        .overview(&principal, &request)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
