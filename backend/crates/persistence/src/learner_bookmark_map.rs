use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_bookmark_map::{
    LearnerBookmarkMapReadError, LearnerBookmarkMapRepository as LearnerBookmarkMapRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerBookmarkMap, LearnerBookmarkPlace},
    world_content::PublicMapAsset,
};

use crate::public_world::load_first_visible;

pub struct PostgresLearnerBookmarkMapRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerBookmarkMapRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct BookmarkPlaceRow {
    asset_description: Option<String>,
    asset_image_url: Option<String>,
    asset_interaction_config: Option<Value>,
    asset_interaction_mode: Option<String>,
    asset_locked: Option<bool>,
    asset_opacity: Option<f64>,
    asset_slug: Option<String>,
    asset_sound_config: Option<Value>,
    asset_text: Option<String>,
    asset_title: Option<String>,
    asset_visual_config: Option<Value>,
    asset_width: Option<f64>,
    asset_x: Option<f64>,
    asset_y: Option<f64>,
    asset_z: Option<i32>,
    description: String,
    map_slug: String,
    map_title: String,
    node_slug: String,
    state: String,
    title: String,
    visual_config: Value,
}

impl LearnerBookmarkMapRepositoryPort for PostgresLearnerBookmarkMapRepository<'_> {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerBookmarkMap>, LearnerBookmarkMapReadError>,
    > + Send {
        async move {
            load(self.pool, principal).await.map_err(|error| {
                tracing::error!(%error, "could not load learner bookmark map");
                LearnerBookmarkMapReadError
            })
        }
    }
}

async fn load(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Option<LearnerBookmarkMap>, sqlx::Error> {
    let Some(visible_world) = load_first_visible(pool, &principal.roles).await? else {
        return Ok(None);
    };
    let Some(principal_id) = application_principal_id(pool, principal).await? else {
        return Ok(None);
    };
    let Some(template_map) = visible_world.world.maps.first() else {
        return Ok(None);
    };
    let places = sqlx::query_as::<_, BookmarkPlaceRow>(
        "SELECT assets.description AS asset_description, assets.image_url AS asset_image_url, assets.interaction_config AS asset_interaction_config, assets.interaction_mode AS asset_interaction_mode, assets.locked AS asset_locked, assets.opacity AS asset_opacity, assets.slug AS asset_slug, assets.sound_config AS asset_sound_config, assets.text AS asset_text, assets.title AS asset_title, assets.visual_config AS asset_visual_config, assets.width AS asset_width, assets.position_x AS asset_x, assets.position_y AS asset_y, assets.position_z AS asset_z, nodes.description, maps.slug AS map_slug, maps.title AS map_title, nodes.slug AS node_slug, nodes.state, nodes.title, nodes.visual_config FROM learner_node_bookmarks AS bookmarks INNER JOIN learning_nodes AS nodes ON nodes.id = bookmarks.node_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id LEFT JOIN learning_map_assets AS assets ON assets.id = nodes.map_asset_id AND assets.published_at IS NOT NULL WHERE bookmarks.principal_id = $1 AND nodes.map_id = ANY($2) AND nodes.published_at IS NOT NULL AND nodes.state <> 'hidden' AND NOT (nodes.visual_config @> '{\"hideEmptySpace\": true}'::jsonb) ORDER BY bookmarks.created_at ASC, maps.slug ASC, nodes.slug ASC LIMIT 500",
    )
    .bind(principal_id)
    .bind(&visible_world.map_ids)
    .fetch_all(pool)
    .await?;

    Ok(Some(LearnerBookmarkMap {
        background_config: template_map.background_config.clone(),
        grid_config: template_map.grid_config.clone(),
        places: places
            .into_iter()
            .map(|row| LearnerBookmarkPlace {
                asset: asset_from(&row),
                description: row.description,
                map_slug: row.map_slug,
                map_title: row.map_title,
                node_slug: row.node_slug,
                state: row.state,
                title: row.title,
                visual_config: row.visual_config,
            })
            .collect(),
    }))
}

fn asset_from(row: &BookmarkPlaceRow) -> Option<PublicMapAsset> {
    Some(PublicMapAsset {
        slug: row.asset_slug.clone()?,
        title: row.asset_title.clone()?,
        description: row.asset_description.clone()?,
        x: row.asset_x?,
        y: row.asset_y?,
        z: row.asset_z?,
        image_url: row.asset_image_url.clone(),
        text: row.asset_text.clone(),
        width: row.asset_width?,
        opacity: row.asset_opacity?,
        locked: row.asset_locked?,
        visual_config: row.asset_visual_config.clone()?,
        interaction_config: row.asset_interaction_config.clone()?,
        sound_config: row.asset_sound_config.clone()?,
        interaction_mode: row.asset_interaction_mode.clone()?,
    })
}

async fn application_principal_id(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(pool)
        .await
}
