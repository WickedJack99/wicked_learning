use axum::{Json, extract::State};
use wicked_learning_application::public_presentation::PublicPresentationQuery;
use wicked_learning_domain::platform_presentation::PublicPresentation;
use wicked_learning_persistence::public_presentation::PostgresPublicPresentationRepository;

use crate::{AppState, error::ApiError};

pub async fn show(State(state): State<AppState>) -> Result<Json<PublicPresentation>, ApiError> {
    let repository = PostgresPublicPresentationRepository::new(&state.application_database);

    PublicPresentationQuery::new(&repository)
        .execute()
        .await
        .map(Json)
        .map_err(|_| ApiError::service_unavailable())
}
