use axum::{
    Json,
    extract::{Path, State},
};
use serde::Deserialize;
use wicked_learning_application::public_route::PublicRouteQuery;
use wicked_learning_domain::world_content::PublicRouteOutline;
use wicked_learning_persistence::public_route::PostgresPublicRouteRepository;

use crate::{AppState, error::ApiError};

#[derive(Deserialize)]
pub struct PublicRoutePath {
    world_slug: String,
    map_slug: String,
    asset_slug: String,
    route_slug: String,
}

pub async fn show(
    State(state): State<AppState>,
    Path(path): Path<PublicRoutePath>,
) -> Result<Json<PublicRouteOutline>, ApiError> {
    let repository = PostgresPublicRouteRepository::new(&state.application_database);

    PublicRouteQuery::new(&repository)
        .execute(
            &path.world_slug,
            &path.map_slug,
            &path.asset_slug,
            &path.route_slug,
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
