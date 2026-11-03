use axum::{Json, extract::State};
use wicked_learning_domain::world_content::PublicWorld;

use crate::{AppState, error::ApiError};

pub async fn show(State(state): State<AppState>) -> Result<Json<PublicWorld>, ApiError> {
    wicked_learning_persistence::public_world::load_first_published(&state.application_database)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
