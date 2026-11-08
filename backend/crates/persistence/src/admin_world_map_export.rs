use serde_json::{Value, json};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_world_map_export::{
    AdminWorldMapExportError, AdminWorldMapExportRepository as Port, ExportedWorldMap,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

pub struct PostgresAdminWorldMapExportRepository<'pool> {
    pool: &'pool PgPool,
}
impl<'pool> PostgresAdminWorldMapExportRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldMapExportRepository<'_> {
    fn export_map(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<ExportedWorldMap>, AdminWorldMapExportError>,
    > + Send {
        async move {
            export_map(self.pool, principal, map_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not export scoped World Builder map");
                    AdminWorldMapExportError
                })
        }
    }
}

#[derive(FromRow)]
struct MapRow {
    id: Uuid,
    slug: String,
    title: String,
    description: String,
    world_slug: String,
    world_title: String,
    creator_id: Option<Uuid>,
    background_config: Value,
    grid_config: Value,
    access_roles: Value,
    map_assets_locked: bool,
    topic_slug: Option<String>,
}

async fn export_map(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_id: Uuid,
) -> Result<Option<ExportedWorldMap>, sqlx::Error> {
    let Some(map) = sqlx::query_as::<_, MapRow>("SELECT maps.id, maps.slug, maps.title, maps.description, worlds.slug AS world_slug, worlds.title AS world_title, maps.created_by_principal_id AS creator_id, maps.background_config, maps.grid_config, maps.access_roles, maps.map_assets_locked, topics.slug AS topic_slug FROM learning_maps AS maps INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id LEFT JOIN learning_topics AS topics ON topics.id = maps.topic_id WHERE maps.id = $1")
        .bind(map_id).fetch_optional(pool).await? else { return Ok(None); };
    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };
    let Some(scope) = principal.permission_scope("world_maps", "ru") else {
        return Ok(None);
    };
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id=$1 AND memberships.principal_id=$2)").bind(map.id).bind(principal_id).fetch_one(pool).await?;
    if !(scope == "all"
        || (permission_scope_allows(scope, "own") && map.creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct)
        || direct)
    {
        return Ok(None);
    }

    let nodes = nodes(pool, map.id).await?;
    let assets = assets(pool, map.id).await?;
    let portals = portals(pool, map.id).await?;
    let media_urls = collect_media_urls(
        &json!({"map": {"backgroundConfig": map.background_config, "gridConfig": map.grid_config}, "nodes": nodes, "mapAssets": assets, "portalTargets": portals}),
    );
    let payload = json!({
        "format": "wicked-learning-map", "formatVersion": 1,
        "exportedAt": exported_at(),
        "world": {"slug": map.world_slug, "title": map.world_title},
        "map": {"slug": map.slug, "title": map.title, "description": map.description, "topicSlug": map.topic_slug, "backgroundConfig": map.background_config, "gridConfig": map.grid_config, "accessRoles": map.access_roles, "mapAssetsLocked": map.map_assets_locked},
        "nodes": nodes, "mapAssets": assets, "portalTargets": portals,
        "references": {"mediaUrls": media_urls}
    });
    Ok(Some(ExportedWorldMap {
        filename: format!("{}-wicked-learning-map.json", map.slug),
        payload,
    }))
}

async fn nodes(pool: &PgPool, map_id: Uuid) -> Result<Vec<Value>, sqlx::Error> {
    sqlx::query_scalar("SELECT jsonb_build_object('sourceId', nodes.id, 'slug', nodes.slug, 'title', nodes.title, 'description', nodes.description, 'position', jsonb_build_object('q', nodes.position_q, 'r', nodes.position_r), 'state', nodes.state, 'visualConfig', nodes.visual_config, 'activityGraphLayout', nodes.activity_graph_layout, 'startActivitySlug', starts.slug, 'activityStarts', COALESCE((SELECT jsonb_agg(jsonb_build_object('activitySlug', activities.slug, 'label', route_starts.label, 'description', route_starts.description, 'imageDark', route_starts.image_dark, 'imageLight', route_starts.image_light, 'buttonColorDark', route_starts.button_color_dark, 'buttonBorderColorDark', route_starts.button_border_color_dark, 'buttonColorLight', route_starts.button_color_light, 'buttonBorderColorLight', route_starts.button_border_color_light, 'sortOrder', route_starts.sort_order) ORDER BY route_starts.sort_order, route_starts.id) FROM learning_activity_starts AS route_starts INNER JOIN learning_activities AS activities ON activities.id = route_starts.activity_id WHERE route_starts.node_id = nodes.id), '[]'::jsonb), 'activities', COALESCE((SELECT jsonb_agg(jsonb_build_object('sourceId', activities.id, 'slug', activities.slug, 'type', activities.activity_type, 'title', activities.title, 'introduction', activities.introduction, 'config', activities.activity_config, 'question', CASE WHEN activities.activity_type = 'question' THEN activities.activity_config ELSE NULL END, 'sortOrder', activities.position, 'graphPosition', jsonb_build_object('x', activities.graph_position_x, 'y', activities.graph_position_y), 'transitions', COALESCE((SELECT jsonb_agg(jsonb_build_object('toActivitySlug', targets.slug, 'fromConnector', transitions.from_connector, 'toConnector', transitions.to_connector, 'trigger', transitions.trigger, 'triggerValue', transitions.trigger_value, 'label', transitions.label, 'rules', transitions.rules)) FROM learning_activity_transitions AS transitions LEFT JOIN learning_activities AS targets ON targets.id=transitions.to_activity_id WHERE transitions.from_activity_id=activities.id), '[]'::jsonb), 'dialogueNodes', COALESCE((SELECT jsonb_agg(jsonb_build_object('sourceId', dialogue.id, 'type', dialogue.node_type, 'title', dialogue.title, 'body', dialogue.body, 'config', dialogue.node_config, 'sortOrder', dialogue.sort_order, 'graphPosition', jsonb_build_object('x', dialogue.graph_position_x, 'y', dialogue.graph_position_y)) ORDER BY dialogue.sort_order, dialogue.id) FROM learning_npc_dialogue_nodes AS dialogue WHERE dialogue.activity_id=activities.id), '[]'::jsonb), 'dialogueTransitions', COALESCE((SELECT jsonb_agg(jsonb_build_object('fromSourceId', dialogue.from_node_id, 'toSourceId', dialogue.to_node_id, 'fromConnector', dialogue.from_connector, 'toConnector', dialogue.to_connector)) FROM learning_npc_dialogue_transitions AS dialogue WHERE dialogue.activity_id=activities.id), '[]'::jsonb)) ORDER BY activities.position, activities.id) FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id=activities.route_id WHERE routes.map_asset_id=nodes.map_asset_id), '[]'::jsonb)) FROM learning_nodes AS nodes LEFT JOIN learning_activities AS starts ON starts.id=nodes.start_activity_id WHERE nodes.map_id=$1 ORDER BY nodes.position_q, nodes.position_r, nodes.slug")
        .bind(map_id).fetch_all(pool).await
}

async fn assets(pool: &PgPool, map_id: Uuid) -> Result<Vec<Value>, sqlx::Error> {
    sqlx::query_scalar("SELECT jsonb_build_object('sourceId', assets.id, 'nodeSlug', nodes.slug, 'imageUrl', assets.image_url, 'text', assets.text, 'x', assets.position_x, 'y', assets.position_y, 'z', assets.position_z, 'width', assets.width, 'opacity', assets.opacity, 'locked', assets.locked, 'focusable', assets.interaction_mode = 'focusable', 'interactionMode', assets.interaction_mode, 'interactionConfig', assets.interaction_config, 'visualConfig', assets.visual_config, 'soundConfig', assets.sound_config, 'messageTopics', COALESCE((SELECT jsonb_agg(jsonb_build_object('sourceId', topics.id, 'slug', topics.slug, 'title', topics.title) ORDER BY topics.slug) FROM learning_message_topics AS topics WHERE topics.map_asset_id=assets.id), '[]'::jsonb)) FROM learning_map_assets AS assets LEFT JOIN learning_nodes AS nodes ON nodes.map_asset_id=assets.id WHERE assets.map_id=$1 ORDER BY assets.position_z, assets.id")
        .bind(map_id).fetch_all(pool).await
}

async fn portals(pool: &PgPool, map_id: Uuid) -> Result<Vec<Value>, sqlx::Error> {
    sqlx::query_scalar("SELECT jsonb_build_object('sourceNodeSlug', source_nodes.slug, 'sourceActivitySlug', source_activities.slug, 'targetMapSlug', target_maps.slug, 'targetNodeSlug', target_nodes.slug, 'targetActivitySlug', target_activities.slug, 'label', links.label, 'description', links.description, 'config', '{}'::jsonb) FROM learning_portal_links AS links INNER JOIN learning_nodes AS source_nodes ON source_nodes.id=links.source_node_id INNER JOIN learning_activities AS source_activities ON source_activities.id=links.source_activity_id INNER JOIN learning_nodes AS target_nodes ON target_nodes.id=links.target_node_id INNER JOIN learning_maps AS target_maps ON target_maps.id=target_nodes.map_id INNER JOIN learning_activities AS target_activities ON target_activities.id=links.target_activity_id WHERE source_nodes.map_id=$1 ORDER BY links.source_activity_id")
        .bind(map_id).fetch_all(pool).await
}

fn exported_at() -> String {
    let now = time::OffsetDateTime::now_utc();
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        now.year(),
        now.month() as u8,
        now.day(),
        now.hour(),
        now.minute(),
        now.second(),
    )
}

fn collect_media_urls(value: &Value) -> Vec<String> {
    fn visit(value: &Value, output: &mut Vec<String>) {
        match value {
            Value::Object(map) => {
                for (key, value) in map {
                    let normalized = key.to_ascii_lowercase().replace(['_', '-'], "");
                    if let Some(text) = value.as_str() {
                        if (normalized.ends_with("url")
                            || normalized.contains("image")
                            || normalized.contains("sound")
                            || normalized.contains("audio")
                            || normalized == "src")
                            && !text.trim().is_empty()
                        {
                            output.push(text.to_owned());
                        }
                    }
                    visit(value, output);
                }
            }
            Value::Array(values) => {
                for value in values {
                    visit(value, output);
                }
            }
            _ => {}
        }
    }
    let mut urls = Vec::new();
    visit(value, &mut urls);
    urls.sort();
    urls.dedup();
    urls
}
