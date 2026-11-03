use axum::{Json, extract::State};
use wicked_learning_application::public_source_links::PublicSourceLinksQuery;
use wicked_learning_domain::platform_presentation::PublicSourceLinks;
use wicked_learning_persistence::public_source_links::PostgresPublicSourceLinksRepository;

use crate::{AppState, error::ApiError};

pub async fn index(State(state): State<AppState>) -> Result<Json<PublicSourceLinks>, ApiError> {
    let repository = PostgresPublicSourceLinksRepository::new(&state.application_database);

    PublicSourceLinksQuery::new(&repository)
        .execute()
        .await
        .map(Json)
        .map_err(|_| ApiError::service_unavailable())
}
