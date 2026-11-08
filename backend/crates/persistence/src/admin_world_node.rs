use serde_json::Value;
use sqlx::{FromRow, PgPool, types::Json};
use uuid::Uuid;
use wicked_learning_application::admin_world_node::{
    AdminWorldNodeReadError, AdminWorldNodeRepository as AdminWorldNodeRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::{AuthorizedPrincipal, permission_scope_allows},
    world_content::{
        AdminActivityConnector, AdminActivityConnectors, AdminActivityGraph, AdminActivityGraphMap,
        AdminActivityGraphNode, AdminActivityGraphPosition, AdminActivityGraphWorld,
        AdminActivityPortalCandidate, AdminActivityPortalLink, AdminActivityPortalTargetActivity,
        AdminActivityPortalTargetNode, AdminActivityStartRoute, AdminActivityTransition,
        AdminActivityTypeDefinition, AdminEditableActivity, AdminEditableItem, AdminEditableNode,
        AdminEditableSound, AdminEditableTool, AdminMessageTopicOption, AdminPortalMode,
        AdminSourceRecord, AdminSourceRecordPage, AdminSourceRecordPagination,
    },
};

const SOURCE_RECORD_PAGE_SIZE: i64 = 12;

pub struct PostgresAdminWorldNodeRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldNodeRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl AdminWorldNodeRepositoryPort for PostgresAdminWorldNodeRepository<'_> {
    fn load_editable_node(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminEditableNode>, AdminWorldNodeReadError>,
    > + Send {
        async move {
            load_editable_node(self.pool, principal, node_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load the scoped World Builder node");
                    AdminWorldNodeReadError
                })
        }
    }
}

#[derive(FromRow)]
struct NodeRow {
    id: Uuid,
    map_asset_id: Option<Uuid>,
    start_activity_id: Option<Uuid>,
    graph_layout: Value,
    slug: String,
    title: String,
    description: String,
    map_id: Uuid,
    map_slug: String,
    map_title: String,
    map_creator_id: Option<Uuid>,
    world_id: Uuid,
    world_slug: String,
    world_title: String,
}

#[derive(FromRow)]
struct ActivityRow {
    id: Uuid,
    slug: String,
    activity_type: String,
    title: String,
    introduction: Option<String>,
    config: Value,
    updated_at: String,
    ai_review_status: String,
    ai_reviewed_at: Option<String>,
    ai_review: Option<Value>,
    x: Option<f64>,
    y: Option<f64>,
}

#[derive(FromRow)]
struct StartRow {
    id: Uuid,
    activity_id: Uuid,
    label: String,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    button_color_dark: Option<String>,
    button_border_color_dark: Option<String>,
    button_color_light: Option<String>,
    button_border_color_light: Option<String>,
    sort_order: i16,
}

#[derive(FromRow)]
struct TransitionRow {
    id: Uuid,
    from_activity_id: Uuid,
    to_activity_id: Option<Uuid>,
    from_connector: String,
    to_connector: Option<String>,
    trigger: String,
    trigger_value: Option<String>,
    label: Option<String>,
}

#[derive(FromRow)]
struct ItemRow {
    id: Uuid,
    slug: String,
    title: String,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    config: Value,
}

#[derive(FromRow)]
struct ToolRow {
    id: Uuid,
    slug: String,
    title: String,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    animation_dark: Option<String>,
    animation_light: Option<String>,
    config: Value,
    created_at: String,
    updated_at: String,
}

#[derive(FromRow)]
struct SoundRow {
    id: Uuid,
    name: String,
    slug: String,
    icon: Option<String>,
    url: String,
    volume: i16,
    play_seconds: Option<f64>,
    loop_enabled: bool,
}

#[derive(FromRow)]
struct PortalCandidateRow {
    id: Uuid,
    title: String,
    node_id: Uuid,
    node_title: String,
    map_id: Uuid,
    map_title: String,
}

#[derive(FromRow)]
struct PortalLinkRow {
    id: Uuid,
    label: Option<String>,
    description: Option<String>,
    target_activity_id: Uuid,
    target_activity_title: String,
    target_node_id: Uuid,
    target_node_title: String,
    target_map_title: String,
}

#[derive(FromRow)]
struct NpcEndConnectorRow {
    activity_id: Uuid,
    id: Uuid,
    title: String,
    config: Value,
}

#[derive(FromRow)]
struct SourceRecordRow {
    id: Uuid,
    anchor: Option<String>,
    concepts: Json<Vec<String>>,
    excerpt: Option<String>,
    published_at: Option<String>,
    publisher: Option<String>,
    rights: Option<String>,
    title: String,
    url: String,
}

async fn load_editable_node(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
) -> Result<Option<AdminEditableNode>, sqlx::Error> {
    let Some(node) = sqlx::query_as::<_, NodeRow>(
        "SELECT nodes.id, nodes.map_asset_id, nodes.start_activity_id, nodes.activity_graph_layout AS graph_layout, nodes.slug, nodes.title, nodes.description, maps.id AS map_id, maps.slug AS map_slug, maps.title AS map_title, maps.created_by_principal_id AS map_creator_id, worlds.id AS world_id, worlds.slug AS world_slug, worlds.title AS world_title FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id WHERE nodes.id = $1",
    )
    .bind(node_id)
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
    let direct_editor = direct_editor(pool, node.map_id, principal_id).await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(None);
    };
    if !scope_allows_map(scope, node.map_creator_id, principal_id, direct_editor) && !direct_editor
    {
        return Ok(None);
    }

    let activities = load_activities(pool, node.map_asset_id).await?;
    let activity_ids = activities
        .iter()
        .map(|activity| activity.id)
        .collect::<Vec<_>>();
    let start_activity_id = eligible_start_activity_id(&activities, node.start_activity_id);
    let starts = load_starts(pool, node.id).await?;
    let transitions = load_transitions(pool, &activity_ids).await?;
    let portal_candidates = load_portal_candidates(pool, node.world_id).await?;
    let message_topics = load_message_topics(pool, node.map_asset_id).await?;
    let source_records = load_source_records(pool).await?;
    let npc_connectors = load_npc_end_connectors(pool, &activity_ids).await?;

    let mut editable_activities = Vec::with_capacity(activities.len());
    for activity in activities {
        let portal_link = load_portal_link(pool, activity.id).await?;
        let connectors = if activity.activity_type == "npc_dialogue" {
            AdminActivityConnectors {
                inputs: vec![connector("in", "Entry")],
                outputs: npc_connectors
                    .get(&activity.id)
                    .cloned()
                    .unwrap_or_else(|| vec![connector("dialogue-end-pending", "A End")]),
            }
        } else {
            connectors_for(&activity.activity_type, &activity.config)
        };
        editable_activities.push(AdminEditableActivity {
            id: activity.id,
            slug: activity.slug,
            activity_type: activity.activity_type.clone(),
            title: activity.title,
            introduction: activity.introduction,
            question: (activity.activity_type == "question").then(|| activity.config.clone()),
            config: activity.config,
            updated_at: activity.updated_at,
            ai_review_status: activity.ai_review_status,
            ai_reviewed_at: activity.ai_reviewed_at,
            ai_review: activity.ai_review,
            ai_review_history: vec![],
            portal_link,
            position: AdminActivityGraphPosition {
                x: activity.x,
                y: activity.y,
            },
            connectors,
        });
    }

    Ok(Some(AdminEditableNode {
        activity_graph: AdminActivityGraph {
            world: AdminActivityGraphWorld { id: node.world_id, slug: node.world_slug, title: node.world_title },
            map: AdminActivityGraphMap { id: node.map_id, slug: node.map_slug, title: node.map_title },
            node: AdminActivityGraphNode {
                id: node.id,
                slug: node.slug,
                title: node.title,
                description: node.description,
                graph_layout: node.graph_layout,
                start_activity_id,
                start_routes: starts,
            },
            activity_types: activity_type_definitions(),
            can_manage_ai_review: principal.has_permission("ai", "ru"),
            ai_review_templates: vec![],
            competence_topic_options: query_names(pool, "SELECT name FROM competence_topic_definitions WHERE is_active ORDER BY name ASC").await?,
            evidence_concept_options: query_names(pool, "SELECT name FROM learning_concepts WHERE is_active ORDER BY name ASC, id ASC LIMIT 200").await?,
            portal_candidates,
            message_topics,
            source_records,
            activities: editable_activities,
            transitions,
        },
        items: load_items(pool).await?,
        sounds: load_sounds(pool).await?,
        tools: load_tools(pool).await?,
    }))
}

async fn load_npc_end_connectors(
    pool: &PgPool,
    activity_ids: &[Uuid],
) -> Result<std::collections::HashMap<Uuid, Vec<AdminActivityConnector>>, sqlx::Error> {
    if activity_ids.is_empty() {
        return Ok(std::collections::HashMap::new());
    }
    let rows: Vec<NpcEndConnectorRow> = sqlx::query_as(
        "SELECT activity_id, id, title, node_config AS config FROM learning_npc_dialogue_nodes WHERE activity_id = ANY($1) AND node_type = 'end' ORDER BY activity_id ASC, sort_order ASC, id ASC",
    )
    .bind(activity_ids)
    .fetch_all(pool)
    .await?;
    let mut connectors = std::collections::HashMap::<Uuid, Vec<AdminActivityConnector>>::new();
    for (index, row) in rows.into_iter().enumerate() {
        let symbol = row
            .config
            .get("connectorSymbol")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| ["A", "B", "C", "D", "E", "F"][index % 6]);
        connectors
            .entry(row.activity_id)
            .or_default()
            .push(connector(
                &format!("dialogue-end-{}", row.id),
                &format!("{symbol} {}", row.title),
            ));
    }
    Ok(connectors)
}

fn scope_allows_map(
    scope: &str,
    creator: Option<Uuid>,
    principal: Uuid,
    direct_editor: bool,
) -> bool {
    scope == "all"
        || (permission_scope_allows(scope, "own") && creator == Some(principal))
        || (permission_scope_allows(scope, "assigned") && direct_editor)
}

async fn direct_editor(
    pool: &PgPool,
    map_id: Uuid,
    principal_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)")
        .bind(map_id).bind(principal_id).fetch_one(pool).await
}

async fn load_activities(
    pool: &PgPool,
    map_asset_id: Option<Uuid>,
) -> Result<Vec<ActivityRow>, sqlx::Error> {
    let Some(map_asset_id) = map_asset_id else {
        return Ok(vec![]);
    };
    sqlx::query_as("SELECT activities.id, activities.slug, activities.activity_type, activities.title, activities.introduction, activities.activity_config AS config, to_char(activities.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at, activities.ai_review_status, to_char(activities.ai_reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS ai_reviewed_at, activities.ai_review, activities.graph_position_x AS x, activities.graph_position_y AS y FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE routes.map_asset_id = $1 ORDER BY routes.position ASC, activities.position ASC, activities.slug ASC")
        .bind(map_asset_id).fetch_all(pool).await
}

async fn load_starts(
    pool: &PgPool,
    node_id: Uuid,
) -> Result<Vec<AdminActivityStartRoute>, sqlx::Error> {
    let rows: Vec<StartRow> = sqlx::query_as("SELECT starts.id, starts.activity_id, COALESCE(starts.label, routes.title) AS label, starts.description, starts.image_dark, starts.image_light, starts.button_color_dark, starts.button_border_color_dark, starts.button_color_light, starts.button_border_color_light, starts.sort_order FROM learning_activity_starts AS starts INNER JOIN learning_activities AS activities ON activities.id = starts.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE starts.node_id = $1 AND (activities.activity_type <> 'portal' OR activities.activity_config ->> 'portalMode' IS DISTINCT FROM 'input') ORDER BY starts.sort_order ASC, starts.id ASC").bind(node_id).fetch_all(pool).await?;
    Ok(rows
        .into_iter()
        .map(|row| AdminActivityStartRoute {
            id: row.id,
            activity_id: row.activity_id,
            label: row.label,
            description: row.description,
            image_dark: row.image_dark,
            image_light: row.image_light,
            button_color_dark: row.button_color_dark,
            button_border_color_dark: row.button_border_color_dark,
            button_color_light: row.button_color_light,
            button_border_color_light: row.button_border_color_light,
            sort_order: row.sort_order,
        })
        .collect())
}

async fn load_transitions(
    pool: &PgPool,
    activity_ids: &[Uuid],
) -> Result<Vec<AdminActivityTransition>, sqlx::Error> {
    if activity_ids.is_empty() {
        return Ok(vec![]);
    }
    let rows: Vec<TransitionRow> = sqlx::query_as("SELECT id, from_activity_id, to_activity_id, from_connector, to_connector, trigger, trigger_value, label FROM learning_activity_transitions WHERE from_activity_id = ANY($1) ORDER BY created_at ASC, id ASC").bind(activity_ids).fetch_all(pool).await?;
    Ok(rows
        .into_iter()
        .map(|row| AdminActivityTransition {
            id: row.id,
            from_activity_id: row.from_activity_id,
            to_activity_id: row.to_activity_id,
            from_connector: row.from_connector,
            to_connector: row.to_connector.unwrap_or_else(|| "in".to_owned()),
            trigger: row.trigger,
            trigger_value: row.trigger_value,
            label: row.label,
        })
        .collect())
}

async fn load_portal_candidates(
    pool: &PgPool,
    world_id: Uuid,
) -> Result<Vec<AdminActivityPortalCandidate>, sqlx::Error> {
    // Preserve `PortalLinkService::candidatesForNode()`: entry portals select
    // a concrete exit-portal activity from any map in the same World. This is
    // intentionally not restricted to the author's other editable maps.
    let rows: Vec<PortalCandidateRow> = sqlx::query_as("SELECT activities.id, activities.title, nodes.id AS node_id, nodes.title AS node_title, maps.id AS map_id, maps.title AS map_title FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE maps.world_id = $1 AND activities.activity_type = 'portal' AND activities.activity_config ->> 'portalMode' = 'input' ORDER BY activities.title ASC, activities.id ASC").bind(world_id).fetch_all(pool).await?;
    Ok(rows
        .into_iter()
        .map(|row| AdminActivityPortalCandidate {
            id: row.id,
            title: row.title,
            node_id: row.node_id,
            node_title: row.node_title,
            map_id: row.map_id,
            map_title: row.map_title,
        })
        .collect())
}

fn eligible_start_activity_id(
    activities: &[ActivityRow],
    start_activity_id: Option<Uuid>,
) -> Option<Uuid> {
    let activity = activities
        .iter()
        .find(|activity| Some(activity.id) == start_activity_id)?;
    (activity.activity_type != "portal"
        || activity.config.get("portalMode").and_then(Value::as_str) != Some("input"))
    .then_some(activity.id)
}

async fn load_portal_link(
    pool: &PgPool,
    activity_id: Uuid,
) -> Result<Option<AdminActivityPortalLink>, sqlx::Error> {
    let row: Option<PortalLinkRow> = sqlx::query_as("SELECT links.source_activity_id AS id, links.label, links.description, target_activities.id AS target_activity_id, target_activities.title AS target_activity_title, target_nodes.id AS target_node_id, target_nodes.title AS target_node_title, target_maps.title AS target_map_title FROM learning_portal_links AS links INNER JOIN learning_activities AS target_activities ON target_activities.id = links.target_activity_id INNER JOIN learning_nodes AS target_nodes ON target_nodes.id = links.target_node_id INNER JOIN learning_maps AS target_maps ON target_maps.id = target_nodes.map_id WHERE links.source_activity_id = $1").bind(activity_id).fetch_optional(pool).await?;
    Ok(row.map(|row| AdminActivityPortalLink {
        id: row.id,
        label: row.label,
        description: row.description,
        target_activity: Some(AdminActivityPortalTargetActivity {
            id: row.target_activity_id,
            title: row.target_activity_title,
            node_title: row.target_node_title.clone(),
            map_title: row.target_map_title.clone(),
        }),
        target_node: AdminActivityPortalTargetNode {
            id: row.target_node_id,
            title: row.target_node_title,
            map_title: row.target_map_title,
        },
    }))
}

async fn load_message_topics(
    pool: &PgPool,
    map_asset_id: Option<Uuid>,
) -> Result<Vec<AdminMessageTopicOption>, sqlx::Error> {
    let Some(map_asset_id) = map_asset_id else {
        return Ok(vec![]);
    };
    let rows: Vec<(Uuid, String)> = sqlx::query_as("SELECT id, title FROM learning_message_topics WHERE map_asset_id = $1 ORDER BY title ASC, id ASC").bind(map_asset_id).fetch_all(pool).await?;
    Ok(rows
        .into_iter()
        .map(|(id, title)| AdminMessageTopicOption { id, title })
        .collect())
}

async fn load_source_records(pool: &PgPool) -> Result<AdminSourceRecordPage, sqlx::Error> {
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM learning_source_records")
        .fetch_one(pool)
        .await?;
    let rows: Vec<SourceRecordRow> = sqlx::query_as("SELECT id, anchor, concepts, excerpt, to_char(published_at, 'YYYY-MM-DD') AS published_at, publisher, rights, title, url FROM learning_source_records ORDER BY title ASC, id ASC LIMIT $1").bind(SOURCE_RECORD_PAGE_SIZE).fetch_all(pool).await?;
    Ok(AdminSourceRecordPage {
        items: rows
            .into_iter()
            .map(|row| AdminSourceRecord {
                id: row.id,
                anchor: row.anchor,
                concepts: row.concepts.0,
                excerpt: row.excerpt,
                published_at: row.published_at,
                publisher: row.publisher,
                rights: row.rights,
                title: row.title,
                url: row.url,
            })
            .collect(),
        pagination: AdminSourceRecordPagination {
            current_page: 1,
            last_page: (total + SOURCE_RECORD_PAGE_SIZE - 1).max(1) / SOURCE_RECORD_PAGE_SIZE,
            per_page: SOURCE_RECORD_PAGE_SIZE,
            total,
        },
    })
}

async fn query_names(pool: &PgPool, sql: &str) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar(sql).fetch_all(pool).await
}

async fn load_items(pool: &PgPool) -> Result<Vec<AdminEditableItem>, sqlx::Error> {
    let rows: Vec<ItemRow> = sqlx::query_as("SELECT id, slug, title, description, image_dark, image_light, config FROM learning_items ORDER BY title ASC, id ASC").fetch_all(pool).await?;
    Ok(rows
        .into_iter()
        .map(|row| AdminEditableItem {
            id: row.id,
            slug: row.slug,
            title: row.title,
            description: row.description,
            image_dark: row.image_dark,
            image_light: row.image_light,
            config: row.config,
        })
        .collect())
}

async fn load_tools(pool: &PgPool) -> Result<Vec<AdminEditableTool>, sqlx::Error> {
    let rows: Vec<ToolRow> = sqlx::query_as("SELECT id, slug, title, description, image_dark, image_light, animation_dark, animation_light, config, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_tools ORDER BY title ASC, id ASC").fetch_all(pool).await?;
    Ok(rows
        .into_iter()
        .map(|row| AdminEditableTool {
            animation_duration_seconds: row
                .config
                .get("animationDurationSeconds")
                .and_then(Value::as_f64),
            animation_width_percent: row
                .config
                .get("animationWidthPercent")
                .and_then(Value::as_f64),
            image_width_percent: row
                .config
                .get("imageWidthPercent")
                .and_then(Value::as_f64)
                .unwrap_or(16.0),
            id: row.id,
            slug: row.slug,
            title: row.title,
            description: row.description,
            image_dark: row.image_dark,
            image_light: row.image_light,
            animation_dark: row.animation_dark,
            animation_light: row.animation_light,
            config: row.config,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
        .collect())
}

async fn load_sounds(pool: &PgPool) -> Result<Vec<AdminEditableSound>, sqlx::Error> {
    let rows: Vec<SoundRow> = sqlx::query_as("SELECT id, name, slug, icon, url, volume, play_seconds::double precision AS play_seconds, loop AS loop_enabled FROM learning_sounds ORDER BY name ASC, id ASC").fetch_all(pool).await?;
    Ok(rows
        .into_iter()
        .map(|row| AdminEditableSound {
            id: row.id,
            name: row.name,
            slug: row.slug,
            icon: row.icon,
            url: row.url,
            volume: row.volume,
            play_seconds: row.play_seconds,
            loop_enabled: row.loop_enabled,
        })
        .collect())
}

fn connector(id: &str, label: &str) -> AdminActivityConnector {
    AdminActivityConnector {
        id: id.to_owned(),
        label: label.to_owned(),
    }
}
fn connectors_for(kind: &str, config: &Value) -> AdminActivityConnectors {
    let input = || {
        vec![connector(
            "in",
            if kind == "npc_dialogue" {
                "Entry"
            } else {
                "In"
            },
        )]
    };
    let (inputs, outputs) = match kind {
        "question" => (
            input(),
            vec![
                connector("correct", "Correct"),
                connector("incorrect", "Incorrect"),
                connector("outcome", "Outcome"),
            ],
        ),
        "portal" if config.get("portalMode").and_then(Value::as_str) == Some("input") => {
            (vec![], vec![connector("arrived", "Arrived")])
        }
        "portal" => (input(), vec![]),
        "npc_dialogue" => (input(), vec![connector("dialogue-end-pending", "A End")]),
        _ => (input(), vec![connector("completed", "Completed")]),
    };
    AdminActivityConnectors { inputs, outputs }
}

fn activity_type_definitions() -> Vec<AdminActivityTypeDefinition> {
    let types = [
        (
            "item_grant",
            "Grant Item(s)",
            "A server-rolled chance to grant one or more consumable inventory items.",
        ),
        (
            "item_obstacle",
            "Item obstacle",
            "A slot-based obstacle that consumes configured items before it can continue.",
        ),
        (
            "markdown",
            "Markdown",
            "A connected set of readable markdown pages with theme-specific page colors.",
        ),
        (
            "message_prompt",
            "Message prompt",
            "Invites a learner to leave one short message for a linked MapAsset topic.",
        ),
        (
            "message_wall",
            "Message wall",
            "Displays visible learner messages from a linked topic as dismissible cards.",
        ),
        (
            "npc_dialogue",
            "NPC dialogue",
            "A graph-based NPC conversation with one entry and exits defined by dialogue end nodes.",
        ),
        (
            "question",
            "Question",
            "A configurable question that can branch by answer outcome.",
        ),
        (
            "reflection",
            "Reflection",
            "A learner-owned pause for useful notes or synthesis.",
        ),
        (
            "review",
            "Review / revisit",
            "A learner-owned return to earlier ideas with optional private comparison.",
        ),
        (
            "shared_task",
            "Shared task",
            "A learner contribution task with activity-wide progress shared across users.",
        ),
        (
            "obstacle",
            "Obstacle",
            "A tool-resolved obstacle that continues after the learner uses a configured tool.",
        ),
        (
            "tool_grant",
            "Grant tool",
            "A focused scene that gives the learner an existing tool.",
        ),
        (
            "open_practice",
            "Open practice",
            "A quiet pause where the learner chooses and carries out their own next step.",
        ),
        (
            "portal",
            "Portal",
            "A map or node travel activity. Entry portals must end their path.",
        ),
    ];
    types
        .into_iter()
        .map(|(key, label, description)| {
            let connectors = if key == "portal" {
                AdminActivityConnectors {
                    inputs: vec![connector("in", "In")],
                    outputs: vec![connector("travel", "Travel")],
                }
            } else {
                connectors_for(key, &Value::Null)
            };
            AdminActivityTypeDefinition {
                key: key.to_owned(),
                label: label.to_owned(),
                description: description.to_owned(),
                inputs: connectors.inputs,
                outputs: connectors.outputs,
                portal_modes: (key == "portal").then(|| {
                    vec![
                        AdminPortalMode {
                            key: "input".to_owned(),
                            label: "Exit portal".to_owned(),
                        },
                        AdminPortalMode {
                            key: "output".to_owned(),
                            label: "Entry portal".to_owned(),
                        },
                    ]
                }),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;

    use super::{ActivityRow, connectors_for, eligible_start_activity_id};

    fn activity(activity_type: &str, config: serde_json::Value) -> ActivityRow {
        ActivityRow {
            id: Uuid::new_v4(),
            slug: "test-activity".to_owned(),
            activity_type: activity_type.to_owned(),
            title: "Test activity".to_owned(),
            introduction: None,
            config,
            updated_at: "2026-01-01T00:00:00.000000Z".to_owned(),
            ai_review_status: "needs_review".to_owned(),
            ai_reviewed_at: None,
            ai_review: None,
            x: None,
            y: None,
        }
    }

    #[test]
    fn excludes_an_exit_portal_from_the_preferred_start() {
        let exit_portal = activity("portal", json!({ "portalMode": "input" }));
        let exit_portal_id = exit_portal.id;

        assert_eq!(
            eligible_start_activity_id(&[exit_portal], Some(exit_portal_id)),
            None
        );
    }

    #[test]
    fn preserves_an_entry_portal_and_regular_activity_as_preferred_starts() {
        let entry_portal = activity("portal", json!({ "portalMode": "output" }));
        let practice = activity("open_practice", json!({}));
        let entry_portal_id = entry_portal.id;
        let practice_id = practice.id;

        assert_eq!(
            eligible_start_activity_id(&[entry_portal], Some(entry_portal_id)),
            Some(entry_portal_id)
        );
        assert_eq!(
            eligible_start_activity_id(&[practice], Some(practice_id)),
            Some(practice_id)
        );
    }

    #[test]
    fn portal_connectors_follow_the_source_mode_for_the_selected_activity() {
        let exit = connectors_for("portal", &json!({ "portalMode": "input" }));
        let entry = connectors_for("portal", &json!({ "portalMode": "output" }));

        assert!(exit.inputs.is_empty());
        assert_eq!(exit.outputs[0].id, "arrived");
        assert_eq!(entry.inputs[0].id, "in");
        assert!(entry.outputs.is_empty());
    }
}
