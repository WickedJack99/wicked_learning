use axum::{
    Json,
    extract::{Path, State},
};
use serde::Deserialize;
use wicked_learning_application::public_map_asset::PublicMapAssetQuery;
use wicked_learning_domain::world_content::PublicMapAssetDetail;
use wicked_learning_persistence::public_map_asset::PostgresPublicMapAssetRepository;

use crate::{AppState, error::ApiError};

#[derive(Deserialize)]
pub struct PublicMapAssetPath {
    world_slug: String,
    map_slug: String,
    asset_slug: String,
}

pub async fn show(
    State(state): State<AppState>,
    Path(path): Path<PublicMapAssetPath>,
) -> Result<Json<PublicMapAssetDetail>, ApiError> {
    let repository = PostgresPublicMapAssetRepository::new(&state.application_database);

    PublicMapAssetQuery::new(&repository)
        .execute(&path.world_slug, &path.map_slug, &path.asset_slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
