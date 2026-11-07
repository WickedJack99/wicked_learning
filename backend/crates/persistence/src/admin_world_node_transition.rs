use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_world_node_transition::{
    AdminWorldNodeTransitionError, AdminWorldNodeTransitionRepository as Port,
    CreateActivityTransition, fallback_output_label, trigger_for_connector,
};
use wicked_learning_domain::{
    identity_access::{AuthorizedPrincipal, permission_scope_allows},
    world_content::AdminActivityTransition,
};

pub struct PostgresAdminWorldNodeTransitionRepository<'pool> {
    pool: &'pool PgPool,
}
impl<'pool> PostgresAdminWorldNodeTransitionRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldNodeTransitionRepository<'_> {
    fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &CreateActivityTransition,
    ) -> impl std::future::Future<
        Output = Result<Option<Vec<AdminActivityTransition>>, AdminWorldNodeTransitionError>,
    > + Send {
        async move {
            match create(self.pool, principal, node_id, form).await {
                Ok(value) => Ok(value),
                Err(CreateError::Invalid) => Err(AdminWorldNodeTransitionError::InvalidTransition),
                Err(CreateError::Sql(error)) => {
                    tracing::error!(%error, "could not create scoped World Builder transition");
                    Err(AdminWorldNodeTransitionError::Unavailable)
                }
            }
        }
    }
}

#[derive(FromRow)]
struct Node {
    map_asset_id: Option<Uuid>,
    map_id: Uuid,
    creator: Option<Uuid>,
}
#[derive(FromRow)]
struct Activity {
    id: Uuid,
    activity_type: String,
    title: String,
    config: Value,
}
#[derive(FromRow)]
struct Edge {
    id: Uuid,
    from_activity_id: Uuid,
    to_activity_id: Option<Uuid>,
    from_connector: String,
    to_connector: Option<String>,
    trigger: String,
    trigger_value: Option<String>,
    label: Option<String>,
}
enum CreateError {
    Invalid,
    Sql(sqlx::Error),
}
impl From<sqlx::Error> for CreateError {
    fn from(value: sqlx::Error) -> Self {
        Self::Sql(value)
    }
}

async fn create(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    form: &CreateActivityTransition,
) -> Result<Option<Vec<AdminActivityTransition>>, CreateError> {
    let mut tx = pool.begin().await?;
    let Some(node) = lock_node(&mut tx, principal, node_id).await? else {
        return Ok(None);
    };
    let Some(from) = activity(&mut tx, node.map_asset_id, form.from_activity_id).await? else {
        return Ok(None);
    };
    let target = match form.to_activity_id {
        Some(id) => match activity(&mut tx, node.map_asset_id, id).await? {
            Some(value) => Some(value),
            None => return Ok(None),
        },
        None => None,
    };
    if from.activity_type == "portal"
        && from
            .config
            .get("portalMode")
            .and_then(Value::as_str)
            .unwrap_or("output")
            == "output"
        && target.is_some()
    {
        return Err(CreateError::Invalid);
    }
    let label = form
        .label
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .or_else(|| target.as_ref().map(|value| value.title.clone()))
        .unwrap_or_else(|| fallback_output_label(&form.from_connector));
    let trigger = trigger_for_connector(&form.from_connector);
    sqlx::query("INSERT INTO learning_activity_transitions (from_activity_id, to_activity_id, from_connector, to_connector, trigger, label) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (from_activity_id, to_activity_id, from_connector, to_connector) DO NOTHING")
        .bind(from.id).bind(target.as_ref().map(|value| value.id)).bind(&form.from_connector).bind(&form.to_connector).bind(trigger).bind(label).execute(&mut *tx).await?;
    let result = edges(&mut tx, node.map_asset_id).await?;
    tx.commit().await?;
    Ok(Some(result))
}

async fn lock_node(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
) -> Result<Option<Node>, sqlx::Error> {
    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut **tx)
    .await?
    else {
        return Ok(None);
    };
    let Some(node) = sqlx::query_as::<_, Node>("SELECT nodes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS creator FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE nodes.id = $1 FOR UPDATE OF nodes").bind(node_id).fetch_optional(&mut **tx).await? else { return Ok(None); };
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)").bind(node.map_id).bind(principal_id).fetch_one(&mut **tx).await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(None);
    };
    let allowed = scope == "all"
        || (permission_scope_allows(scope, "own") && node.creator == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct)
        || direct;
    Ok(allowed.then_some(node))
}

async fn activity(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    map_asset_id: Option<Uuid>,
    id: Uuid,
) -> Result<Option<Activity>, sqlx::Error> {
    sqlx::query_as("SELECT activities.id, activities.activity_type, activities.title, activities.activity_config AS config FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE activities.id = $1 AND routes.map_asset_id = $2").bind(id).bind(map_asset_id).fetch_optional(&mut **tx).await
}

async fn edges(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    map_asset_id: Option<Uuid>,
) -> Result<Vec<AdminActivityTransition>, sqlx::Error> {
    let rows: Vec<Edge> = sqlx::query_as("SELECT transitions.id, transitions.from_activity_id, transitions.to_activity_id, transitions.from_connector, transitions.to_connector, transitions.trigger, transitions.trigger_value, transitions.label FROM learning_activity_transitions AS transitions INNER JOIN learning_activities AS activities ON activities.id = transitions.from_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE routes.map_asset_id = $1 ORDER BY transitions.created_at ASC, transitions.id ASC").bind(map_asset_id).fetch_all(&mut **tx).await?;
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
