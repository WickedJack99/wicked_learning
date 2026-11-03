use axum::{Json, extract::State};
use wicked_learning_application::public_world::PublicWorldQuery;
use wicked_learning_domain::world_content::PublicWorld;
use wicked_learning_persistence::public_world::PostgresPublicWorldRepository;

use crate::{AppState, error::ApiError};

pub async fn show(State(state): State<AppState>) -> Result<Json<PublicWorld>, ApiError> {
    let repository = PostgresPublicWorldRepository::new(&state.application_database);

    PublicWorldQuery::new(&repository)
        .execute()
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
