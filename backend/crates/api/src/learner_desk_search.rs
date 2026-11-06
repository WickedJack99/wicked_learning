use axum::{
    Json,
    extract::{Query, State},
};
use axum_login::AuthSession;
use serde::Deserialize;
use wicked_learning_application::learner_desk_search::{
    LearnerDeskSearchQuery, LearnerDeskSearchRequest,
};
use wicked_learning_domain::learner_state::LearnerDeskSearch;
use wicked_learning_persistence::learner_desk_search::PostgresLearnerDeskSearchRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct LearnerDeskSearchQueryParameters {
    page: Option<i64>,
    per_page: Option<i64>,
    query: Option<String>,
}

pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<LearnerDeskSearchQueryParameters>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerDeskSearch>, ApiError> {
    let request =
        LearnerDeskSearchRequest::parse(query.query.as_deref(), query.page, query.per_page)
            .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerDeskSearchRepository::new(&state.application_database);

    LearnerDeskSearchQuery::new(&repository)
        .execute(&principal, &request)
        .await
        .map_err(|_| ApiError::service_unavailable())
        .map(Json)
}
