use std::collections::HashMap;

use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::public_world::{
    PublicWorldReadError, PublicWorldRepository as PublicWorldRepositoryPort,
};
use wicked_learning_domain::world_content::{PublicMap, PublicMapAsset, PublicNode, PublicWorld};

pub struct PostgresPublicWorldRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresPublicWorldRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl PublicWorldRepositoryPort for PostgresPublicWorldRepository<'_> {
    fn load_first_published(
        &self,
    ) -> impl std::future::Future<Output = Result<Option<PublicWorld>, PublicWorldReadError>> + Send
    {
        async move {
            load_first_published(self.pool)
                .await
                .map_err(|_| PublicWorldReadError)
        }
    }
}

pub struct LoadedWorld {
    pub world: PublicWorld,
    pub map_ids: Vec<Uuid>,
}

#[derive(FromRow)]
struct WorldRow {
    id: Uuid,
    slug: String,
    title: String,
    description: String,
    theme_config: Value,
}

#[derive(FromRow)]
struct MapRow {
    id: Uuid,
    slug: String,
    title: String,
    description: String,
    background_config: Value,
    grid_config: Value,
    map_assets_locked: bool,
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
    locked: bool,
    visual_config: Value,
    interaction_config: Value,
    sound_config: Value,
    interaction_mode: String,
}

#[derive(FromRow)]
struct NodeRow {
    id: Uuid,
    map_id: Uuid,
    asset_slug: Option<String>,
    slug: String,
    title: String,
    description: String,
    q: i32,
    r: i32,
    state: String,
    visual_config: Value,
}

pub async fn load_first_published(pool: &PgPool) -> Result<Option<PublicWorld>, sqlx::Error> {
    Ok(load_first_visible(pool, &[])
        .await?
        .map(|loaded| loaded.world))
}

pub async fn load_first_visible(
    pool: &PgPool,
    roles: &[String],
) -> Result<Option<LoadedWorld>, sqlx::Error> {
    let Some(world) = sqlx::query_as::<_, WorldRow>(
        "SELECT id, slug, title, description, theme_config FROM learning_worlds WHERE published_at IS NOT NULL ORDER BY published_at ASC, slug ASC LIMIT 1",
    )
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };

    let maps = sqlx::query_as::<_, MapRow>(
        "SELECT id, slug, title, description, background_config, grid_config, map_assets_locked FROM learning_maps WHERE world_id = $1 AND published_at IS NOT NULL AND (access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) ORDER BY position ASC, slug ASC",
    )
    .bind(world.id)
    .bind(roles)
    .fetch_all(pool)
    .await?;
    if maps.is_empty() {
        return Ok(None);
    }
    let map_ids: Vec<Uuid> = maps.iter().map(|map| map.id).collect();
    let assets = if map_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, MapAssetRow>(
            "SELECT map_id, slug, title, description, position_x AS x, position_y AS y, position_z AS z, image_url, text, width, opacity, locked, visual_config, interaction_config, sound_config, interaction_mode FROM learning_map_assets WHERE map_id = ANY($1) AND published_at IS NOT NULL ORDER BY map_id ASC, position_z ASC, slug ASC",
        )
        .bind(&map_ids)
        .fetch_all(pool)
        .await?
    };
    let nodes = if map_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, NodeRow>(
            "SELECT nodes.id, nodes.map_id, assets.slug AS asset_slug, nodes.slug, nodes.title, nodes.description, nodes.position_q AS q, nodes.position_r AS r, nodes.state, nodes.visual_config FROM learning_nodes AS nodes LEFT JOIN learning_map_assets AS assets ON assets.id = nodes.map_asset_id WHERE nodes.map_id = ANY($1) AND nodes.published_at IS NOT NULL ORDER BY nodes.map_id ASC, nodes.position_q ASC, nodes.position_r ASC, nodes.slug ASC",
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
                image_url: asset.image_url.as_deref().map(learner_media_url),
                text: asset.text,
                width: asset.width,
                opacity: asset.opacity,
                locked: asset.locked,
                visual_config: learner_media_config(asset.visual_config),
                interaction_config: learner_media_config(asset.interaction_config),
                sound_config: learner_media_config(asset.sound_config),
                interaction_mode: asset.interaction_mode,
            });
    }
    let mut nodes_by_map: HashMap<Uuid, Vec<PublicNode>> = HashMap::new();
    for node in nodes {
        nodes_by_map
            .entry(node.map_id)
            .or_default()
            .push(PublicNode {
                id: node.id,
                asset_slug: node.asset_slug,
                slug: node.slug,
                title: node.title,
                description: node.description,
                q: node.q,
                r: node.r,
                state: node.state,
                visual_config: node.visual_config,
            });
    }
    Ok(Some(LoadedWorld {
        map_ids: map_ids.clone(),
        world: PublicWorld {
            slug: world.slug,
            title: world.title,
            description: world.description,
            theme_config: world.theme_config,
            maps: maps
                .into_iter()
                .map(|map| PublicMap {
                    slug: map.slug,
                    title: map.title,
                    description: map.description,
                    background_config: map.background_config,
                    grid_config: map.grid_config,
                    map_assets_locked: map.map_assets_locked,
                    assets: assets_by_map.remove(&map.id).unwrap_or_default(),
                    nodes: nodes_by_map.remove(&map.id).unwrap_or_default(),
                })
                .collect(),
        },
    }))
}

const ADMIN_MEDIA_CONTENT_PREFIX: &str = "/api/v1/admin/media-assets/";
const LEARNER_MEDIA_CONTENT_PREFIX: &str = "/api/v1/learner/media-assets/";

fn learner_media_url(value: &str) -> String {
    let Some(path) = value.strip_prefix(ADMIN_MEDIA_CONTENT_PREFIX) else {
        return value.to_owned();
    };
    let Some((asset_id, suffix)) = path.split_once('/') else {
        return value.to_owned();
    };
    if suffix != "content" || Uuid::parse_str(asset_id).is_err() {
        return value.to_owned();
    }
    format!("{LEARNER_MEDIA_CONTENT_PREFIX}{asset_id}/content")
}

fn learner_media_config(value: Value) -> Value {
    match value {
        Value::Object(object) => Value::Object(
            object
                .into_iter()
                .map(|(key, value)| (key, learner_media_config(value)))
                .collect(),
        ),
        Value::Array(values) => {
            Value::Array(values.into_iter().map(learner_media_config).collect())
        }
        Value::String(value) => Value::String(learner_media_url(&value)),
        value => value,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;

    use super::{learner_media_config, learner_media_url};

    #[test]
    fn projects_only_managed_author_media_urls_for_learners() {
        let media = Uuid::new_v4();
        let author_url = format!("/api/v1/admin/media-assets/{media}/content");
        let learner_url = format!("/api/v1/learner/media-assets/{media}/content");

        assert_eq!(learner_media_url(&author_url), learner_url);
        assert_eq!(
            learner_media_config(json!({"states": [{"imageUrl": author_url}]})),
            json!({"states": [{"imageUrl": learner_url}]}),
        );
        assert_eq!(
            learner_media_url("/api/v1/admin/media-assets/not-a-uuid/content"),
            "/api/v1/admin/media-assets/not-a-uuid/content",
        );
    }
}
