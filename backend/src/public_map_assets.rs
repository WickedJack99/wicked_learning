use axum::{
    Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{AppState, error::ApiError};

const MAX_ROUTE_PREVIEWS: i64 = 12;

#[derive(Deserialize)]
pub struct PublicMapAssetPath {
    world_slug: String,
    map_slug: String,
    asset_slug: String,
}

#[derive(Serialize)]
pub struct PublicMapAssetDetailResponse {
    pub world_slug: String,
    pub world_title: String,
    pub map_slug: String,
    pub map_title: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub routes: Vec<PublicRoutePreview>,
}

#[derive(Serialize)]
pub struct PublicRoutePreview {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub activity_count: i64,
}

#[derive(FromRow)]
struct MapAssetDetailRow {
    id: Uuid,
    world_slug: String,
    world_title: String,
    map_slug: String,
    map_title: String,
    slug: String,
    title: String,
    description: String,
}

#[derive(FromRow)]
struct RoutePreviewRow {
    slug: String,
    title: String,
    description: String,
    activity_count: i64,
}

pub async fn show(
    State(state): State<AppState>,
    Path(path): Path<PublicMapAssetPath>,
) -> Result<Json<PublicMapAssetDetailResponse>, ApiError> {
    let asset = sqlx::query_as::<_, MapAssetDetailRow>(
        r#"
            SELECT
                assets.id,
                worlds.slug AS world_slug,
                worlds.title AS world_title,
                maps.slug AS map_slug,
                maps.title AS map_title,
                assets.slug,
                assets.title,
                assets.description
            FROM learning_map_assets AS assets
            INNER JOIN learning_maps AS maps ON maps.id = assets.map_id
            INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id
            WHERE worlds.slug = $1
                AND worlds.published_at IS NOT NULL
                AND maps.slug = $2
                AND maps.published_at IS NOT NULL
                AND assets.slug = $3
                AND assets.published_at IS NOT NULL
                AND assets.interaction_mode = 'focusable'
        "#,
    )
    .bind(path.world_slug)
    .bind(path.map_slug)
    .bind(path.asset_slug)
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;

    let routes = sqlx::query_as::<_, RoutePreviewRow>(
        r#"
            SELECT
                routes.slug,
                routes.title,
                routes.description,
                COUNT(activities.id) AS activity_count
            FROM learning_routes AS routes
            LEFT JOIN learning_activities AS activities
                ON activities.route_id = routes.id
                AND activities.published_at IS NOT NULL
            WHERE routes.map_asset_id = $1 AND routes.published_at IS NOT NULL
            GROUP BY routes.id
            ORDER BY routes.position ASC, routes.slug ASC
            LIMIT $2
        "#,
    )
    .bind(asset.id)
    .bind(MAX_ROUTE_PREVIEWS)
    .fetch_all(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(PublicMapAssetDetailResponse {
        world_slug: asset.world_slug,
        world_title: asset.world_title,
        map_slug: asset.map_slug,
        map_title: asset.map_title,
        slug: asset.slug,
        title: asset.title,
        description: asset.description,
        routes: routes
            .into_iter()
            .map(|route| PublicRoutePreview {
                slug: route.slug,
                title: route.title,
                description: route.description,
                activity_count: route.activity_count,
            })
            .collect(),
    }))
}
