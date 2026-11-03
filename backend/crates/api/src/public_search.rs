use axum::{
    Json,
    extract::{Query, State},
};
use serde::Deserialize;
use wicked_learning_application::public_search::{PublicSearchQuery, PublicSearchTerm};
use wicked_learning_domain::world_content::PublicSearchResponse;
use wicked_learning_persistence::public_search::PostgresPublicSearchRepository;

use crate::{AppState, error::ApiError};

#[derive(Deserialize)]
pub struct PublicSearchQueryParameters {
    q: String,
}

pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<PublicSearchQueryParameters>,
) -> Result<Json<PublicSearchResponse>, ApiError> {
    let term = PublicSearchTerm::parse(&query.q).ok_or_else(ApiError::invalid_request)?;
    let repository = PostgresPublicSearchRepository::new(&state.application_database);

    PublicSearchQuery::new(&repository)
        .execute(&term)
        .await
        .map(Json)
        .map_err(|_| ApiError::service_unavailable())
}
