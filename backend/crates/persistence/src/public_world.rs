use std::collections::HashMap;

use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_domain::world_content::{PublicMap, PublicMapAsset, PublicNode, PublicWorld};

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
    background_config: Value,
    grid_config: Value,
}

#[derive(FromRow)]
struct MapAssetRow {
    map_id: Uuid,
    slug: String,
    title: String,
    description: String,
    x: f64,
    y: f64,
    z: i32,
    image_url: Option<String>,
    text: Option<String>,
    width: f64,
    opacity: f64,
    visual_config: Value,
    interaction_config: Value,
    interaction_mode: String,
}

#[derive(FromRow)]
struct NodeRow {
    map_id: Uuid,
    slug: String,
    title: String,
    description: String,
    q: i32,
    r: i32,
    state: String,
    visual_config: Value,
}

pub async fn load_first_published(pool: &PgPool) -> Result<Option<PublicWorld>, sqlx::Error> {
    let Some(world) = sqlx::query_as::<_, WorldRow>(
        "SELECT id, slug, title, description FROM learning_worlds WHERE published_at IS NOT NULL ORDER BY published_at ASC, slug ASC LIMIT 1",
    )
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };

    let maps = sqlx::query_as::<_, MapRow>(
        "SELECT id, slug, title, description, background_config, grid_config FROM learning_maps WHERE world_id = $1 AND published_at IS NOT NULL ORDER BY position ASC, slug ASC",
    )
    .bind(world.id)
    .fetch_all(pool)
    .await?;
    let map_ids: Vec<Uuid> = maps.iter().map(|map| map.id).collect();
    let assets = if map_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, MapAssetRow>(
            "SELECT map_id, slug, title, description, position_x AS x, position_y AS y, position_z AS z, image_url, text, width, opacity, visual_config, interaction_config, interaction_mode FROM learning_map_assets WHERE map_id = ANY($1) AND published_at IS NOT NULL ORDER BY map_id ASC, position_z ASC, slug ASC",
        )
        .bind(&map_ids)
        .fetch_all(pool)
        .await?
    };
    let nodes = if map_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, NodeRow>(
            "SELECT map_id, slug, title, description, position_q AS q, position_r AS r, state, visual_config FROM learning_nodes WHERE map_id = ANY($1) AND published_at IS NOT NULL ORDER BY map_id ASC, position_q ASC, position_r ASC, slug ASC",
        ).bind(&map_ids).fetch_all(pool).await?
    };
    let mut assets_by_map: HashMap<Uuid, Vec<PublicMapAsset>> = HashMap::new();
    for asset in assets {
        assets_by_map
            .entry(asset.map_id)
            .or_default()
            .push(PublicMapAsset {
                slug: asset.slug,
                title: asset.title,
                description: asset.description,
                x: asset.x,
                y: asset.y,
                z: asset.z,
                image_url: asset.image_url,
                text: asset.text,
                width: asset.width,
                opacity: asset.opacity,
                visual_config: asset.visual_config,
                interaction_config: asset.interaction_config,
                interaction_mode: asset.interaction_mode,
            });
    }
    let mut nodes_by_map: HashMap<Uuid, Vec<PublicNode>> = HashMap::new();
    for node in nodes {
        nodes_by_map
            .entry(node.map_id)
            .or_default()
            .push(PublicNode {
                slug: node.slug,
                title: node.title,
                description: node.description,
                q: node.q,
                r: node.r,
                state: node.state,
                visual_config: node.visual_config,
            });
    }
    Ok(Some(PublicWorld {
        slug: world.slug,
        title: world.title,
        description: world.description,
        maps: maps
            .into_iter()
            .map(|map| PublicMap {
                slug: map.slug,
                title: map.title,
                description: map.description,
                background_config: map.background_config,
                grid_config: map.grid_config,
                assets: assets_by_map.remove(&map.id).unwrap_or_default(),
                nodes: nodes_by_map.remove(&map.id).unwrap_or_default(),
            })
            .collect(),
    }))
}
