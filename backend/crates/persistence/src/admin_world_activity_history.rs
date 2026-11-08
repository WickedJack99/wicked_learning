use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_world_activity_history::{
    ActivityHistoryPageRequest, AdminWorldActivityHistoryError,
    AdminWorldActivityHistoryRepository as Port,
};
use wicked_learning_domain::{
    identity_access::{AuthorizedPrincipal, permission_scope_allows},
    world_content::{
        AdminActivityVersionDetails, AdminActivityVersionPage, AdminActivityVersionPagination,
        AdminActivityVersionSummary,
    },
};

use crate::admin_world_npc_dialogue::synchronize_media_references as synchronize_npc_dialogue_media_references;

pub struct PostgresAdminWorldActivityHistoryRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldActivityHistoryRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldActivityHistoryRepository<'_> {
    fn list_versions(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        page: ActivityHistoryPageRequest,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminActivityVersionPage>, AdminWorldActivityHistoryError>,
    > + Send {
        async move {
            list_versions(self.pool, principal, activity_id, page)
                .await
                .map_err(unavailable)
        }
    }

    fn version_details(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        version_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminActivityVersionDetails>, AdminWorldActivityHistoryError>,
    > + Send {
        async move {
            version_details(self.pool, principal, activity_id, version_id)
                .await
                .map_err(unavailable)
        }
    }

    fn restore_version(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        version_id: Uuid,
    ) -> impl std::future::Future<Output = Result<bool, AdminWorldActivityHistoryError>> + Send
    {
        async move {
            restore_version(self.pool, principal, activity_id, version_id)
                .await
                .map_err(unavailable)
        }
    }
}

fn unavailable(error: sqlx::Error) -> AdminWorldActivityHistoryError {
    tracing::error!(%error, "could not load or restore scoped activity history");
    AdminWorldActivityHistoryError::Unavailable
}

#[derive(FromRow)]
struct ScopedActivity {
    id: Uuid,
    map_asset_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
}

#[derive(FromRow)]
struct VersionRow {
    id: Uuid,
    created_at: String,
    snapshot: Value,
}

#[derive(FromRow)]
struct ActivitySnapshotRow {
    slug: String,
    title: String,
    introduction: Option<String>,
    activity_type: String,
    config: Value,
    graph_position_x: Option<f64>,
    graph_position_y: Option<f64>,
}

#[derive(FromRow)]
struct TransitionSnapshotRow {
    from_connector: String,
    to_activity_id: Option<Uuid>,
    to_activity_slug: Option<String>,
    to_connector: Option<String>,
    trigger: String,
    trigger_value: Option<String>,
    label: Option<String>,
    rules: Value,
}

#[derive(FromRow)]
struct NpcDialogueNodeSnapshotRow {
    id: Uuid,
    node_type: String,
    title: String,
    body: Option<String>,
    config: Value,
    sort_order: i16,
    graph_position_x: Option<f64>,
    graph_position_y: Option<f64>,
}

#[derive(FromRow)]
struct NpcDialogueTransitionSnapshotRow {
    id: Uuid,
    from_node_id: Option<Uuid>,
    to_node_id: Uuid,
    from_connector: String,
    to_connector: Option<String>,
}

async fn list_versions(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    page: ActivityHistoryPageRequest,
) -> Result<Option<AdminActivityVersionPage>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(activity) = scoped_activity(&mut transaction, principal, activity_id, false).await?
    else {
        return Ok(None);
    };
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM learning_activity_versions WHERE activity_id = $1",
    )
    .bind(activity.id)
    .fetch_one(&mut *transaction)
    .await?;
    let rows: Vec<VersionRow> = sqlx::query_as(
        "SELECT id, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, snapshot FROM learning_activity_versions WHERE activity_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3",
    )
    .bind(activity.id)
    .bind(page.per_page)
    .bind((page.page - 1) * page.per_page)
    .fetch_all(&mut *transaction)
    .await?;
    transaction.commit().await?;
    let last_page = (total + page.per_page - 1) / page.per_page;
    Ok(Some(AdminActivityVersionPage {
        items: rows.into_iter().map(summary).collect(),
        pagination: AdminActivityVersionPagination {
            page: page.page,
            per_page: page.per_page,
            total,
            last_page: last_page.max(1),
        },
    }))
}

async fn version_details(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    version_id: Uuid,
) -> Result<Option<AdminActivityVersionDetails>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(activity) = scoped_activity(&mut transaction, principal, activity_id, false).await?
    else {
        return Ok(None);
    };
    let row = sqlx::query_as::<_, VersionRow>(
        "SELECT id, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, snapshot FROM learning_activity_versions WHERE id = $1 AND activity_id = $2",
    )
    .bind(version_id)
    .bind(activity.id)
    .fetch_optional(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(row.map(details))
}

async fn restore_version(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    version_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(activity) = scoped_activity(&mut transaction, principal, activity_id, true).await?
    else {
        return Ok(false);
    };
    let version = sqlx::query_as::<_, VersionRow>(
        "SELECT id, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, snapshot FROM learning_activity_versions WHERE id = $1 AND activity_id = $2 FOR UPDATE",
    )
    .bind(version_id)
    .bind(activity.id)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(version) = version else {
        return Ok(false);
    };
    record_activity_version(&mut transaction, activity.id, principal).await?;
    restore_activity_fields(&mut transaction, activity.id, &version.snapshot).await?;
    restore_npc_dialogue_graph(&mut transaction, activity.id, &version.snapshot).await?;
    if version
        .snapshot
        .get("npcDialogueNodes")
        .is_some_and(Value::is_array)
    {
        synchronize_npc_dialogue_media_references(&mut transaction, activity.id).await?;
    }
    if let Some(transitions) = version
        .snapshot
        .get("transitions")
        .and_then(Value::as_array)
    {
        restore_transitions(
            &mut transaction,
            activity.id,
            activity.map_asset_id,
            transitions,
        )
        .await?;
    }
    transaction.commit().await?;
    Ok(true)
}

/// Called by every source-compatible activity or transition mutation before it
/// changes authoring state. The snapshot is deliberately transaction-local so
/// a failed write cannot leave a phantom history entry behind.
pub(crate) async fn record_activity_version(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
    principal: &AuthorizedPrincipal,
) -> Result<(), sqlx::Error> {
    let changed_by_principal_id = application_principal_id(transaction, principal).await?;
    let snapshot = snapshot(transaction, activity_id).await?;
    sqlx::query(
        "INSERT INTO learning_activity_versions (activity_id, changed_by_principal_id, snapshot) VALUES ($1, $2, $3)",
    )
    .bind(activity_id)
    .bind(changed_by_principal_id)
    .bind(snapshot)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn scoped_activity(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    lock: bool,
) -> Result<Option<ScopedActivity>, sqlx::Error> {
    let Some(principal_id) = application_principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let query = if lock {
        "SELECT activities.id, routes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 FOR UPDATE OF activities, nodes"
    } else {
        "SELECT activities.id, routes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1"
    };
    let Some(activity) = sqlx::query_as::<_, ScopedActivity>(query)
        .bind(activity_id)
        .fetch_optional(&mut **transaction)
        .await?
    else {
        return Ok(None);
    };
    let direct_editor: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)",
    )
    .bind(activity.map_id)
    .bind(principal_id)
    .fetch_one(&mut **transaction)
    .await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(None);
    };
    let permitted = scope == "all"
        || (permission_scope_allows(scope, "own") && activity.map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_editor)
        || direct_editor;
    Ok(permitted.then_some(activity))
}

async fn application_principal_id(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut **transaction)
    .await
}

async fn snapshot(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
) -> Result<Value, sqlx::Error> {
    let activity = sqlx::query_as::<_, ActivitySnapshotRow>(
        "SELECT slug, title, introduction, activity_type, activity_config AS config, graph_position_x, graph_position_y FROM learning_activities WHERE id = $1",
    )
    .bind(activity_id)
    .fetch_one(&mut **transaction)
    .await?;
    let transitions: Vec<TransitionSnapshotRow> = sqlx::query_as(
        "SELECT transitions.from_connector, transitions.to_activity_id, targets.slug AS to_activity_slug, transitions.to_connector, transitions.trigger, transitions.trigger_value, transitions.label, transitions.rules FROM learning_activity_transitions AS transitions LEFT JOIN learning_activities AS targets ON targets.id = transitions.to_activity_id WHERE transitions.from_activity_id = $1 ORDER BY transitions.created_at ASC, transitions.id ASC",
    )
    .bind(activity_id)
    .fetch_all(&mut **transaction)
    .await?;
    let dialogue_nodes: Vec<NpcDialogueNodeSnapshotRow> = if activity.activity_type
        == "npc_dialogue"
    {
        sqlx::query_as("SELECT id, node_type, title, body, node_config AS config, sort_order, graph_position_x, graph_position_y FROM learning_npc_dialogue_nodes WHERE activity_id = $1 ORDER BY sort_order ASC, id ASC")
            .bind(activity_id).fetch_all(&mut **transaction).await?
    } else {
        vec![]
    };
    let dialogue_transitions: Vec<NpcDialogueTransitionSnapshotRow> = if activity.activity_type
        == "npc_dialogue"
    {
        sqlx::query_as("SELECT id, from_node_id, to_node_id, from_connector, to_connector FROM learning_npc_dialogue_transitions WHERE activity_id = $1 ORDER BY created_at ASC, id ASC")
            .bind(activity_id).fetch_all(&mut **transaction).await?
    } else {
        vec![]
    };
    Ok(json!({
        "companionConfig": {},
        "config": activity.config,
        "graphPositionX": activity.graph_position_x,
        "graphPositionY": activity.graph_position_y,
        "introduction": activity.introduction,
        "slug": activity.slug,
        "title": activity.title,
        "type": activity.activity_type,
        "npcDialogueNodes": dialogue_nodes.into_iter().map(|node| json!({
            "id": node.id, "type": node.node_type, "title": node.title, "body": node.body,
            "config": node.config, "sortOrder": node.sort_order,
            "graphPositionX": node.graph_position_x, "graphPositionY": node.graph_position_y,
        })).collect::<Vec<_>>(),
        "npcDialogueTransitions": dialogue_transitions.into_iter().map(|transition| json!({
            "id": transition.id, "fromNodeId": transition.from_node_id,
            "toNodeId": transition.to_node_id, "fromConnector": transition.from_connector,
            "toConnector": transition.to_connector,
        })).collect::<Vec<_>>(),
        "transitions": transitions.into_iter().map(|transition| json!({
            "fromConnector": transition.from_connector,
            "label": transition.label,
            "rules": transition.rules,
            "toActivityId": transition.to_activity_id,
            "toActivitySlug": transition.to_activity_slug,
            "toConnector": transition.to_connector,
            "trigger": transition.trigger,
            "triggerValue": transition.trigger_value,
        })).collect::<Vec<_>>(),
    }))
}

async fn restore_npc_dialogue_graph(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
    snapshot: &Value,
) -> Result<(), sqlx::Error> {
    let Some(nodes) = snapshot.get("npcDialogueNodes").and_then(Value::as_array) else {
        return Ok(());
    };
    sqlx::query("DELETE FROM learning_npc_dialogue_nodes WHERE activity_id = $1")
        .bind(activity_id)
        .execute(&mut **transaction)
        .await?;
    for node in nodes {
        let Some(object) = node.as_object() else {
            continue;
        };
        let Some(id) = object
            .get("id")
            .and_then(Value::as_str)
            .and_then(|value| Uuid::parse_str(value).ok())
        else {
            continue;
        };
        let Some(node_type) = object.get("type").and_then(Value::as_str).filter(|value| {
            matches!(
                *value,
                "npc_monologue" | "npc_question" | "reflection" | "answer" | "end"
            )
        }) else {
            continue;
        };
        let Some(title) = object
            .get("title")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty() && value.chars().count() <= 120)
        else {
            continue;
        };
        let body = object
            .get("body")
            .and_then(Value::as_str)
            .filter(|value| value.chars().count() <= 4_000);
        let config = object
            .get("config")
            .filter(|value| value.is_object())
            .cloned()
            .unwrap_or_else(|| json!({}));
        let sort_order = object
            .get("sortOrder")
            .and_then(Value::as_i64)
            .and_then(|value| i16::try_from(value).ok())
            .unwrap_or(0);
        sqlx::query("INSERT INTO learning_npc_dialogue_nodes (id, activity_id, node_type, title, body, node_config, sort_order, graph_position_x, graph_position_y) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)")
            .bind(id).bind(activity_id).bind(node_type).bind(title).bind(body).bind(config).bind(sort_order)
            .bind(object.get("graphPositionX").and_then(Value::as_f64)).bind(object.get("graphPositionY").and_then(Value::as_f64))
            .execute(&mut **transaction).await?;
    }
    let Some(transitions) = snapshot
        .get("npcDialogueTransitions")
        .and_then(Value::as_array)
    else {
        return Ok(());
    };
    for transition in transitions {
        let Some(object) = transition.as_object() else {
            continue;
        };
        let Some(id) = object
            .get("id")
            .and_then(Value::as_str)
            .and_then(|value| Uuid::parse_str(value).ok())
        else {
            continue;
        };
        let from_node_id = object
            .get("fromNodeId")
            .and_then(Value::as_str)
            .and_then(|value| Uuid::parse_str(value).ok());
        let Some(to_node_id) = object
            .get("toNodeId")
            .and_then(Value::as_str)
            .and_then(|value| Uuid::parse_str(value).ok())
        else {
            continue;
        };
        let Some(from_connector) = object
            .get("fromConnector")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty() && value.len() <= 80)
        else {
            continue;
        };
        let to_connector = object
            .get("toConnector")
            .and_then(Value::as_str)
            .map(str::to_owned);
        sqlx::query("INSERT INTO learning_npc_dialogue_transitions (id, activity_id, from_node_id, to_node_id, from_connector, to_connector) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING")
            .bind(id).bind(activity_id).bind(from_node_id).bind(to_node_id).bind(from_connector).bind(to_connector)
            .execute(&mut **transaction).await?;
    }
    Ok(())
}

fn summary(row: VersionRow) -> AdminActivityVersionSummary {
    AdminActivityVersionSummary {
        id: row.id,
        created_at: row.created_at,
        introduction: snapshot_string(&row.snapshot, "introduction"),
        slug: snapshot_string(&row.snapshot, "slug"),
        title: snapshot_string(&row.snapshot, "title"),
        activity_type: snapshot_string(&row.snapshot, "type"),
    }
}

fn details(row: VersionRow) -> AdminActivityVersionDetails {
    AdminActivityVersionDetails {
        id: row.id,
        created_at: row.created_at,
        introduction: snapshot_string(&row.snapshot, "introduction"),
        slug: snapshot_string(&row.snapshot, "slug"),
        title: snapshot_string(&row.snapshot, "title"),
        activity_type: snapshot_string(&row.snapshot, "type"),
        snapshot: row.snapshot,
    }
}

fn snapshot_string(snapshot: &Value, key: &str) -> Option<String> {
    snapshot.get(key).and_then(Value::as_str).map(str::to_owned)
}

async fn restore_activity_fields(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
    snapshot: &Value,
) -> Result<(), sqlx::Error> {
    let current = sqlx::query_as::<_, ActivitySnapshotRow>(
        "SELECT slug, title, introduction, activity_type, activity_config AS config, graph_position_x, graph_position_y FROM learning_activities WHERE id = $1",
    )
    .bind(activity_id)
    .fetch_one(&mut **transaction)
    .await?;
    let slug = snapshot_string(snapshot, "slug").unwrap_or(current.slug);
    let title = snapshot_string(snapshot, "title").unwrap_or(current.title);
    let introduction = snapshot
        .get("introduction")
        .and_then(Value::as_str)
        .map(str::to_owned);
    let activity_type = snapshot_string(snapshot, "type").unwrap_or(current.activity_type);
    let config = snapshot
        .get("config")
        .filter(|value| value.is_object())
        .cloned()
        .unwrap_or(current.config);
    let graph_position_x = snapshot.get("graphPositionX").and_then(Value::as_f64);
    let graph_position_y = snapshot.get("graphPositionY").and_then(Value::as_f64);
    sqlx::query(
        "UPDATE learning_activities SET slug = $2, title = $3, description = $4, introduction = $5, activity_type = $6, activity_config = $7, graph_position_x = $8, graph_position_y = $9, ai_review_status = 'needs_review', ai_reviewed_at = NULL, ai_review = NULL, updated_at = NOW() WHERE id = $1",
    )
    .bind(activity_id)
    .bind(slug)
    .bind(title)
    .bind(introduction.clone().unwrap_or_default())
    .bind(introduction)
    .bind(activity_type)
    .bind(config)
    .bind(graph_position_x)
    .bind(graph_position_y)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

async fn restore_transitions(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
    map_asset_id: Uuid,
    snapshots: &[Value],
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM learning_activity_transitions WHERE from_activity_id = $1")
        .bind(activity_id)
        .execute(&mut **transaction)
        .await?;
    for snapshot in snapshots {
        let Some(object) = snapshot.as_object() else {
            continue;
        };
        let from_connector = object
            .get("fromConnector")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let to_connector = object
            .get("toConnector")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let (Some(from_connector), Some(to_connector)) = (from_connector, to_connector) else {
            continue;
        };
        let target_id = object
            .get("toActivityId")
            .and_then(Value::as_str)
            .and_then(|value| Uuid::parse_str(value).ok());
        if object.get("toActivityId").is_some() && !object["toActivityId"].is_null() {
            let Some(target_id) = target_id else {
                continue;
            };
            let target_exists: bool = sqlx::query_scalar(
                "SELECT EXISTS (SELECT 1 FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE activities.id = $1 AND routes.map_asset_id = $2)",
            )
            .bind(target_id)
            .bind(map_asset_id)
            .fetch_one(&mut **transaction)
            .await?;
            if !target_exists {
                continue;
            }
        }
        let trigger = object
            .get("trigger")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("completed");
        let trigger_value = object
            .get("triggerValue")
            .and_then(Value::as_str)
            .map(str::to_owned);
        let label = object
            .get("label")
            .and_then(Value::as_str)
            .map(str::to_owned);
        let rules = object
            .get("rules")
            .filter(|value| value.is_object())
            .cloned()
            .unwrap_or_else(|| json!({}));
        sqlx::query(
            "INSERT INTO learning_activity_transitions (from_activity_id, to_activity_id, from_connector, to_connector, trigger, trigger_value, label, rules) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (from_activity_id, to_activity_id, from_connector, to_connector) DO NOTHING",
        )
        .bind(activity_id)
        .bind(target_id)
        .bind(from_connector)
        .bind(to_connector)
        .bind(trigger)
        .bind(trigger_value)
        .bind(label)
        .bind(rules)
        .execute(&mut **transaction)
        .await?;
    }
    Ok(())
}
