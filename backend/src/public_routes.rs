use axum::{
    Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{AppState, error::ApiError};

const MAX_ACTIVITY_OUTLINES: i64 = 24;

#[derive(Deserialize)]
pub struct PublicRoutePath {
    world_slug: String,
    map_slug: String,
    asset_slug: String,
    route_slug: String,
}

#[derive(Serialize)]
pub struct PublicRouteOutlineResponse {
    pub world_slug: String,
    pub world_title: String,
    pub map_slug: String,
    pub map_title: String,
    pub asset_slug: String,
    pub asset_title: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub activities: Vec<PublicActivityOutline>,
}

#[derive(Serialize)]
pub struct PublicActivityOutline {
    pub slug: String,
    pub title: String,
    pub description: String,
}

#[derive(FromRow)]
struct RouteOutlineRow {
    id: Uuid,
    world_slug: String,
    world_title: String,
    map_slug: String,
    map_title: String,
    asset_slug: String,
    asset_title: String,
    slug: String,
    title: String,
    description: String,
}

#[derive(FromRow)]
struct ActivityOutlineRow {
    slug: String,
    title: String,
    description: String,
}

pub async fn show(
    State(state): State<AppState>,
    Path(path): Path<PublicRoutePath>,
) -> Result<Json<PublicRouteOutlineResponse>, ApiError> {
    let route = sqlx::query_as::<_, RouteOutlineRow>(
        r#"
            SELECT
                routes.id,
                worlds.slug AS world_slug,
                worlds.title AS world_title,
                maps.slug AS map_slug,
                maps.title AS map_title,
                assets.slug AS asset_slug,
                assets.title AS asset_title,
                routes.slug,
                routes.title,
                routes.description
            FROM learning_routes AS routes
            INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id
            INNER JOIN learning_maps AS maps ON maps.id = assets.map_id
            INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id
            WHERE worlds.slug = $1
                AND worlds.published_at IS NOT NULL
                AND maps.slug = $2
                AND maps.published_at IS NOT NULL
                AND assets.slug = $3
                AND assets.published_at IS NOT NULL
                AND assets.interaction_mode = 'focusable'
                AND routes.slug = $4
                AND routes.published_at IS NOT NULL
        "#,
    )
    .bind(path.world_slug)
    .bind(path.map_slug)
    .bind(path.asset_slug)
    .bind(path.route_slug)
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;

    let activities = sqlx::query_as::<_, ActivityOutlineRow>(
        r#"
            SELECT slug, title, description
            FROM learning_activities
            WHERE route_id = $1 AND published_at IS NOT NULL
            ORDER BY position ASC, slug ASC
            LIMIT $2
        "#,
    )
    .bind(route.id)
    .bind(MAX_ACTIVITY_OUTLINES)
    .fetch_all(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(PublicRouteOutlineResponse {
        world_slug: route.world_slug,
        world_title: route.world_title,
        map_slug: route.map_slug,
        map_title: route.map_title,
        asset_slug: route.asset_slug,
        asset_title: route.asset_title,
        slug: route.slug,
        title: route.title,
        description: route.description,
        activities: activities
            .into_iter()
            .map(|activity| PublicActivityOutline {
                slug: activity.slug,
                title: activity.title,
                description: activity.description,
            })
            .collect(),
    }))
}
