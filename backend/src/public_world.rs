use std::collections::HashMap;

use axum::{Json, extract::State};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

use crate::{AppState, error::ApiError};

#[derive(Serialize)]
pub struct PublicWorldResponse {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub maps: Vec<PublicMapResponse>,
}

#[derive(Serialize)]
pub struct PublicMapResponse {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub assets: Vec<PublicMapAssetResponse>,
}

#[derive(Serialize)]
pub struct PublicMapAssetResponse {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub x: f64,
    pub y: f64,
    pub interaction_mode: String,
}

#[derive(FromRow)]
struct WorldRow {
    id: Uuid,
    slug: String,
    title: String,
    description: String,
}

#[derive(FromRow)]
struct MapRow {
    id: Uuid,
    slug: String,
    title: String,
    description: String,
}

#[derive(FromRow)]
struct MapAssetRow {
    map_id: Uuid,
    slug: String,
    title: String,
    description: String,
    x: f64,
    y: f64,
    interaction_mode: String,
}

pub async fn show(State(state): State<AppState>) -> Result<Json<PublicWorldResponse>, ApiError> {
    let world = sqlx::query_as::<_, WorldRow>(
        r#"
            SELECT id, slug, title, description
            FROM learning_worlds
            WHERE published_at IS NOT NULL
            ORDER BY published_at ASC, slug ASC
            LIMIT 1
        "#,
    )
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;

    let maps = sqlx::query_as::<_, MapRow>(
        r#"
            SELECT id, slug, title, description
            FROM learning_maps
            WHERE world_id = $1 AND published_at IS NOT NULL
            ORDER BY position ASC, slug ASC
        "#,
    )
    .bind(world.id)
    .fetch_all(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?;

    let map_ids: Vec<Uuid> = maps.iter().map(|map| map.id).collect();
    let assets = if map_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, MapAssetRow>(
            r#"
                SELECT map_id, slug, title, description, position_x AS x, position_y AS y, interaction_mode
                FROM learning_map_assets
                WHERE map_id = ANY($1) AND published_at IS NOT NULL
                ORDER BY map_id ASC, position_z ASC, slug ASC
            "#,
        )
        .bind(&map_ids)
        .fetch_all(&state.application_database)
        .await
        .map_err(|_| ApiError::service_unavailable())?
    };

    let mut assets_by_map: HashMap<Uuid, Vec<PublicMapAssetResponse>> = HashMap::new();
    for asset in assets {
        assets_by_map
            .entry(asset.map_id)
            .or_default()
            .push(PublicMapAssetResponse {
                slug: asset.slug,
                title: asset.title,
                description: asset.description,
                x: asset.x,
                y: asset.y,
                interaction_mode: asset.interaction_mode,
            });
    }

    Ok(Json(PublicWorldResponse {
        slug: world.slug,
        title: world.title,
        description: world.description,
        maps: maps
            .into_iter()
            .map(|map| PublicMapResponse {
                slug: map.slug,
                title: map.title,
                description: map.description,
                assets: assets_by_map.remove(&map.id).unwrap_or_default(),
            })
            .collect(),
    }))
}
