use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction, types::Json};
use uuid::Uuid;
use wicked_learning_application::{
    admin_world_map_layout::HexPosition,
    admin_world_node_write::{
        AdminWorldNodeWriteError, AdminWorldNodeWriteRepository as Port, CreatedWorldNode,
        WorldNodeForm, generated_node_slug,
    },
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

pub struct PostgresAdminWorldNodeWriteRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldNodeWriteRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldNodeWriteRepository<'_> {
    fn create_node(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &WorldNodeForm,
    ) -> impl std::future::Future<
        Output = Result<Option<CreatedWorldNode>, AdminWorldNodeWriteError>,
    > + Send {
        async move {
            create(self.pool, principal, map_id, form)
                .await
                .map_err(unavailable)
        }
    }

    fn insert_node(
        &self,
        principal: &AuthorizedPrincipal,
        origin_node_id: Uuid,
        direction: HexPosition,
        form: &WorldNodeForm,
    ) -> impl std::future::Future<
        Output = Result<Option<CreatedWorldNode>, AdminWorldNodeWriteError>,
    > + Send {
        async move {
            insert(self.pool, principal, origin_node_id, direction, form)
                .await
                .map_err(unavailable)
        }
    }

    fn update_node(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &WorldNodeForm,
    ) -> impl std::future::Future<Output = Result<bool, AdminWorldNodeWriteError>> + Send {
        async move {
            update(self.pool, principal, node_id, form)
                .await
                .map_err(unavailable)
        }
    }

    fn delete_node(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
    ) -> impl std::future::Future<Output = Result<bool, AdminWorldNodeWriteError>> + Send {
        async move {
            delete(self.pool, principal, node_id)
                .await
                .map_err(unavailable)
        }
    }
}

fn unavailable(error: sqlx::Error) -> AdminWorldNodeWriteError {
    tracing::error!(%error, "could not mutate scoped World Builder node");
    AdminWorldNodeWriteError::Unavailable
}

#[derive(FromRow)]
struct ScopedMap {
    creator_id: Option<Uuid>,
}

#[derive(FromRow)]
struct Node {
    id: Uuid,
    map_id: Uuid,
    map_asset_id: Option<Uuid>,
    q: i32,
    r: i32,
    visual_config: Value,
}

async fn create(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_id: Uuid,
    form: &WorldNodeForm,
) -> Result<Option<CreatedWorldNode>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut transaction, principal).await? else {
        return Ok(None);
    };
    let Some(map) = scoped_map(&mut transaction, map_id).await? else {
        return Ok(None);
    };
    if !allowed(
        &mut transaction,
        principal,
        principal_id,
        map_id,
        map.creator_id,
        "world_nodes",
        "ru",
        true,
    )
    .await?
        || occupied(&mut transaction, map_id, form.position, None).await?
    {
        return Ok(None);
    }
    let Some(created) = create_records(&mut transaction, map_id, form, form.position).await? else {
        return Ok(None);
    };
    transaction.commit().await?;
    Ok(Some(created))
}

async fn insert(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    origin_node_id: Uuid,
    direction: HexPosition,
    form: &WorldNodeForm,
) -> Result<Option<CreatedWorldNode>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut transaction, principal).await? else {
        return Ok(None);
    };
    let origin = sqlx::query_as::<_, Node>(
        "SELECT id, map_id, map_asset_id, position_q AS q, position_r AS r, visual_config FROM learning_nodes WHERE id = $1 FOR UPDATE",
    )
    .bind(origin_node_id)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(origin) = origin else {
        return Ok(None);
    };
    let Some(map) = scoped_map(&mut transaction, origin.map_id).await? else {
        return Ok(None);
    };
    if !allowed(
        &mut transaction,
        principal,
        principal_id,
        origin.map_id,
        map.creator_id,
        "world_maps",
        "ru",
        true,
    )
    .await?
    {
        return Ok(None);
    }
    let nodes = map_nodes(&mut transaction, origin.map_id, true).await?;
    let insert_position = HexPosition {
        q: origin.q.checked_add(direction.q).ok_or_else(overflow)?,
        r: origin.r.checked_add(direction.r).ok_or_else(overflow)?,
    };
    let mut chain = vec![];
    let mut current = insert_position;
    while let Some(node) = nodes
        .iter()
        .find(|node| node.q == current.q && node.r == current.r)
    {
        chain.push(node);
        current = HexPosition {
            q: current.q.checked_add(direction.q).ok_or_else(overflow)?,
            r: current.r.checked_add(direction.r).ok_or_else(overflow)?,
        };
    }
    if chain.is_empty() {
        return Ok(None);
    }
    for node in chain.into_iter().rev() {
        sqlx::query("UPDATE learning_nodes SET position_q = $2, position_r = $3, updated_at = NOW() WHERE id = $1")
            .bind(node.id)
            .bind(node.q.checked_add(direction.q).ok_or_else(overflow)?)
            .bind(node.r.checked_add(direction.r).ok_or_else(overflow)?)
            .execute(&mut *transaction)
            .await?;
    }
    let Some(created) =
        create_records(&mut transaction, origin.map_id, form, insert_position).await?
    else {
        return Ok(None);
    };
    transaction.commit().await?;
    Ok(Some(created))
}

async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    form: &WorldNodeForm,
) -> Result<bool, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut transaction, principal).await? else {
        return Ok(false);
    };
    let node = sqlx::query_as::<_, Node>(
        "SELECT id, map_id, map_asset_id, position_q AS q, position_r AS r, visual_config FROM learning_nodes WHERE id = $1 FOR UPDATE",
    )
    .bind(node_id)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(node) = node else {
        return Ok(false);
    };
    let Some(map) = scoped_map(&mut transaction, node.map_id).await? else {
        return Ok(false);
    };
    if !allowed(
        &mut transaction,
        principal,
        principal_id,
        node.map_id,
        map.creator_id,
        "world_maps",
        "ru",
        true,
    )
    .await?
    {
        return Ok(false);
    }
    let nodes = map_nodes(&mut transaction, node.map_id, true).await?;
    let position_changed = node.q != form.position.q || node.r != form.position.r;
    if position_changed
        && occupied(&mut transaction, node.map_id, form.position, Some(node.id)).await?
    {
        return Ok(false);
    }
    if position_changed {
        snapshot(&mut transaction, node.map_id, principal_id, &nodes).await?;
    }
    let Some(slug) = usable_slug(&mut transaction, node.map_id, form, Some(node.id)).await? else {
        return Ok(false);
    };
    sqlx::query("UPDATE learning_nodes SET slug = $2, title = $3, description = $4, position_q = $5, position_r = $6, state = $7, visual_config = $8, updated_at = NOW() WHERE id = $1")
        .bind(node.id)
        .bind(slug)
        .bind(&form.title)
        .bind(&form.description)
        .bind(form.position.q)
        .bind(form.position.r)
        .bind(&form.state)
        .bind(Json(&form.visual_config))
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(true)
}

async fn delete(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut transaction, principal).await? else {
        return Ok(false);
    };
    let node = sqlx::query_as::<_, Node>(
        "SELECT id, map_id, map_asset_id, position_q AS q, position_r AS r, visual_config FROM learning_nodes WHERE id = $1 FOR UPDATE",
    )
    .bind(node_id)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(node) = node else {
        return Ok(false);
    };
    let Some(map) = scoped_map(&mut transaction, node.map_id).await? else {
        return Ok(false);
    };
    if !allowed(
        &mut transaction,
        principal,
        principal_id,
        node.map_id,
        map.creator_id,
        "world_nodes",
        "rud",
        false,
    )
    .await?
    {
        return Ok(false);
    }
    remove_unlock_references(&mut transaction, node.map_id, node.id).await?;
    if let Some(asset_id) = node.map_asset_id {
        sqlx::query("DELETE FROM learning_activity_transitions WHERE to_activity_id IN (SELECT activities.id FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE routes.map_asset_id = $1)")
            .bind(asset_id)
            .execute(&mut *transaction)
            .await?;
        sqlx::query("DELETE FROM reusable_media_asset_references WHERE owner_kind = 'map_asset' AND owner_id = $1")
            .bind(asset_id)
            .execute(&mut *transaction)
            .await?;
        sqlx::query("DELETE FROM learning_map_assets WHERE id = $1")
            .bind(asset_id)
            .execute(&mut *transaction)
            .await?;
    }
    sqlx::query("DELETE FROM learning_nodes WHERE id = $1")
        .bind(node.id)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(true)
}

async fn create_records(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    form: &WorldNodeForm,
    position: HexPosition,
) -> Result<Option<CreatedWorldNode>, sqlx::Error> {
    let Some(node_slug) = usable_slug(transaction, map_id, form, None).await? else {
        return Ok(None);
    };
    let asset_slug = unique_slug(
        transaction,
        map_id,
        &node_slug,
        "learning_map_assets",
        false,
    )
    .await?
    .ok_or_else(|| sqlx::Error::Protocol("could not create a MapAsset slug".into()))?;
    let node_id = Uuid::new_v4();
    let asset_id = Uuid::new_v4();
    let route_id = Uuid::new_v4();
    sqlx::query("INSERT INTO learning_map_assets (id, map_id, slug, title, description, image_url, text, position_x, position_y, position_z, interaction_mode, published_at, width, opacity, locked, visual_config, interaction_config, sound_config) VALUES ($1, $2, $3, $4, $5, NULL, NULL, 50, 50, 0, 'focusable', NULL, 14, 1, false, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)")
        .bind(asset_id)
        .bind(map_id)
        .bind(asset_slug)
        .bind(&form.title)
        .bind(&form.description)
        .execute(&mut **transaction)
        .await?;
    sqlx::query("INSERT INTO learning_nodes (id, map_id, map_asset_id, slug, title, description, position_q, position_r, state, visual_config, published_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL)")
        .bind(node_id)
        .bind(map_id)
        .bind(asset_id)
        .bind(node_slug)
        .bind(&form.title)
        .bind(&form.description)
        .bind(position.q)
        .bind(position.r)
        .bind(&form.state)
        .bind(Json(&form.visual_config))
        .execute(&mut **transaction)
        .await?;
    sqlx::query("INSERT INTO learning_routes (id, map_asset_id, slug, title, description, position, published_at) VALUES ($1, $2, 'map-asset', $3, $4, 0, NULL)")
        .bind(route_id)
        .bind(asset_id)
        .bind(&form.title)
        .bind(&form.description)
        .execute(&mut **transaction)
        .await?;
    Ok(Some(CreatedWorldNode { node_id, asset_id }))
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

async fn scoped_map(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
) -> Result<Option<ScopedMap>, sqlx::Error> {
    sqlx::query_as(
        "SELECT created_by_principal_id AS creator_id FROM learning_maps WHERE id = $1 FOR UPDATE",
    )
    .bind(map_id)
    .fetch_optional(&mut **transaction)
    .await
}

#[allow(clippy::too_many_arguments)]
async fn allowed(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    creator_id: Option<Uuid>,
    resource: &str,
    access: &str,
    allow_direct_editor: bool,
) -> Result<bool, sqlx::Error> {
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)")
        .bind(map_id)
        .bind(principal_id)
        .fetch_one(&mut **transaction)
        .await?;
    let Some(scope) = principal.permission_scope(resource, access) else {
        return Ok(allow_direct_editor && direct);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct)
        || (allow_direct_editor && direct))
}

async fn map_nodes(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    lock: bool,
) -> Result<Vec<Node>, sqlx::Error> {
    let suffix = if lock { " FOR UPDATE" } else { "" };
    sqlx::query_as(&format!("SELECT id, map_id, map_asset_id, position_q AS q, position_r AS r, visual_config FROM learning_nodes WHERE map_id = $1 ORDER BY id{suffix}"))
        .bind(map_id)
        .fetch_all(&mut **transaction)
        .await
}

async fn occupied(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    position: HexPosition,
    excluding: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_nodes WHERE map_id = $1 AND position_q = $2 AND position_r = $3 AND ($4::uuid IS NULL OR id != $4))")
        .bind(map_id)
        .bind(position.q)
        .bind(position.r)
        .bind(excluding)
        .fetch_one(&mut **transaction)
        .await
}

async fn usable_slug(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    form: &WorldNodeForm,
    excluding: Option<Uuid>,
) -> Result<Option<String>, sqlx::Error> {
    let base = form
        .slug
        .clone()
        .unwrap_or_else(|| generated_node_slug(&form.title));
    if form.slug.is_some() {
        let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_nodes WHERE map_id = $1 AND slug = $2 AND ($3::uuid IS NULL OR id != $3))")
            .bind(map_id)
            .bind(&base)
            .bind(excluding)
            .fetch_one(&mut **transaction)
            .await?;
        return Ok((!exists).then_some(base));
    }
    unique_slug(transaction, map_id, &base, "learning_nodes", false).await
}

async fn unique_slug(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    base: &str,
    table: &str,
    explicit: bool,
) -> Result<Option<String>, sqlx::Error> {
    for suffix in 1..10_000 {
        let candidate = if suffix == 1 {
            base.to_owned()
        } else {
            format!("{base}-{suffix}")
        };
        if candidate.chars().count() > 140 {
            return Ok(None);
        }
        let exists: bool = match table {
            "learning_map_assets" => sqlx::query_scalar(
                "SELECT EXISTS (SELECT 1 FROM learning_map_assets WHERE map_id = $1 AND slug = $2)",
            )
            .bind(map_id)
            .bind(&candidate)
            .fetch_one(&mut **transaction)
            .await?,
            _ => {
                sqlx::query_scalar(
                    "SELECT EXISTS (SELECT 1 FROM learning_nodes WHERE map_id = $1 AND slug = $2)",
                )
                .bind(map_id)
                .bind(&candidate)
                .fetch_one(&mut **transaction)
                .await?
            }
        };
        if !exists {
            return Ok(Some(candidate));
        }
        if explicit {
            return Ok(None);
        }
    }
    Ok(None)
}

async fn snapshot(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    principal_id: Uuid,
    nodes: &[Node],
) -> Result<(), sqlx::Error> {
    let values = Value::Array(
        nodes
            .iter()
            .map(|node| json!({"nodeId": node.id, "positionQ": node.q, "positionR": node.r}))
            .collect(),
    );
    sqlx::query("INSERT INTO learning_map_layout_versions (id, map_id, changed_by_principal_id, snapshot) VALUES ($1, $2, $3, $4)")
        .bind(Uuid::new_v4())
        .bind(map_id)
        .bind(principal_id)
        .bind(values)
        .execute(&mut **transaction)
        .await?;
    Ok(())
}

async fn remove_unlock_references(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    deleted_node_id: Uuid,
) -> Result<(), sqlx::Error> {
    let deleted_node_id = deleted_node_id.to_string();
    for node in map_nodes(transaction, map_id, true).await? {
        let cleaned = remove_node_reference(node.visual_config.clone(), &deleted_node_id);
        if cleaned != node.visual_config {
            sqlx::query(
                "UPDATE learning_nodes SET visual_config = $2, updated_at = NOW() WHERE id = $1",
            )
            .bind(node.id)
            .bind(cleaned)
            .execute(&mut **transaction)
            .await?;
        }
    }
    Ok(())
}

fn remove_node_reference(mut visual_config: Value, deleted_node_id: &str) -> Value {
    let Some(config) = visual_config.as_object_mut() else {
        return visual_config;
    };
    if let Some(unlock) = config.get_mut("unlock").and_then(Value::as_object_mut) {
        if let Some(required) = unlock
            .get_mut("requiredNodeIds")
            .and_then(Value::as_array_mut)
        {
            required.retain(|node_id| node_id.as_str() != Some(deleted_node_id));
        }
        if let Some(rules) = unlock.get_mut("rules") {
            if let Some(next) = remove_rule_reference(rules.clone(), deleted_node_id) {
                *rules = next;
            } else {
                *rules = Value::Array(vec![]);
            }
        }
    }
    for theme in ["dark", "light"] {
        if let Some(value) = config.get_mut(theme) {
            *value = remove_node_reference(value.clone(), deleted_node_id);
        }
    }
    visual_config
}

fn remove_rule_reference(mut rule: Value, deleted_node_id: &str) -> Option<Value> {
    let object = rule.as_object_mut()?;
    if object.get("type").and_then(Value::as_str) == Some("node_completed")
        && object.get("nodeId").and_then(Value::as_str) == Some(deleted_node_id)
    {
        return None;
    }
    if let Some(children) = object.get_mut("rules").and_then(Value::as_array_mut) {
        *children = children
            .drain(..)
            .filter_map(|child| remove_rule_reference(child, deleted_node_id))
            .collect();
    }
    Some(rule)
}

fn overflow() -> sqlx::Error {
    sqlx::Error::Protocol("hex node position overflow".into())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::remove_node_reference;

    #[test]
    fn deletion_removes_direct_and_nested_completed_node_references() {
        let removed = "00000000-0000-4000-8000-000000000001";
        let config = remove_node_reference(
            json!({"unlock": {"requiredNodeIds": [removed, "other"], "rules": {"type": "group", "operator": "and", "rules": [{"type": "node_completed", "nodeId": removed}, {"type": "node_completed", "nodeId": "other"}]}}}),
            removed,
        );
        assert_eq!(config["unlock"]["requiredNodeIds"], json!(["other"]));
        assert_eq!(
            config["unlock"]["rules"]["rules"],
            json!([{"type": "node_completed", "nodeId": "other"}])
        );
    }
}
