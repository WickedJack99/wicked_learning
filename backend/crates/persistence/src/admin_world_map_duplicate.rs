use std::collections::HashMap;

use serde_json::Value;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::{
    admin_world_map_create::CreateWorldMapForm,
    admin_world_map_duplicate::{
        AdminWorldMapDuplicateError, AdminWorldMapDuplicateRepository as Port, duplicate_map_slug,
    },
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

use crate::admin_world_map_import::synchronize_media_references;

pub struct PostgresAdminWorldMapDuplicateRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldMapDuplicateRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldMapDuplicateRepository<'_> {
    fn duplicate_map(
        &self,
        principal: &AuthorizedPrincipal,
        source_map_id: Uuid,
        form: &CreateWorldMapForm,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, AdminWorldMapDuplicateError>> + Send
    {
        async move {
            duplicate_map(self.pool, principal, source_map_id, form)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not duplicate scoped World Builder map");
                    AdminWorldMapDuplicateError
                })
        }
    }
}

#[derive(FromRow)]
struct ScopedMap {
    id: Uuid,
    world_id: Uuid,
    creator_id: Option<Uuid>,
}

#[derive(FromRow)]
struct NodeRow {
    id: Uuid,
    map_asset_id: Option<Uuid>,
    slug: String,
    title: String,
    description: String,
    position_q: i32,
    position_r: i32,
    state: String,
    companion_config: Value,
    visual_config: Value,
    activity_graph_layout: Value,
    start_activity_id: Option<Uuid>,
    published_at: Option<sqlx::types::time::OffsetDateTime>,
}

#[derive(FromRow)]
struct ActivityRow {
    id: Uuid,
    route_id: Uuid,
    slug: String,
    title: String,
    description: String,
    position: i16,
    published_at: Option<sqlx::types::time::OffsetDateTime>,
    activity_type: String,
    companion_config: Value,
    activity_config: Value,
    introduction: Option<String>,
    graph_position_x: Option<f64>,
    graph_position_y: Option<f64>,
}

#[derive(FromRow)]
struct DialogueNodeRow {
    id: Uuid,
    activity_id: Uuid,
    node_type: String,
    title: String,
    body: Option<String>,
    node_config: Value,
    sort_order: i16,
    graph_position_x: Option<f64>,
    graph_position_y: Option<f64>,
}

#[derive(FromRow)]
struct DialogueTransitionRow {
    activity_id: Uuid,
    from_node_id: Option<Uuid>,
    to_node_id: Uuid,
    from_connector: String,
    to_connector: Option<String>,
}

#[derive(FromRow)]
struct StartRow {
    id: Uuid,
    node_id: Uuid,
    activity_id: Uuid,
    label: Option<String>,
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
struct PortalRow {
    source_activity_id: Option<Uuid>,
    target_activity_id: Option<Uuid>,
    source_node_id: Uuid,
    target_node_id: Uuid,
    label: Option<String>,
    description: Option<String>,
}

async fn duplicate_map(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    source_map_id: Uuid,
    form: &CreateWorldMapForm,
) -> Result<Option<Uuid>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut transaction, principal).await? else {
        return Ok(None);
    };
    let Some(source) = sqlx::query_as::<_, ScopedMap>(
        "SELECT id, world_id, created_by_principal_id AS creator_id FROM learning_maps WHERE id = $1 FOR UPDATE",
    )
    .bind(source_map_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    if !can_edit(&mut transaction, principal, principal_id, &source).await? {
        return Ok(None);
    }

    let slug = unique_slug(
        &mut transaction,
        source.world_id,
        &duplicate_map_slug(form),
        form.slug.is_some(),
    )
    .await?;
    if slug.is_empty() {
        return Ok(None);
    }
    let duplicate_id = Uuid::new_v4();
    let position: i16 = sqlx::query_scalar(
        "SELECT (COALESCE(MAX(position), -1)::integer + 1)::smallint FROM learning_maps WHERE world_id = $1",
    )
    .bind(source.world_id)
    .fetch_one(&mut *transaction)
    .await?;
    sqlx::query("INSERT INTO learning_maps (id, world_id, slug, title, description, position, published_at, background_config, grid_config, map_assets_locked, access_roles, topic_id, created_by_principal_id, companion_config) SELECT $1, world_id, $2, $3, description, $4, published_at, background_config, grid_config, map_assets_locked, access_roles, topic_id, $5, companion_config FROM learning_maps WHERE id = $6")
        .bind(duplicate_id).bind(slug).bind(&form.title).bind(position).bind(principal_id).bind(source.id)
        .execute(&mut *transaction).await?;

    let asset_ids = clone_assets(&mut transaction, source.id, duplicate_id).await?;
    let topic_ids = clone_message_topics(&mut transaction, &asset_ids).await?;
    let node_rows = source_nodes(&mut transaction, source.id).await?;
    let node_ids = clone_nodes(&mut transaction, duplicate_id, &node_rows, &asset_ids).await?;
    let route_ids = clone_routes(&mut transaction, &asset_ids).await?;
    let activity_rows = source_activities(&mut transaction, source.id).await?;
    let activity_ids =
        clone_activities(&mut transaction, &activity_rows, &route_ids, &topic_ids).await?;

    remap_nodes(&mut transaction, &node_rows, &node_ids, &activity_ids).await?;
    let start_ids = clone_starts(&mut transaction, source.id, &node_ids, &activity_ids).await?;
    clone_activity_transitions(&mut transaction, source.id, &activity_ids).await?;
    let dialogue_node_ids =
        clone_dialogue_nodes(&mut transaction, source.id, &activity_ids, &node_ids).await?;
    clone_dialogue_transitions(
        &mut transaction,
        source.id,
        &activity_ids,
        &dialogue_node_ids,
    )
    .await?;
    clone_portals(&mut transaction, source.id, &node_ids, &activity_ids).await?;
    clone_media_references(
        &mut transaction,
        source.id,
        duplicate_id,
        &asset_ids,
        &activity_ids,
        &start_ids,
    )
    .await?;

    transaction.commit().await?;
    Ok(Some(duplicate_id))
}

async fn principal_id(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(&mut **transaction)
        .await
}

async fn can_edit(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map: &ScopedMap,
) -> Result<bool, sqlx::Error> {
    let Some(scope) = principal.permission_scope("world_maps", "ru") else {
        return Ok(false);
    };
    let direct_editor: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)")
        .bind(map.id).bind(principal_id).fetch_one(&mut **transaction).await?;
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && map.creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_editor)
        || direct_editor)
}

async fn unique_slug(
    transaction: &mut Transaction<'_, Postgres>,
    world_id: Uuid,
    base: &str,
    explicit: bool,
) -> Result<String, sqlx::Error> {
    let mut candidate = base.to_owned();
    for suffix in 2..10_000 {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM learning_maps WHERE world_id = $1 AND slug = $2)",
        )
        .bind(world_id)
        .bind(&candidate)
        .fetch_one(&mut **transaction)
        .await?;
        if !exists {
            return Ok(candidate);
        }
        if explicit {
            return Ok(String::new());
        }
        candidate = format!("{base}-{suffix}");
        if candidate.len() > 140 {
            return Ok(String::new());
        }
    }
    Ok(String::new())
}

async fn clone_assets(
    transaction: &mut Transaction<'_, Postgres>,
    source_map_id: Uuid,
    duplicate_map_id: Uuid,
) -> Result<HashMap<Uuid, Uuid>, sqlx::Error> {
    let source_ids: Vec<Uuid> =
        sqlx::query_scalar("SELECT id FROM learning_map_assets WHERE map_id = $1 ORDER BY id")
            .bind(source_map_id)
            .fetch_all(&mut **transaction)
            .await?;
    let mut ids = HashMap::new();
    for source_id in source_ids {
        let duplicate_id = Uuid::new_v4();
        sqlx::query("INSERT INTO learning_map_assets (id, map_id, slug, title, description, image_url, text, position_x, position_y, position_z, interaction_mode, published_at, width, opacity, locked, visual_config, interaction_config, sound_config) SELECT $1, $2, slug, title, description, image_url, text, position_x, position_y, position_z, interaction_mode, published_at, width, opacity, locked, visual_config, interaction_config, sound_config FROM learning_map_assets WHERE id = $3")
            .bind(duplicate_id).bind(duplicate_map_id).bind(source_id).execute(&mut **transaction).await?;
        ids.insert(source_id, duplicate_id);
    }
    Ok(ids)
}

async fn clone_message_topics(
    transaction: &mut Transaction<'_, Postgres>,
    asset_ids: &HashMap<Uuid, Uuid>,
) -> Result<HashMap<Uuid, Uuid>, sqlx::Error> {
    let mut ids = HashMap::new();
    for (source_asset_id, duplicate_asset_id) in asset_ids {
        let source_topics: Vec<Uuid> = sqlx::query_scalar(
            "SELECT id FROM learning_message_topics WHERE map_asset_id = $1 ORDER BY id",
        )
        .bind(source_asset_id)
        .fetch_all(&mut **transaction)
        .await?;
        for source_topic_id in source_topics {
            let duplicate_topic_id = Uuid::new_v4();
            sqlx::query("INSERT INTO learning_message_topics (id, map_asset_id, slug, title) SELECT $1, $2, slug, title FROM learning_message_topics WHERE id = $3")
                .bind(duplicate_topic_id).bind(duplicate_asset_id).bind(source_topic_id).execute(&mut **transaction).await?;
            ids.insert(source_topic_id, duplicate_topic_id);
        }
    }
    Ok(ids)
}

async fn source_nodes(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
) -> Result<Vec<NodeRow>, sqlx::Error> {
    sqlx::query_as("SELECT id, map_asset_id, slug, title, description, position_q, position_r, state, companion_config, visual_config, activity_graph_layout, start_activity_id, published_at FROM learning_nodes WHERE map_id = $1 ORDER BY id")
        .bind(map_id).fetch_all(&mut **transaction).await
}

async fn clone_nodes(
    transaction: &mut Transaction<'_, Postgres>,
    duplicate_map_id: Uuid,
    rows: &[NodeRow],
    asset_ids: &HashMap<Uuid, Uuid>,
) -> Result<HashMap<Uuid, Uuid>, sqlx::Error> {
    let mut ids = HashMap::new();
    for row in rows {
        let duplicate_id = Uuid::new_v4();
        sqlx::query("INSERT INTO learning_nodes (id, map_id, map_asset_id, slug, title, description, position_q, position_r, state, visual_config, published_at, activity_graph_layout, companion_config) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)")
            .bind(duplicate_id).bind(duplicate_map_id).bind(row.map_asset_id.and_then(|id| asset_ids.get(&id).copied())).bind(&row.slug).bind(&row.title).bind(&row.description).bind(row.position_q).bind(row.position_r).bind(&row.state).bind(&row.visual_config).bind(row.published_at).bind(&row.activity_graph_layout).bind(&row.companion_config).execute(&mut **transaction).await?;
        ids.insert(row.id, duplicate_id);
    }
    Ok(ids)
}

async fn clone_routes(
    transaction: &mut Transaction<'_, Postgres>,
    asset_ids: &HashMap<Uuid, Uuid>,
) -> Result<HashMap<Uuid, Uuid>, sqlx::Error> {
    let mut ids = HashMap::new();
    for (source_asset_id, duplicate_asset_id) in asset_ids {
        let source_ids: Vec<Uuid> = sqlx::query_scalar(
            "SELECT id FROM learning_routes WHERE map_asset_id = $1 ORDER BY id",
        )
        .bind(source_asset_id)
        .fetch_all(&mut **transaction)
        .await?;
        for source_id in source_ids {
            let duplicate_id = Uuid::new_v4();
            sqlx::query("INSERT INTO learning_routes (id, map_asset_id, slug, title, description, position, published_at) SELECT $1, $2, slug, title, description, position, published_at FROM learning_routes WHERE id = $3")
                .bind(duplicate_id).bind(duplicate_asset_id).bind(source_id).execute(&mut **transaction).await?;
            ids.insert(source_id, duplicate_id);
        }
    }
    Ok(ids)
}

async fn source_activities(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
) -> Result<Vec<ActivityRow>, sqlx::Error> {
    sqlx::query_as("SELECT activities.id, activities.route_id, activities.slug, activities.title, activities.description, activities.position, activities.published_at, activities.activity_type, activities.companion_config, activities.activity_config, activities.introduction, activities.graph_position_x, activities.graph_position_y FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id WHERE assets.map_id = $1 ORDER BY activities.id")
        .bind(map_id).fetch_all(&mut **transaction).await
}

async fn clone_activities(
    transaction: &mut Transaction<'_, Postgres>,
    rows: &[ActivityRow],
    route_ids: &HashMap<Uuid, Uuid>,
    topic_ids: &HashMap<Uuid, Uuid>,
) -> Result<HashMap<Uuid, Uuid>, sqlx::Error> {
    let mut ids = HashMap::new();
    for row in rows {
        let Some(route_id) = route_ids.get(&row.route_id).copied() else {
            continue;
        };
        let duplicate_id = Uuid::new_v4();
        sqlx::query("INSERT INTO learning_activities (id, route_id, slug, title, description, position, published_at, activity_type, activity_config, introduction, graph_position_x, graph_position_y, ai_review_status, ai_reviewed_at, ai_review, companion_config) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'needs_review', NULL, NULL, $13)")
            .bind(duplicate_id).bind(route_id).bind(&row.slug).bind(&row.title).bind(&row.description).bind(row.position).bind(row.published_at).bind(&row.activity_type).bind(remap_value(row.activity_config.clone(), topic_ids, &["messageTopicId"])).bind(&row.introduction).bind(row.graph_position_x).bind(row.graph_position_y).bind(&row.companion_config).execute(&mut **transaction).await?;
        ids.insert(row.id, duplicate_id);
    }
    Ok(ids)
}

async fn remap_nodes(
    transaction: &mut Transaction<'_, Postgres>,
    rows: &[NodeRow],
    node_ids: &HashMap<Uuid, Uuid>,
    activity_ids: &HashMap<Uuid, Uuid>,
) -> Result<(), sqlx::Error> {
    for row in rows {
        let Some(duplicate_id) = node_ids.get(&row.id) else {
            continue;
        };
        let visual_config = remap_value(
            row.visual_config.clone(),
            node_ids,
            &["nodeId", "node_id", "requiredNodeIds"],
        );
        sqlx::query(
            "UPDATE learning_nodes SET visual_config = $2, start_activity_id = $3 WHERE id = $1",
        )
        .bind(duplicate_id)
        .bind(&visual_config)
        .bind(
            row.start_activity_id
                .and_then(|id| activity_ids.get(&id).copied()),
        )
        .execute(&mut **transaction)
        .await?;
        synchronize_media_references(transaction, "node", *duplicate_id, &serde_json::json!({"visualConfig": visual_config, "companionConfig": row.companion_config})).await?;
    }
    Ok(())
}

async fn clone_starts(
    transaction: &mut Transaction<'_, Postgres>,
    source_map_id: Uuid,
    node_ids: &HashMap<Uuid, Uuid>,
    activity_ids: &HashMap<Uuid, Uuid>,
) -> Result<HashMap<Uuid, Uuid>, sqlx::Error> {
    let rows: Vec<StartRow> = sqlx::query_as("SELECT starts.id, starts.node_id, starts.activity_id, starts.label, starts.description, starts.image_dark, starts.image_light, starts.button_color_dark, starts.button_border_color_dark, starts.button_color_light, starts.button_border_color_light, starts.sort_order FROM learning_activity_starts AS starts INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id WHERE nodes.map_id = $1 ORDER BY starts.id")
        .bind(source_map_id).fetch_all(&mut **transaction).await?;
    let mut ids = HashMap::new();
    for row in rows {
        let (Some(node_id), Some(activity_id)) = (
            node_ids.get(&row.node_id),
            activity_ids.get(&row.activity_id),
        ) else {
            continue;
        };
        let duplicate_id = Uuid::new_v4();
        sqlx::query("INSERT INTO learning_activity_starts (id, node_id, activity_id, label, description, image_dark, image_light, button_color_dark, button_border_color_dark, button_color_light, button_border_color_light, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)")
            .bind(duplicate_id).bind(node_id).bind(activity_id).bind(&row.label).bind(&row.description).bind(&row.image_dark).bind(&row.image_light).bind(&row.button_color_dark).bind(&row.button_border_color_dark).bind(&row.button_color_light).bind(&row.button_border_color_light).bind(row.sort_order).execute(&mut **transaction).await?;
        ids.insert(row.id, duplicate_id);
    }
    Ok(ids)
}

async fn clone_activity_transitions(
    transaction: &mut Transaction<'_, Postgres>,
    source_map_id: Uuid,
    activity_ids: &HashMap<Uuid, Uuid>,
) -> Result<(), sqlx::Error> {
    let rows: Vec<(Uuid, Option<Uuid>, String, Option<String>, String, Option<String>, Option<String>, Value)> = sqlx::query_as("SELECT transitions.from_activity_id, transitions.to_activity_id, transitions.from_connector, transitions.to_connector, transitions.trigger, transitions.trigger_value, transitions.label, transitions.rules FROM learning_activity_transitions AS transitions INNER JOIN learning_activities AS activities ON activities.id = transitions.from_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id WHERE assets.map_id = $1")
        .bind(source_map_id).fetch_all(&mut **transaction).await?;
    for (
        source_from,
        source_to,
        from_connector,
        to_connector,
        trigger,
        trigger_value,
        label,
        rules,
    ) in rows
    {
        let Some(from_activity_id) = activity_ids.get(&source_from) else {
            continue;
        };
        let to_activity_id = source_to.and_then(|id| activity_ids.get(&id).copied());
        sqlx::query("INSERT INTO learning_activity_transitions (from_activity_id, to_activity_id, from_connector, to_connector, trigger, trigger_value, label, rules) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)")
            .bind(from_activity_id).bind(to_activity_id).bind(from_connector).bind(to_connector).bind(trigger).bind(trigger_value).bind(label).bind(rules).execute(&mut **transaction).await?;
    }
    Ok(())
}

async fn clone_dialogue_nodes(
    transaction: &mut Transaction<'_, Postgres>,
    source_map_id: Uuid,
    activity_ids: &HashMap<Uuid, Uuid>,
    node_ids: &HashMap<Uuid, Uuid>,
) -> Result<HashMap<Uuid, Uuid>, sqlx::Error> {
    let rows: Vec<DialogueNodeRow> = sqlx::query_as("SELECT dialogue.id, dialogue.activity_id, dialogue.node_type, dialogue.title, dialogue.body, dialogue.node_config, dialogue.sort_order, dialogue.graph_position_x, dialogue.graph_position_y FROM learning_npc_dialogue_nodes AS dialogue INNER JOIN learning_activities AS activities ON activities.id = dialogue.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id WHERE assets.map_id = $1 ORDER BY dialogue.id")
        .bind(source_map_id).fetch_all(&mut **transaction).await?;
    let mut ids = HashMap::new();
    for row in rows {
        let Some(activity_id) = activity_ids.get(&row.activity_id) else {
            continue;
        };
        let duplicate_id = Uuid::new_v4();
        sqlx::query("INSERT INTO learning_npc_dialogue_nodes (id, activity_id, node_type, title, body, node_config, sort_order, graph_position_x, graph_position_y) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)")
            .bind(duplicate_id).bind(activity_id).bind(row.node_type).bind(row.title).bind(row.body).bind(remap_value(row.node_config, node_ids, &["hideNodeIds", "unlockNodeIds"])).bind(row.sort_order).bind(row.graph_position_x).bind(row.graph_position_y).execute(&mut **transaction).await?;
        ids.insert(row.id, duplicate_id);
    }
    Ok(ids)
}

async fn clone_dialogue_transitions(
    transaction: &mut Transaction<'_, Postgres>,
    source_map_id: Uuid,
    activity_ids: &HashMap<Uuid, Uuid>,
    dialogue_node_ids: &HashMap<Uuid, Uuid>,
) -> Result<(), sqlx::Error> {
    let rows: Vec<DialogueTransitionRow> = sqlx::query_as("SELECT dialogue.activity_id, dialogue.from_node_id, dialogue.to_node_id, dialogue.from_connector, dialogue.to_connector FROM learning_npc_dialogue_transitions AS dialogue INNER JOIN learning_activities AS activities ON activities.id = dialogue.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id WHERE assets.map_id = $1")
        .bind(source_map_id).fetch_all(&mut **transaction).await?;
    for row in rows {
        let (Some(activity_id), Some(to_node_id)) = (
            activity_ids.get(&row.activity_id),
            dialogue_node_ids.get(&row.to_node_id),
        ) else {
            continue;
        };
        let from_node_id = row
            .from_node_id
            .and_then(|id| dialogue_node_ids.get(&id).copied());
        sqlx::query("INSERT INTO learning_npc_dialogue_transitions (activity_id, from_node_id, to_node_id, from_connector, to_connector) VALUES ($1, $2, $3, $4, $5)")
            .bind(activity_id).bind(from_node_id).bind(to_node_id).bind(row.from_connector).bind(row.to_connector).execute(&mut **transaction).await?;
    }
    Ok(())
}

async fn clone_portals(
    transaction: &mut Transaction<'_, Postgres>,
    source_map_id: Uuid,
    node_ids: &HashMap<Uuid, Uuid>,
    activity_ids: &HashMap<Uuid, Uuid>,
) -> Result<(), sqlx::Error> {
    let rows: Vec<PortalRow> = sqlx::query_as("SELECT links.source_activity_id, links.target_activity_id, links.source_node_id, links.target_node_id, links.label, links.description FROM learning_portal_links AS links INNER JOIN learning_nodes AS source_nodes ON source_nodes.id = links.source_node_id WHERE source_nodes.map_id = $1")
        .bind(source_map_id).fetch_all(&mut **transaction).await?;
    for row in rows {
        let Some(source_node_id) = node_ids.get(&row.source_node_id).copied() else {
            continue;
        };
        let source_activity_id = match row.source_activity_id {
            Some(activity_id) => {
                let Some(activity_id) = activity_ids.get(&activity_id).copied() else {
                    continue;
                };
                Some(activity_id)
            }
            None => None,
        };
        let target_activity_id = row.target_activity_id.map(|activity_id| {
            activity_ids
                .get(&activity_id)
                .copied()
                .unwrap_or(activity_id)
        });
        let target_node_id = node_ids
            .get(&row.target_node_id)
            .copied()
            .unwrap_or(row.target_node_id);
        sqlx::query("INSERT INTO learning_portal_links (source_activity_id, target_activity_id, source_node_id, target_node_id, label, description) VALUES ($1, $2, $3, $4, $5, $6)")
            .bind(source_activity_id).bind(target_activity_id).bind(source_node_id).bind(target_node_id).bind(row.label).bind(row.description).execute(&mut **transaction).await?;
    }
    Ok(())
}

async fn clone_media_references(
    transaction: &mut Transaction<'_, Postgres>,
    source_map_id: Uuid,
    duplicate_map_id: Uuid,
    asset_ids: &HashMap<Uuid, Uuid>,
    activity_ids: &HashMap<Uuid, Uuid>,
    start_ids: &HashMap<Uuid, Uuid>,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO reusable_media_asset_references (asset_id, owner_kind, owner_id, field_key) SELECT asset_id, owner_kind, $1, field_key FROM reusable_media_asset_references WHERE owner_kind = 'map' AND owner_id = $2 ON CONFLICT DO NOTHING")
        .bind(duplicate_map_id)
        .bind(source_map_id)
        .execute(&mut **transaction)
        .await?;
    for (owner_kind, ids) in [
        ("map_asset", asset_ids),
        ("activity", activity_ids),
        ("activity_start", start_ids),
    ] {
        for (source_owner_id, duplicate_owner_id) in ids {
            sqlx::query("INSERT INTO reusable_media_asset_references (asset_id, owner_kind, owner_id, field_key) SELECT asset_id, owner_kind, $1, field_key FROM reusable_media_asset_references WHERE owner_kind = $2 AND owner_id = $3 ON CONFLICT DO NOTHING")
                .bind(duplicate_owner_id).bind(owner_kind).bind(source_owner_id).execute(&mut **transaction).await?;
        }
    }
    Ok(())
}

fn remap_value(mut value: Value, ids: &HashMap<Uuid, Uuid>, keys: &[&str]) -> Value {
    match &mut value {
        Value::Object(object) => {
            for (key, nested) in object {
                if keys.contains(&key.as_str()) {
                    remap_identifier(nested, ids);
                } else {
                    *nested = remap_value(nested.take(), ids, keys);
                }
            }
        }
        Value::Array(values) => {
            for nested in values {
                *nested = remap_value(nested.take(), ids, keys);
            }
        }
        _ => {}
    }
    value
}

fn remap_identifier(value: &mut Value, ids: &HashMap<Uuid, Uuid>) {
    match value {
        Value::String(id) => {
            if let Ok(source) = Uuid::parse_str(id) {
                if let Some(duplicate) = ids.get(&source) {
                    *id = duplicate.to_string();
                }
            }
        }
        Value::Array(values) => {
            for value in values {
                remap_identifier(value, ids);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use serde_json::json;
    use uuid::Uuid;

    use super::remap_value;

    #[test]
    fn remaps_only_declared_internal_reference_fields() {
        let source = Uuid::new_v4();
        let duplicate = Uuid::new_v4();
        let ids = HashMap::from([(source, duplicate)]);
        let value = json!({"requiredNodeIds":[source.to_string()], "note":source.to_string()});

        assert_eq!(
            remap_value(value, &ids, &["requiredNodeIds"]),
            json!({"requiredNodeIds":[duplicate.to_string()], "note":source.to_string()})
        );
    }
}
