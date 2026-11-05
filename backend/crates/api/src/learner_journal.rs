use axum::{
    Json,
    extract::{Query, State},
};
use axum_login::AuthSession;
use serde::Deserialize;
use wicked_learning_application::learner_journal::{LearnerJournalQuery, LearnerJournalRequest};
use wicked_learning_domain::learner_state::LearnerJournalDocument;
use wicked_learning_persistence::learner_journal::PostgresLearnerJournalRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct LearnerJournalQueryParameters {
    page: Option<i64>,
    per_page: Option<i64>,
    search: Option<String>,
}

pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<LearnerJournalQueryParameters>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerJournalDocument>, ApiError> {
    let request = LearnerJournalRequest::parse(query.page, query.per_page, query.search.as_deref())
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerJournalRepository::new(&state.application_database);

    LearnerJournalQuery::new(&repository)
        .execute(&principal, &request)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::forbidden)
}
