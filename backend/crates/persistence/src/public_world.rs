use std::collections::HashMap;

use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_domain::world_content::{PublicMap, PublicMapAsset, PublicWorld};

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
        "SELECT id, slug, title, description FROM learning_maps WHERE world_id = $1 AND published_at IS NOT NULL ORDER BY position ASC, slug ASC",
    )
    .bind(world.id)
    .fetch_all(pool)
    .await?;
    let map_ids: Vec<Uuid> = maps.iter().map(|map| map.id).collect();
    let assets = if map_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, MapAssetRow>(
            "SELECT map_id, slug, title, description, position_x AS x, position_y AS y, interaction_mode FROM learning_map_assets WHERE map_id = ANY($1) AND published_at IS NOT NULL ORDER BY map_id ASC, position_z ASC, slug ASC",
        )
        .bind(&map_ids)
        .fetch_all(pool)
        .await?
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
                interaction_mode: asset.interaction_mode,
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
                assets: assets_by_map.remove(&map.id).unwrap_or_default(),
            })
            .collect(),
    }))
}
