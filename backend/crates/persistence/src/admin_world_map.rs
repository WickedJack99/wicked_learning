use serde_json::Value;
use sqlx::{FromRow, PgPool, types::Json};
use uuid::Uuid;
use wicked_learning_application::admin_world_map::{
    AdminWorldMapReadError, AdminWorldMapRepository as AdminWorldMapRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::{AuthorizedPrincipal, permission_scope_allows},
    world_content::{
        AdminEditableMap, AdminEditableMapAsset, AdminEditableMapDocument, AdminEditableMapSummary,
        AdminNodePosition, AdminNodeSummary, AdminWorldSummary,
    },
};

/// PostgreSQL read model for one map's original configuration workspace. The
/// caller's edit policy is evaluated before the rich authored configuration is
/// returned; learner visibility never participates in this query.
pub struct PostgresAdminWorldMapRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldMapRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl AdminWorldMapRepositoryPort for PostgresAdminWorldMapRepository<'_> {
    fn load_editable_map(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<AdminEditableMap>, AdminWorldMapReadError>> + Send
    {
        async move {
            load_editable_map(self.pool, principal, map_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load the scoped World Builder map");
                    AdminWorldMapReadError
                })
        }
    }
}

#[derive(FromRow)]
struct EditableMapRow {
    id: Uuid,
    slug: String,
    title: String,
    description: String,
    updated_at: String,
    access_roles: Json<Vec<String>>,
    background_config: Value,
    created_by_principal_id: Option<Uuid>,
    grid_config: Value,
    map_assets_locked: bool,
    topic_id: Option<Uuid>,
    world_id: Uuid,
    world_slug: String,
    world_title: String,
    world_description: String,
    world_updated_at: String,
}

#[derive(FromRow)]
struct NodeRow {
    id: Uuid,
    slug: String,
    title: String,
    description: String,
    q: i32,
    r: i32,
    state: String,
    visual_config: Value,
}

#[derive(FromRow)]
struct AssetRow {
    id: Uuid,
    node_id: Option<Uuid>,
    image_url: Option<String>,
    text: Option<String>,
    x: f64,
    y: f64,
    z: i32,
    width: f64,
    opacity: f64,
    locked: bool,
    interaction_mode: String,
    interaction_config: Value,
    visual_config: Value,
    sound_config: Value,
}

async fn load_editable_map(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_id: Uuid,
) -> Result<Option<AdminEditableMap>, sqlx::Error> {
    let Some(map) = sqlx::query_as::<_, EditableMapRow>(
        "SELECT maps.id, maps.slug, maps.title, maps.description, to_char(maps.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at, maps.access_roles, maps.background_config, maps.created_by_principal_id, maps.grid_config, maps.map_assets_locked, maps.topic_id, worlds.id AS world_id, worlds.slug AS world_slug, worlds.title AS world_title, worlds.description AS world_description, to_char(worlds.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS world_updated_at FROM learning_maps AS maps INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id WHERE maps.id = $1",
    )
    .bind(map_id)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };

    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };
    let is_direct_editor = is_direct_editor(pool, map.id, principal_id).await?;
    let Some(update_scope) = principal.permission_scope("world_maps", "ru") else {
        return Ok(None);
    };
    let can_update = scope_allows_map(
        update_scope,
        map.created_by_principal_id,
        principal_id,
        is_direct_editor,
    ) || is_direct_editor;
    if !can_update {
        return Ok(None);
    }

    let nodes = load_nodes(pool, map.id).await?;
    let assets = load_assets(pool, map.id).await?;
    let editing_group_ids = sqlx::query_scalar::<_, Uuid>(
        "SELECT group_id FROM learning_map_editing_groups WHERE map_id = $1 ORDER BY group_id ASC",
    )
    .bind(map.id)
    .fetch_all(pool)
    .await?;
    let can_delete_world_maps =
        principal
            .permission_scope("world_maps", "rud")
            .is_some_and(|scope| {
                scope_allows_map(
                    scope,
                    map.created_by_principal_id,
                    principal_id,
                    is_direct_editor,
                )
            });

    Ok(Some(AdminEditableMap {
        can_delete_world_maps,
        editable_map: AdminEditableMapDocument {
            world: AdminWorldSummary {
                id: map.world_id,
                slug: map.world_slug,
                title: map.world_title,
                description: map.world_description,
                updated_at: map.world_updated_at,
            },
            map: AdminEditableMapSummary {
                id: map.id,
                slug: map.slug,
                title: map.title,
                description: map.description,
                updated_at: map.updated_at,
                node_count: nodes.len() as i64,
                review_count: 0,
                access_roles: map.access_roles.0,
                nodes,
                background_config: map.background_config,
                editing_group_ids,
                grid_config: map.grid_config,
                map_assets_locked: map.map_assets_locked,
                topic_id: map.topic_id,
                map_assets: assets,
            },
        },
    }))
}

/// Mirrors the source map policy for role scopes. Direct group assignment is
/// deliberately considered by the caller separately for update (where it is
/// an unconditional override) and by this function for delete only when the
/// source `assigned` scope permits it.
fn scope_allows_map(
    scope: &str,
    creator_id: Option<Uuid>,
    principal_id: Uuid,
    is_direct_editor: bool,
) -> bool {
    scope == "all"
        || (permission_scope_allows(scope, "own") && creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && is_direct_editor)
}

async fn is_direct_editor(
    pool: &PgPool,
    map_id: Uuid,
    principal_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)",
    )
    .bind(map_id)
    .bind(principal_id)
    .fetch_one(pool)
    .await
}

async fn load_nodes(pool: &PgPool, map_id: Uuid) -> Result<Vec<AdminNodeSummary>, sqlx::Error> {
    let rows = sqlx::query_as::<_, NodeRow>(
        "SELECT id, slug, title, description, position_q AS q, position_r AS r, state, visual_config FROM learning_nodes WHERE map_id = $1 ORDER BY position_q ASC, position_r ASC, slug ASC",
    )
    .bind(map_id)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|node| AdminNodeSummary {
            id: node.id,
            slug: node.slug,
            title: node.title,
            description: node.description,
            activity_review_count: 0,
            position: AdminNodePosition {
                q: node.q,
                r: node.r,
            },
            state: node.state,
            visual_config: node.visual_config,
            unlock_diagnostics: vec![],
        })
        .collect())
}

async fn load_assets(
    pool: &PgPool,
    map_id: Uuid,
) -> Result<Vec<AdminEditableMapAsset>, sqlx::Error> {
    let rows = sqlx::query_as::<_, AssetRow>(
        "SELECT assets.id, nodes.id AS node_id, assets.image_url, assets.text, assets.position_x AS x, assets.position_y AS y, assets.position_z AS z, assets.width, assets.opacity, assets.locked, assets.interaction_mode, assets.interaction_config, assets.visual_config, assets.sound_config FROM learning_map_assets AS assets LEFT JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id WHERE assets.map_id = $1 ORDER BY assets.position_z ASC, assets.id ASC",
    )
    .bind(map_id)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|asset| AdminEditableMapAsset {
            id: asset.id,
            node_id: asset.node_id,
            image_url: asset.image_url,
            text: asset.text,
            x: asset.x,
            y: asset.y,
            z: asset.z,
            width: asset.width,
            opacity: asset.opacity,
            locked: asset.locked,
            focusable: asset.interaction_mode != "decorative",
            interaction_mode: asset.interaction_mode,
            interaction_config: asset.interaction_config,
            visual_config: asset.visual_config,
            sound_config: asset.sound_config,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::scope_allows_map;

    #[test]
    fn source_scope_rules_keep_delete_and_update_facts_server_owned() {
        let owner = Uuid::new_v4();
        let other = Uuid::new_v4();

        assert!(scope_allows_map("all", None, other, false));
        assert!(scope_allows_map("own", Some(owner), owner, false));
        assert!(!scope_allows_map("own", Some(owner), other, true));
        assert!(scope_allows_map("assigned", Some(owner), other, true));
        assert!(!scope_allows_map("assigned", Some(owner), other, false));
    }
}
