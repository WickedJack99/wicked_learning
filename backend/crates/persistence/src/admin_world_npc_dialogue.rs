use serde_json::{Map, Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::{
    admin_world_npc_dialogue::{
        AdminWorldNpcDialogueError, AdminWorldNpcDialogueRepository as Port,
        CreatedNpcDialogueActivity, NpcDialogueActivityForm, NpcDialogueNodeForm,
        NpcDialogueNodeType, NpcDialoguePosition, NpcDialogueTransitionForm,
    },
    admin_world_reflection::generated_slug,
};
use wicked_learning_domain::{
    identity_access::{AuthorizedPrincipal, permission_scope_allows},
    world_content::{
        AdminActivityGraphPosition, AdminNpcDialogueActivity, AdminNpcDialogueGraph,
        AdminNpcDialogueNode, AdminNpcDialogueTransition, AdminNpcDialogueTypingSoundSet,
        AdminNpcDialogueWorldNode,
    },
};

use crate::admin_world_activity_history::record_activity_version;

const MEDIA_ASSET_CONTENT_PREFIX: &str = "/api/v1/admin/media-assets/";
const MEDIA_REFERENCE_KIND: &str = "activity";
const MAX_MEDIA_REFERENCES: usize = 80;

pub struct PostgresAdminWorldNpcDialogueRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldNpcDialogueRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldNpcDialogueRepository<'_> {
    fn load_npc_dialogue(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminNpcDialogueGraph>, AdminWorldNpcDialogueError>,
    > + Send {
        async move {
            load(self.pool, principal, activity_id)
                .await
                .map_err(map_error)
        }
    }
    fn create_npc_dialogue(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &NpcDialogueActivityForm,
    ) -> impl std::future::Future<
        Output = Result<Option<CreatedNpcDialogueActivity>, AdminWorldNpcDialogueError>,
    > + Send {
        async move {
            create(self.pool, principal, node_id, form)
                .await
                .map_err(map_error)
        }
    }
    fn create_dialogue_node(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &NpcDialogueNodeForm,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, AdminWorldNpcDialogueError>> + Send
    {
        async move {
            create_node(self.pool, principal, activity_id, form)
                .await
                .map_err(map_error)
        }
    }
    fn update_dialogue_node(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        dialogue_node_id: Uuid,
        form: &NpcDialogueNodeForm,
    ) -> impl std::future::Future<Output = Result<bool, AdminWorldNpcDialogueError>> + Send {
        async move {
            update_node(self.pool, principal, activity_id, dialogue_node_id, form)
                .await
                .map_err(map_error)
        }
    }
    fn delete_dialogue_node(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        dialogue_node_id: Uuid,
    ) -> impl std::future::Future<Output = Result<bool, AdminWorldNpcDialogueError>> + Send {
        async move {
            delete_node(self.pool, principal, activity_id, dialogue_node_id)
                .await
                .map_err(map_error)
        }
    }
    fn create_dialogue_transition(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &NpcDialogueTransitionForm,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, AdminWorldNpcDialogueError>> + Send
    {
        async move {
            create_transition(self.pool, principal, activity_id, form)
                .await
                .map_err(map_error)
        }
    }
    fn delete_dialogue_transition(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        transition_id: Uuid,
    ) -> impl std::future::Future<Output = Result<bool, AdminWorldNpcDialogueError>> + Send {
        async move {
            delete_transition(self.pool, principal, activity_id, transition_id)
                .await
                .map_err(map_error)
        }
    }
    fn update_dialogue_layout(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        position: NpcDialoguePosition,
    ) -> impl std::future::Future<Output = Result<bool, AdminWorldNpcDialogueError>> + Send {
        async move {
            update_layout(self.pool, principal, activity_id, position)
                .await
                .map_err(map_error)
        }
    }
}

#[derive(FromRow)]
struct ScopedNode {
    map_asset_id: Option<Uuid>,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
}
#[derive(FromRow)]
struct ScopedActivity {
    map_asset_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
}
#[derive(FromRow)]
struct GraphActivityRow {
    id: Uuid,
    slug: String,
    title: String,
    introduction: Option<String>,
    config: Value,
}
#[derive(FromRow)]
struct GraphNodeRow {
    id: Uuid,
    node_type: String,
    title: String,
    body: Option<String>,
    config: Value,
    x: Option<f64>,
    y: Option<f64>,
}
#[derive(FromRow)]
struct GraphTransitionRow {
    id: Uuid,
    from_node_id: Option<Uuid>,
    to_node_id: Uuid,
    from_connector: String,
    to_connector: Option<String>,
}
#[derive(FromRow)]
struct WorldNodeRow {
    id: Uuid,
    map_title: String,
    title: String,
}
#[derive(FromRow)]
struct TypingSoundSetRow {
    id: Uuid,
    name: String,
    is_default: bool,
}

enum MutationError {
    Invalid,
    Conflict,
    Storage(sqlx::Error),
}
impl From<sqlx::Error> for MutationError {
    fn from(value: sqlx::Error) -> Self {
        Self::Storage(value)
    }
}
fn map_error(error: MutationError) -> AdminWorldNpcDialogueError {
    match error {
        MutationError::Invalid => AdminWorldNpcDialogueError::InvalidActivity,
        MutationError::Conflict => AdminWorldNpcDialogueError::Conflict,
        MutationError::Storage(error) => {
            tracing::error!(%error, "could not mutate scoped World Builder NPC dialogue");
            AdminWorldNpcDialogueError::Unavailable
        }
    }
}

async fn load(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
) -> Result<Option<AdminNpcDialogueGraph>, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(activity) = scoped_activity(&mut transaction, principal, activity_id, false).await?
    else {
        return Ok(None);
    };
    let row: GraphActivityRow = sqlx::query_as("SELECT id, slug, title, introduction, activity_config AS config FROM learning_activities WHERE id = $1 AND activity_type = 'npc_dialogue'")
        .bind(activity_id).fetch_optional(&mut *transaction).await?.ok_or(MutationError::Invalid)?;
    let node_rows: Vec<GraphNodeRow> = sqlx::query_as("SELECT id, node_type, title, body, node_config AS config, graph_position_x AS x, graph_position_y AS y FROM learning_npc_dialogue_nodes WHERE activity_id = $1 ORDER BY sort_order ASC, id ASC")
        .bind(activity_id).fetch_all(&mut *transaction).await?;
    let transition_rows: Vec<GraphTransitionRow> = sqlx::query_as("SELECT id, from_node_id, to_node_id, from_connector, to_connector FROM learning_npc_dialogue_transitions WHERE activity_id = $1 ORDER BY created_at ASC, id ASC")
        .bind(activity_id).fetch_all(&mut *transaction).await?;
    let world_nodes: Vec<WorldNodeRow> = sqlx::query_as("SELECT nodes.id, maps.title AS map_title, nodes.title FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE maps.world_id = (SELECT maps.world_id FROM learning_nodes AS activity_nodes INNER JOIN learning_maps AS maps ON maps.id = activity_nodes.map_id INNER JOIN learning_map_assets AS assets ON assets.id = activity_nodes.map_asset_id INNER JOIN learning_routes AS routes ON routes.map_asset_id = assets.id WHERE routes.map_asset_id = $1 LIMIT 1) ORDER BY maps.title ASC, nodes.title ASC, nodes.id ASC")
        .bind(activity.map_asset_id).fetch_all(&mut *transaction).await?;
    let sound_sets: Vec<TypingSoundSetRow> = sqlx::query_as("SELECT id, name, is_default FROM learning_dialogue_typing_sound_sets ORDER BY is_default DESC, name ASC, id ASC")
        .fetch_all(&mut *transaction).await?;
    transaction.commit().await?;
    Ok(Some(AdminNpcDialogueGraph {
        activity: AdminNpcDialogueActivity {
            id: row.id,
            slug: row.slug,
            title: row.title,
            introduction: row.introduction,
            graph_layout: row
                .config
                .get("dialogueGraphLayout")
                .filter(|value| value.is_object())
                .cloned()
                .unwrap_or_else(|| json!({})),
        },
        dialogue_nodes: node_rows
            .into_iter()
            .map(|node| AdminNpcDialogueNode {
                id: node.id,
                node_type: node.node_type,
                title: node.title,
                body: node.body,
                config: node.config,
                position: AdminActivityGraphPosition {
                    x: node.x,
                    y: node.y,
                },
            })
            .collect(),
        transitions: transition_rows
            .into_iter()
            .map(|transition| AdminNpcDialogueTransition {
                id: transition.id,
                from_node_id: transition.from_node_id,
                to_node_id: transition.to_node_id,
                from_connector: transition.from_connector,
                to_connector: transition.to_connector.unwrap_or_else(|| "in".to_owned()),
            })
            .collect(),
        world_nodes: world_nodes
            .into_iter()
            .map(|node| AdminNpcDialogueWorldNode {
                id: node.id,
                map_title: node.map_title,
                title: node.title,
            })
            .collect(),
        typing_sound_sets: sound_sets
            .into_iter()
            .map(|set| AdminNpcDialogueTypingSoundSet {
                id: set.id,
                name: set.name,
                is_default: set.is_default,
            })
            .collect(),
    }))
}

async fn create(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    form: &NpcDialogueActivityForm,
) -> Result<Option<CreatedNpcDialogueActivity>, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(node) = lock_editable_node(&mut transaction, principal, node_id).await? else {
        return Ok(None);
    };
    let Some(map_asset_id) = node.map_asset_id else {
        return Ok(None);
    };
    let Some(route_id) = sqlx::query_scalar::<_, Uuid>("SELECT id FROM learning_routes WHERE map_asset_id = $1 ORDER BY position ASC, id ASC LIMIT 1 FOR UPDATE").bind(map_asset_id).fetch_optional(&mut *transaction).await? else { return Ok(None); };
    let id = Uuid::new_v4();
    let position: i16 = sqlx::query_scalar("SELECT (COALESCE(MAX(position), -1)::integer + 1)::smallint FROM learning_activities WHERE route_id = $1").bind(route_id).fetch_one(&mut *transaction).await?;
    let slug = unique_slug(&mut transaction, map_asset_id, form, None).await?;
    let config = json!({"dialogueGraphLayout": {}});
    sqlx::query("INSERT INTO learning_activities (id, route_id, slug, title, description, position, published_at, activity_type, activity_config, introduction, graph_position_x, graph_position_y, ai_review_status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'npc_dialogue', $7, $8, $9, $10, 'needs_review')")
        .bind(id).bind(route_id).bind(&slug).bind(&form.title).bind(form.introduction.clone().unwrap_or_default()).bind(position).bind(&config).bind(&form.introduction).bind(form.graph_position_x.map(f64::from)).bind(form.graph_position_y.map(f64::from)).execute(&mut *transaction).await?;
    let end_id = Uuid::new_v4();
    sqlx::query("INSERT INTO learning_npc_dialogue_nodes (id, activity_id, node_type, title, body, node_config, sort_order, graph_position_x, graph_position_y) VALUES ($1, $2, 'end', 'End A', NULL, $3, 10, 520, 80)")
        .bind(end_id).bind(id).bind(json!({"connectorColor":"#0ea5e9","connectorSymbol":"A"})).execute(&mut *transaction).await?;
    transaction.commit().await?;
    Ok(Some(CreatedNpcDialogueActivity {
        activity_id: id,
        config,
        slug,
    }))
}

async fn create_node(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    form: &NpcDialogueNodeForm,
) -> Result<Option<Uuid>, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(activity) = lock_activity(&mut transaction, principal, activity_id).await? else {
        return Ok(None);
    };
    validate_node_config(&mut transaction, activity.map_id, form).await?;
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM learning_npc_dialogue_nodes WHERE activity_id = $1",
    )
    .bind(activity_id)
    .fetch_one(&mut *transaction)
    .await?;
    if count >= 80 {
        return Err(MutationError::Invalid);
    }
    record_activity_version(&mut transaction, activity_id, principal).await?;
    let end_index: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM learning_npc_dialogue_nodes WHERE activity_id = $1 AND node_type = 'end'").bind(activity_id).fetch_one(&mut *transaction).await?;
    let config = normalized_config(form, end_index as usize, None);
    let sort_order: i16 = sqlx::query_scalar("SELECT (COALESCE(MAX(sort_order), 0)::integer + 10)::smallint FROM learning_npc_dialogue_nodes WHERE activity_id = $1").bind(activity_id).fetch_one(&mut *transaction).await?;
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO learning_npc_dialogue_nodes (id, activity_id, node_type, title, body, node_config, sort_order, graph_position_x, graph_position_y) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)")
        .bind(id).bind(activity_id).bind(form.node_type.as_str()).bind(&form.title).bind(&form.body).bind(config).bind(sort_order).bind(form.position.as_ref().map(|position| position.x)).bind(form.position.as_ref().map(|position| position.y)).execute(&mut *transaction).await?;
    touch_activity(&mut transaction, activity_id).await?;
    synchronize_media_references(&mut transaction, activity_id).await?;
    transaction.commit().await?;
    Ok(Some(id))
}

async fn update_node(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    dialogue_node_id: Uuid,
    form: &NpcDialogueNodeForm,
) -> Result<bool, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(activity) = lock_activity(&mut transaction, principal, activity_id).await? else {
        return Ok(false);
    };
    let existing: Option<(String, Value)> = sqlx::query_as("SELECT node_type, node_config FROM learning_npc_dialogue_nodes WHERE id = $1 AND activity_id = $2 FOR UPDATE").bind(dialogue_node_id).bind(activity_id).fetch_optional(&mut *transaction).await?;
    let Some((existing_type, existing_config)) = existing else {
        return Ok(false);
    };
    validate_node_config(&mut transaction, activity.map_id, form).await?;
    record_activity_version(&mut transaction, activity_id, principal).await?;
    if existing_type == "end" && form.node_type != NpcDialogueNodeType::End {
        sqlx::query(
            "DELETE FROM learning_activity_transitions WHERE from_activity_id = $1 AND from_connector = $2",
        )
        .bind(activity_id)
        .bind(format!("dialogue-end-{dialogue_node_id}"))
        .execute(&mut *transaction)
        .await?;
    }
    let end_index: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM learning_npc_dialogue_nodes WHERE activity_id = $1 AND node_type = 'end' AND id < $2").bind(activity_id).bind(dialogue_node_id).fetch_one(&mut *transaction).await?;
    let config = normalized_config(form, end_index as usize, Some(existing_config));
    sqlx::query("UPDATE learning_npc_dialogue_nodes SET node_type = $3, title = $4, body = $5, node_config = $6, graph_position_x = $7, graph_position_y = $8, updated_at = NOW() WHERE id = $1 AND activity_id = $2")
        .bind(dialogue_node_id).bind(activity_id).bind(form.node_type.as_str()).bind(&form.title).bind(&form.body).bind(config).bind(form.position.as_ref().map(|position| position.x)).bind(form.position.as_ref().map(|position| position.y)).execute(&mut *transaction).await?;
    touch_activity(&mut transaction, activity_id).await?;
    synchronize_media_references(&mut transaction, activity_id).await?;
    transaction.commit().await?;
    Ok(true)
}

async fn delete_node(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    dialogue_node_id: Uuid,
) -> Result<bool, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(_activity) = lock_activity(&mut transaction, principal, activity_id).await? else {
        return Ok(false);
    };
    let kind: Option<String> = sqlx::query_scalar("SELECT node_type FROM learning_npc_dialogue_nodes WHERE id = $1 AND activity_id = $2 FOR UPDATE").bind(dialogue_node_id).bind(activity_id).fetch_optional(&mut *transaction).await?;
    let Some(kind) = kind else {
        return Ok(false);
    };
    record_activity_version(&mut transaction, activity_id, principal).await?;
    if kind == "end" {
        sqlx::query("DELETE FROM learning_activity_transitions WHERE from_activity_id = $1 AND from_connector = $2").bind(activity_id).bind(format!("dialogue-end-{dialogue_node_id}")).execute(&mut *transaction).await?;
    }
    sqlx::query("DELETE FROM learning_npc_dialogue_nodes WHERE id = $1 AND activity_id = $2")
        .bind(dialogue_node_id)
        .bind(activity_id)
        .execute(&mut *transaction)
        .await?;
    touch_activity(&mut transaction, activity_id).await?;
    synchronize_media_references(&mut transaction, activity_id).await?;
    transaction.commit().await?;
    Ok(true)
}

async fn create_transition(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    form: &NpcDialogueTransitionForm,
) -> Result<Option<Uuid>, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(_activity) = lock_activity(&mut transaction, principal, activity_id).await? else {
        return Ok(None);
    };
    if !valid_transition_nodes(&mut transaction, activity_id, form).await? {
        return Err(MutationError::Invalid);
    }
    if let Some(id) = sqlx::query_scalar::<_, Uuid>("SELECT id FROM learning_npc_dialogue_transitions WHERE activity_id = $1 AND from_node_id IS NOT DISTINCT FROM $2 AND to_node_id = $3 AND from_connector = $4 AND to_connector IS NOT DISTINCT FROM $5").bind(activity_id).bind(form.from_node_id).bind(form.to_node_id).bind(&form.from_connector).bind(&form.to_connector).fetch_optional(&mut *transaction).await? { transaction.commit().await?; return Ok(Some(id)); }
    let occupied: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_npc_dialogue_transitions WHERE activity_id = $1 AND from_node_id IS NOT DISTINCT FROM $2 AND from_connector = $3)").bind(activity_id).bind(form.from_node_id).bind(&form.from_connector).fetch_one(&mut *transaction).await?;
    if occupied {
        return Err(MutationError::Conflict);
    }
    record_activity_version(&mut transaction, activity_id, principal).await?;
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO learning_npc_dialogue_transitions (id, activity_id, from_node_id, to_node_id, from_connector, to_connector) VALUES ($1, $2, $3, $4, $5, $6)").bind(id).bind(activity_id).bind(form.from_node_id).bind(form.to_node_id).bind(&form.from_connector).bind(&form.to_connector).execute(&mut *transaction).await?;
    touch_activity(&mut transaction, activity_id).await?;
    transaction.commit().await?;
    Ok(Some(id))
}

async fn delete_transition(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    transition_id: Uuid,
) -> Result<bool, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(_activity) = lock_activity(&mut transaction, principal, activity_id).await? else {
        return Ok(false);
    };
    let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_npc_dialogue_transitions WHERE id = $1 AND activity_id = $2 FOR UPDATE)").bind(transition_id).bind(activity_id).fetch_one(&mut *transaction).await?;
    if !exists {
        return Ok(false);
    }
    record_activity_version(&mut transaction, activity_id, principal).await?;
    sqlx::query("DELETE FROM learning_npc_dialogue_transitions WHERE id = $1 AND activity_id = $2")
        .bind(transition_id)
        .bind(activity_id)
        .execute(&mut *transaction)
        .await?;
    touch_activity(&mut transaction, activity_id).await?;
    transaction.commit().await?;
    Ok(true)
}

async fn update_layout(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    position: NpcDialoguePosition,
) -> Result<bool, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(_activity) = lock_activity(&mut transaction, principal, activity_id).await? else {
        return Ok(false);
    };
    record_activity_version(&mut transaction, activity_id, principal).await?;
    sqlx::query("UPDATE learning_activities SET activity_config = jsonb_set(activity_config, '{dialogueGraphLayout,start}', jsonb_build_object('x', $2::double precision, 'y', $3::double precision), true), updated_at = NOW() WHERE id = $1").bind(activity_id).bind(position.x).bind(position.y).execute(&mut *transaction).await?;
    transaction.commit().await?;
    Ok(true)
}

async fn lock_editable_node(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
) -> Result<Option<ScopedNode>, sqlx::Error> {
    let Some(principal_id) = application_principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let node = sqlx::query_as::<_, ScopedNode>("SELECT nodes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE nodes.id = $1 FOR UPDATE OF nodes").bind(node_id).fetch_optional(&mut **transaction).await?;
    let Some(node) = node else {
        return Ok(None);
    };
    Ok(can_edit(
        transaction,
        principal,
        principal_id,
        node.map_id,
        node.map_creator_id,
    )
    .await?
    .then_some(node))
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
        "SELECT routes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 AND activities.activity_type = 'npc_dialogue' FOR UPDATE OF activities, nodes"
    } else {
        "SELECT routes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 AND activities.activity_type = 'npc_dialogue'"
    };
    let activity = sqlx::query_as::<_, ScopedActivity>(query)
        .bind(activity_id)
        .fetch_optional(&mut **transaction)
        .await?;
    let Some(activity) = activity else {
        return Ok(None);
    };
    Ok(can_edit(
        transaction,
        principal,
        principal_id,
        activity.map_id,
        activity.map_creator_id,
    )
    .await?
    .then_some(activity))
}

async fn lock_activity(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
) -> Result<Option<ScopedActivity>, sqlx::Error> {
    scoped_activity(transaction, principal, activity_id, true).await
}

async fn can_edit(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    creator: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let direct_editor: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)").bind(map_id).bind(principal_id).fetch_one(&mut **transaction).await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && creator == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_editor)
        || direct_editor)
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

async fn unique_slug(
    transaction: &mut Transaction<'_, Postgres>,
    map_asset_id: Uuid,
    form: &NpcDialogueActivityForm,
    excluded: Option<Uuid>,
) -> Result<String, MutationError> {
    let base = form
        .slug
        .clone()
        .unwrap_or_else(|| generated_slug(&form.title));
    for suffix in 0..1000 {
        let candidate = if suffix == 0 {
            base.clone()
        } else {
            format!("{base}-{suffix}")
        };
        let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE routes.map_asset_id = $1 AND activities.slug = $2 AND ($3::uuid IS NULL OR activities.id <> $3))").bind(map_asset_id).bind(&candidate).bind(excluded).fetch_one(&mut **transaction).await?;
        if !exists {
            return Ok(candidate);
        }
    }
    Err(MutationError::Conflict)
}

async fn validate_node_config(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    form: &NpcDialogueNodeForm,
) -> Result<(), MutationError> {
    if let Some(tool_slug) = form
        .config
        .get("toolId")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
    {
        let exists: bool =
            sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_tools WHERE slug = $1)")
                .bind(tool_slug)
                .fetch_one(&mut **transaction)
                .await?;
        if !exists {
            return Err(MutationError::Invalid);
        }
    }
    if let Some(sound_set_id) = form
        .config
        .get("typingSoundSetId")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
    {
        let Ok(sound_set_id) = Uuid::parse_str(sound_set_id) else {
            return Err(MutationError::Invalid);
        };
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM learning_dialogue_typing_sound_sets WHERE id = $1)",
        )
        .bind(sound_set_id)
        .fetch_one(&mut **transaction)
        .await?;
        if !exists {
            return Err(MutationError::Invalid);
        }
    }
    for event_key in ["hideNodeIds", "unlockNodeIds"] {
        for node_id in form
            .config
            .get("events")
            .and_then(Value::as_object)
            .and_then(|events| events.get(event_key))
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            let Some(node_id) = node_id
                .as_str()
                .and_then(|value| Uuid::parse_str(value).ok())
            else {
                return Err(MutationError::Invalid);
            };
            let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE nodes.id = $1 AND maps.world_id = (SELECT world_id FROM learning_maps WHERE id = $2))").bind(node_id).bind(map_id).fetch_one(&mut **transaction).await?;
            if !exists {
                return Err(MutationError::Invalid);
            }
        }
    }
    Ok(())
}

fn normalized_config(
    form: &NpcDialogueNodeForm,
    end_index: usize,
    existing: Option<Value>,
) -> Value {
    let mut config = defaults(form.node_type, end_index);
    if let Some(existing) = existing.and_then(|value| value.as_object().cloned()) {
        config.extend(existing);
    }
    if let Some(incoming) = form.config.as_object() {
        config.extend(incoming.clone());
    }
    Value::Object(config)
}

fn defaults(node_type: NpcDialogueNodeType, end_index: usize) -> Map<String, Value> {
    match node_type {
        NpcDialogueNodeType::Answer => Map::from_iter([
            ("answerLabel".to_owned(), json!("")),
            ("isCorrect".to_owned(), json!(false)),
        ]),
        NpcDialogueNodeType::End => Map::from_iter([
            (
                "connectorColor".to_owned(),
                json!(
                    [
                        "#0ea5e9", "#22c55e", "#f97316", "#a855f7", "#ef4444", "#14b8a6"
                    ][end_index % 6]
                ),
            ),
            (
                "connectorSymbol".to_owned(),
                json!(
                    char::from_u32(65 + (end_index % 26) as u32)
                        .unwrap_or('A')
                        .to_string()
                ),
            ),
        ]),
        _ => Map::from_iter([
            ("backgroundDark".to_owned(), json!("")),
            ("backgroundLight".to_owned(), json!("")),
            ("backgroundMirrored".to_owned(), json!(false)),
            ("sceneAssets".to_owned(), json!([])),
            ("npcImageDark".to_owned(), json!("")),
            ("npcImageLight".to_owned(), json!("")),
            ("npcImageMirrored".to_owned(), json!(false)),
            ("slideDirection".to_owned(), json!("left")),
            ("slideDurationSeconds".to_owned(), json!(0.6)),
            ("fadeDurationSeconds".to_owned(), json!(0.4)),
            ("npcX".to_owned(), json!(50)),
            ("npcY".to_owned(), json!(50)),
            ("toolId".to_owned(), Value::Null),
            ("questionOutputCount".to_owned(), json!(2)),
            ("journalTopic".to_owned(), json!("")),
            ("journalSubtopic".to_owned(), json!("")),
            ("typingSpeed".to_owned(), json!(28)),
            ("typingSoundEnabled".to_owned(), json!(false)),
            ("typingSoundSetId".to_owned(), Value::Null),
            ("bubbleColorDark".to_owned(), json!("#0f172a")),
            ("bubbleBorderColorDark".to_owned(), json!("#2dd4bf")),
            ("bubbleOpacityDark".to_owned(), json!(92)),
            ("bubbleColorLight".to_owned(), json!("#ffffff")),
            ("bubbleBorderColorLight".to_owned(), json!("#0891b2")),
            ("bubbleOpacityLight".to_owned(), json!(94)),
        ]),
    }
}

async fn valid_transition_nodes(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
    form: &NpcDialogueTransitionForm,
) -> Result<bool, sqlx::Error> {
    if form.to_connector != "in" {
        return Ok(false);
    }
    let destination: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_npc_dialogue_nodes WHERE activity_id = $1 AND id = $2)").bind(activity_id).bind(form.to_node_id).fetch_one(&mut **transaction).await?;
    if !destination {
        return Ok(false);
    }
    let Some(source) = form.from_node_id else {
        return Ok(form.from_connector == "out");
    };
    let source: Option<(String, Value)> = sqlx::query_as(
        "SELECT node_type, node_config FROM learning_npc_dialogue_nodes WHERE activity_id = $1 AND id = $2",
    )
    .bind(activity_id)
    .bind(source)
    .fetch_optional(&mut **transaction)
    .await?;
    let Some((node_type, config)) = source else {
        return Ok(false);
    };
    match node_type.as_str() {
        "npc_question" => {
            let valid_question_output = config
                .get("questionOutputCount")
                .and_then(Value::as_u64)
                .is_some_and(|count| {
                    (1..=12).contains(&count)
                        && form
                            .from_connector
                            .strip_prefix("answer-")
                            .and_then(|value| value.parse::<u64>().ok())
                            .is_some_and(|index| (1..=count).contains(&index))
                });
            Ok(valid_question_output)
        }
        "npc_monologue" | "reflection" | "answer" => Ok(form.from_connector == "out"),
        "end" => Ok(false),
        _ => Ok(false),
    }
}

async fn touch_activity(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE learning_activities SET ai_review_status = 'needs_review', ai_reviewed_at = NULL, ai_review = NULL, updated_at = NOW() WHERE id = $1").bind(activity_id).execute(&mut **transaction).await.map(|_| ())
}

fn reusable_media_id(value: Option<&str>) -> Option<Uuid> {
    Uuid::parse_str(
        value?
            .strip_prefix(MEDIA_ASSET_CONTENT_PREFIX)?
            .strip_suffix("/content")?,
    )
    .ok()
}
pub(crate) async fn synchronize_media_references(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM reusable_media_asset_references WHERE owner_kind = $1 AND owner_id = $2",
    )
    .bind(MEDIA_REFERENCE_KIND)
    .bind(activity_id)
    .execute(&mut **transaction)
    .await?;
    let nodes: Vec<(Uuid, Value)> = sqlx::query_as("SELECT id, node_config FROM learning_npc_dialogue_nodes WHERE activity_id = $1 ORDER BY id ASC").bind(activity_id).fetch_all(&mut **transaction).await?;
    let mut references = Vec::new();
    for (node_id, config) in nodes {
        let Some(object) = config.as_object() else {
            continue;
        };
        for key in [
            "backgroundDark",
            "backgroundLight",
            "npcImageDark",
            "npcImageLight",
        ] {
            if let Some(asset_id) = reusable_media_id(object.get(key).and_then(Value::as_str)) {
                references.push((asset_id, format!("dialogueNodes[{node_id}].{key}")));
            }
        }
        for (index, asset) in object
            .get("sceneAssets")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .enumerate()
        {
            for key in ["imageDark", "imageLight"] {
                if let Some(asset_id) = reusable_media_id(asset.get(key).and_then(Value::as_str)) {
                    references.push((
                        asset_id,
                        format!("dialogueNodes[{node_id}].sceneAssets[{index}].{key}"),
                    ));
                }
            }
        }
    }
    for (asset_id, field_key) in references.into_iter().take(MAX_MEDIA_REFERENCES) {
        sqlx::query("INSERT INTO reusable_media_asset_references (asset_id, owner_kind, owner_id, field_key) SELECT id, $2, $3, $4 FROM reusable_media_assets WHERE id = $1 ON CONFLICT DO NOTHING").bind(asset_id).bind(MEDIA_REFERENCE_KIND).bind(activity_id).bind(field_key).execute(&mut **transaction).await?;
    }
    Ok(())
}
