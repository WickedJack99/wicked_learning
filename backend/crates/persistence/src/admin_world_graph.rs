use std::collections::HashMap;

use serde_json::Value;
use sqlx::{FromRow, PgPool, types::Json};
use uuid::Uuid;
use wicked_learning_application::admin_world_graph::{
    AdminWorldGraphReadError, AdminWorldGraphRepository as AdminWorldGraphRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::{AuthorizedPrincipal, permission_scope_allows},
    world_content::{
        AdminMapSummary, AdminNodePosition, AdminNodeSummary, AdminPortalActivity,
        AdminPortalCandidate, AdminPortalLink, AdminUnlockDiagnostic, AdminWorldGraph,
        AdminWorldSummary,
    },
};

/// PostgreSQL projection of the source World Builder overview. It deliberately
/// does not reuse the learner World repository: authoring reads drafts and are
/// scoped by edit authority rather than learner visibility.
pub struct PostgresAdminWorldGraphRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldGraphRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl AdminWorldGraphRepositoryPort for PostgresAdminWorldGraphRepository<'_> {
    fn load_editable_graph(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl std::future::Future<Output = Result<Option<AdminWorldGraph>, AdminWorldGraphReadError>>
    + Send {
        async move {
            load_editable_graph(self.pool, principal)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load the scoped World Builder graph");
                    AdminWorldGraphReadError
                })
        }
    }
}

#[derive(FromRow)]
struct WorldRow {
    id: Uuid,
    slug: String,
    title: String,
    description: String,
    updated_at: String,
}

#[derive(FromRow)]
struct MapRow {
    id: Uuid,
    slug: String,
    title: String,
    description: String,
    updated_at: String,
    access_roles: Json<Vec<String>>,
}

#[derive(FromRow)]
struct NodeRow {
    id: Uuid,
    map_id: Uuid,
    slug: String,
    title: String,
    description: String,
    q: i32,
    r: i32,
    state: String,
    visual_config: Value,
}

#[derive(FromRow)]
struct PortalLinkRow {
    id: Uuid,
    label: Option<String>,
    description: Option<String>,
    source_map_id: Uuid,
    target_map_id: Uuid,
    source_activity_id: Uuid,
    source_activity_title: String,
    source_activity_type: String,
    target_activity_id: Uuid,
    target_activity_title: String,
    target_activity_type: String,
    source_node_id: Uuid,
    source_node_slug: String,
    source_node_title: String,
    source_node_description: String,
    source_node_q: i32,
    source_node_r: i32,
    source_node_state: String,
    source_node_visual_config: Value,
    target_node_id: Uuid,
    target_node_slug: String,
    target_node_title: String,
    target_node_description: String,
    target_node_q: i32,
    target_node_r: i32,
    target_node_state: String,
    target_node_visual_config: Value,
}

async fn load_editable_graph(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Option<AdminWorldGraph>, sqlx::Error> {
    // The Laravel resolver has one current authoring World until multi-world
    // routing exists. The greenfield schema likewise has no browser-selectable
    // world yet, so use a stable first record rather than learner publication
    // visibility.
    let Some(world) = sqlx::query_as::<_, WorldRow>(
        "SELECT id, slug, title, description, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_worlds ORDER BY created_at ASC, slug ASC LIMIT 1",
    )
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };

    let maps = load_scoped_maps(pool, world.id, principal).await?;
    let map_ids = maps.iter().map(|map| map.id).collect::<Vec<_>>();
    let nodes = load_nodes(pool, &map_ids).await?;
    let mut nodes_by_map = HashMap::<Uuid, Vec<AdminNodeSummary>>::new();
    for node in nodes {
        nodes_by_map
            .entry(node.map_id)
            .or_default()
            .push(node.into_summary());
    }

    let mut map_summaries = Vec::with_capacity(maps.len());
    let mut portal_candidates = Vec::new();
    for map in maps {
        let nodes = nodes_by_map.remove(&map.id).unwrap_or_default();
        portal_candidates.extend(nodes.iter().cloned().map(|node| AdminPortalCandidate {
            map_id: map.id,
            map_title: map.title.clone(),
            node,
        }));
        map_summaries.push(AdminMapSummary {
            id: map.id,
            slug: map.slug,
            title: map.title,
            description: map.description,
            updated_at: map.updated_at,
            node_count: nodes.len() as i64,
            // AI review status and its queue are not yet represented by the
            // Rust schema. The source-shaped zero preserves a stable graph
            // field without pretending this authoring workflow is migrated.
            review_count: 0,
            access_roles: map.access_roles.0,
            nodes,
        });
    }

    Ok(Some(AdminWorldGraph {
        world: AdminWorldSummary {
            id: world.id,
            slug: world.slug,
            title: world.title,
            description: world.description,
            updated_at: world.updated_at,
        },
        maps: map_summaries,
        portal_candidates,
        portal_links: load_portal_links(pool, &map_ids).await?,
    }))
}

async fn load_scoped_maps(
    pool: &PgPool,
    world_id: Uuid,
    principal: &AuthorizedPrincipal,
) -> Result<Vec<MapRow>, sqlx::Error> {
    let update_scopes = ["world_maps", "world_nodes", "world_activities"]
        .into_iter()
        .filter_map(|resource| principal.permission_scope(resource, "ru"))
        .collect::<Vec<_>>();
    if update_scopes.iter().any(|scope| *scope == "all") {
        return sqlx::query_as::<_, MapRow>(
            "SELECT id, slug, title, description, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at, access_roles FROM learning_maps WHERE world_id = $1 ORDER BY position ASC, slug ASC",
        )
        .bind(world_id)
        .fetch_all(pool)
        .await;
    }

    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(vec![]);
    };
    let can_edit_own = update_scopes
        .iter()
        .any(|scope| permission_scope_allows(scope, "own"));

    // This duplicates the source `scopeEditableMaps()` rule: a group assigned
    // directly to a map grants access even when role permission scope is
    // otherwise absent. It is intentionally one SQL predicate so maps outside
    // the scope never enter the authoring response.
    sqlx::query_as::<_, MapRow>(
        "SELECT maps.id, maps.slug, maps.title, maps.description, to_char(maps.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at, maps.access_roles FROM learning_maps AS maps WHERE maps.world_id = $1 AND (($2 AND maps.created_by_principal_id = $3) OR EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = maps.id AND memberships.principal_id = $3)) ORDER BY maps.position ASC, maps.slug ASC",
    )
    .bind(world_id)
    .bind(can_edit_own)
    .bind(principal_id)
    .fetch_all(pool)
    .await
}

async fn load_nodes(pool: &PgPool, map_ids: &[Uuid]) -> Result<Vec<NodeRow>, sqlx::Error> {
    if map_ids.is_empty() {
        return Ok(vec![]);
    }

    sqlx::query_as::<_, NodeRow>(
        "SELECT id, map_id, slug, title, description, position_q AS q, position_r AS r, state, visual_config FROM learning_nodes WHERE map_id = ANY($1) ORDER BY map_id ASC, position_q ASC, position_r ASC, slug ASC",
    )
    .bind(map_ids)
    .fetch_all(pool)
    .await
}

async fn load_portal_links(
    pool: &PgPool,
    map_ids: &[Uuid],
) -> Result<Vec<AdminPortalLink>, sqlx::Error> {
    if map_ids.is_empty() {
        return Ok(vec![]);
    }

    let rows = sqlx::query_as::<_, PortalLinkRow>(
        "SELECT links.source_activity_id AS id, links.label, links.description, source_nodes.map_id AS source_map_id, target_nodes.map_id AS target_map_id, source_activities.id AS source_activity_id, source_activities.title AS source_activity_title, source_activities.activity_type AS source_activity_type, target_activities.id AS target_activity_id, target_activities.title AS target_activity_title, target_activities.activity_type AS target_activity_type, source_nodes.id AS source_node_id, source_nodes.slug AS source_node_slug, source_nodes.title AS source_node_title, source_nodes.description AS source_node_description, source_nodes.position_q AS source_node_q, source_nodes.position_r AS source_node_r, source_nodes.state AS source_node_state, source_nodes.visual_config AS source_node_visual_config, target_nodes.id AS target_node_id, target_nodes.slug AS target_node_slug, target_nodes.title AS target_node_title, target_nodes.description AS target_node_description, target_nodes.position_q AS target_node_q, target_nodes.position_r AS target_node_r, target_nodes.state AS target_node_state, target_nodes.visual_config AS target_node_visual_config FROM learning_portal_links AS links INNER JOIN learning_activities AS source_activities ON source_activities.id = links.source_activity_id INNER JOIN learning_nodes AS source_nodes ON source_nodes.id = links.source_node_id INNER JOIN learning_activities AS target_activities ON target_activities.id = links.target_activity_id INNER JOIN learning_nodes AS target_nodes ON target_nodes.id = links.target_node_id WHERE source_nodes.map_id = ANY($1) OR target_nodes.map_id = ANY($1) ORDER BY source_nodes.map_id ASC, source_nodes.slug ASC, source_activities.slug ASC",
    )
    .bind(map_ids)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(PortalLinkRow::into_summary).collect())
}

impl NodeRow {
    fn into_summary(self) -> AdminNodeSummary {
        AdminNodeSummary {
            id: self.id,
            slug: self.slug,
            title: self.title,
            description: self.description,
            activity_review_count: 0,
            position: AdminNodePosition {
                q: self.q,
                r: self.r,
            },
            state: self.state,
            visual_config: self.visual_config,
            unlock_diagnostics: vec![],
        }
    }
}

impl PortalLinkRow {
    fn into_summary(self) -> AdminPortalLink {
        AdminPortalLink {
            id: self.id,
            label: self.label,
            description: self.description,
            source_map_id: self.source_map_id,
            target_map_id: self.target_map_id,
            source_activity: Some(AdminPortalActivity {
                id: self.source_activity_id,
                title: self.source_activity_title,
                activity_type: self.source_activity_type,
            }),
            target_activity: Some(AdminPortalActivity {
                id: self.target_activity_id,
                title: self.target_activity_title,
                activity_type: self.target_activity_type,
            }),
            source_node: AdminNodeSummary {
                id: self.source_node_id,
                slug: self.source_node_slug,
                title: self.source_node_title,
                description: self.source_node_description,
                activity_review_count: 0,
                position: AdminNodePosition {
                    q: self.source_node_q,
                    r: self.source_node_r,
                },
                state: self.source_node_state,
                visual_config: self.source_node_visual_config,
                unlock_diagnostics: Vec::<AdminUnlockDiagnostic>::new(),
            },
            target_node: AdminNodeSummary {
                id: self.target_node_id,
                slug: self.target_node_slug,
                title: self.target_node_title,
                description: self.target_node_description,
                activity_review_count: 0,
                position: AdminNodePosition {
                    q: self.target_node_q,
                    r: self.target_node_r,
                },
                state: self.target_node_state,
                visual_config: self.target_node_visual_config,
                unlock_diagnostics: Vec::<AdminUnlockDiagnostic>::new(),
            },
        }
    }
}
