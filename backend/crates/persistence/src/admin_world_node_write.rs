use std::collections::{HashMap, HashSet};

use serde_json::{Map, Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction, types::Json};
use time::{OffsetDateTime, PrimitiveDateTime, UtcOffset, format_description::well_known::Rfc3339};
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
                .map_err(write_error)
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
                .map_err(write_error)
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
                .map_err(write_error)
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
                .map_err(write_error)
        }
    }
}

#[derive(Debug)]
enum WriteFailure {
    Invalid,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for WriteFailure {
    fn from(error: sqlx::Error) -> Self {
        Self::Database(error)
    }
}

fn write_error(error: WriteFailure) -> AdminWorldNodeWriteError {
    match error {
        WriteFailure::Invalid => AdminWorldNodeWriteError::Invalid,
        WriteFailure::Database(error) => {
            tracing::error!(%error, "could not mutate scoped World Builder node");
            AdminWorldNodeWriteError::Unavailable
        }
    }
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
) -> Result<Option<CreatedWorldNode>, WriteFailure> {
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
    {
        return Ok(None);
    }
    let form = normalize_form(&mut transaction, form, None).await?;
    if occupied(&mut transaction, map_id, form.position, None).await? {
        return Ok(None);
    }
    let Some(created) = create_records(&mut transaction, map_id, &form, form.position).await?
    else {
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
) -> Result<Option<CreatedWorldNode>, WriteFailure> {
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
    let form = normalize_form(&mut transaction, form, None).await?;
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
        create_records(&mut transaction, origin.map_id, &form, insert_position).await?
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
) -> Result<bool, WriteFailure> {
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
    let form = normalize_form(&mut transaction, form, Some(node.id)).await?;
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
    let Some(slug) = usable_slug(&mut transaction, node.map_id, &form, Some(node.id)).await? else {
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
) -> Result<bool, WriteFailure> {
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

async fn normalize_form(
    transaction: &mut Transaction<'_, Postgres>,
    form: &WorldNodeForm,
    current_node_id: Option<Uuid>,
) -> Result<WorldNodeForm, WriteFailure> {
    let mut normalized = form.clone();
    normalize_schedule(&mut normalized.visual_config)?;
    normalize_catalog_reference(
        transaction,
        &mut normalized.visual_config,
        &["reveal", "toolId"],
        Catalog::Tool,
    )
    .await?;
    normalize_catalog_reference(
        transaction,
        &mut normalized.visual_config,
        &["unlock", "tool", "toolId"],
        Catalog::Tool,
    )
    .await?;
    normalize_catalog_reference(
        transaction,
        &mut normalized.visual_config,
        &["unlock", "item", "itemId"],
        Catalog::Item,
    )
    .await?;
    normalize_rule_catalog_references(transaction, &mut normalized.visual_config).await?;
    validate_unlock_configuration(transaction, &normalized, current_node_id).await?;
    Ok(normalized)
}

#[derive(Clone, Copy)]
enum Catalog {
    Item,
    Tool,
}

async fn normalize_catalog_reference(
    transaction: &mut Transaction<'_, Postgres>,
    config: &mut Value,
    path: &[&str],
    catalog: Catalog,
) -> Result<(), WriteFailure> {
    let Some(reference) = string_at(config, path) else {
        return Ok(());
    };
    let slug = catalog_slug(transaction, catalog, &reference)
        .await?
        .ok_or(WriteFailure::Invalid)?;
    set_string_at(config, path, slug).ok_or(WriteFailure::Invalid)
}

async fn catalog_slug(
    transaction: &mut Transaction<'_, Postgres>,
    catalog: Catalog,
    reference: &str,
) -> Result<Option<String>, sqlx::Error> {
    let id = Uuid::parse_str(reference).ok();
    match catalog {
        Catalog::Item => {
            sqlx::query_scalar("SELECT slug FROM learning_items WHERE id = $1 OR slug = $2")
                .bind(id)
                .bind(reference)
                .fetch_optional(&mut **transaction)
                .await
        }
        Catalog::Tool => {
            sqlx::query_scalar("SELECT slug FROM learning_tools WHERE id = $1 OR slug = $2")
                .bind(id)
                .bind(reference)
                .fetch_optional(&mut **transaction)
                .await
        }
    }
}

async fn normalize_rule_catalog_references(
    transaction: &mut Transaction<'_, Postgres>,
    config: &mut Value,
) -> Result<(), WriteFailure> {
    let Some(rules) = value_at_mut(config, &["unlock", "rules"]) else {
        return Ok(());
    };
    normalize_rule_catalog_references_in_rule(transaction, rules).await
}

async fn normalize_rule_catalog_references_in_rule(
    transaction: &mut Transaction<'_, Postgres>,
    rule: &mut Value,
) -> Result<(), WriteFailure> {
    let rule_type = rule
        .get("type")
        .and_then(Value::as_str)
        .ok_or(WriteFailure::Invalid)?
        .to_owned();
    if rule_type == "item_owned" {
        normalize_catalog_reference(transaction, rule, &["itemId"], Catalog::Item).await?;
    }
    if rule_type == "group" {
        let children = rule
            .get_mut("rules")
            .and_then(Value::as_array_mut)
            .ok_or(WriteFailure::Invalid)?;
        for child in children {
            Box::pin(normalize_rule_catalog_references_in_rule(
                transaction,
                child,
            ))
            .await?;
        }
    }
    Ok(())
}

fn normalize_schedule(config: &mut Value) -> Result<(), WriteFailure> {
    let mut instants = HashMap::new();
    for key in ["unlockAt", "lockAt"] {
        let Some(value) = string_at(config, &["schedule", key]) else {
            continue;
        };
        let instant = parse_author_timestamp(&value).ok_or(WriteFailure::Invalid)?;
        let canonical = instant
            .format(&Rfc3339)
            .map_err(|_| WriteFailure::Invalid)?;
        set_string_at(config, &["schedule", key], canonical).ok_or(WriteFailure::Invalid)?;
        instants.insert(key, instant);
    }
    if let (Some(unlock_at), Some(lock_at)) = (instants.get("unlockAt"), instants.get("lockAt"))
        && unlock_at >= lock_at
    {
        return Err(WriteFailure::Invalid);
    }
    Ok(())
}

fn parse_author_timestamp(value: &str) -> Option<OffsetDateTime> {
    OffsetDateTime::parse(value, &Rfc3339).ok().or_else(|| {
        let format =
            time::format_description::parse_borrowed::<2>("[year]-[month]-[day]T[hour]:[minute]")
                .ok()?;
        PrimitiveDateTime::parse(value, &format)
            .ok()
            .map(|value| value.assume_offset(UtcOffset::UTC))
    })
}

async fn validate_unlock_configuration(
    transaction: &mut Transaction<'_, Postgres>,
    form: &WorldNodeForm,
    current_node_id: Option<Uuid>,
) -> Result<(), WriteFailure> {
    let config = &form.visual_config;
    let unlock = object_at(config, &["unlock"]);
    let Some(unlock) = unlock else {
        return Ok(());
    };

    let mut node_references = node_references(unlock)?;
    if node_references
        .iter()
        .any(|id| Some(*id) == current_node_id)
    {
        return Err(WriteFailure::Invalid);
    }
    node_references.sort_unstable();
    node_references.dedup();
    if !node_references.is_empty() {
        let found: Vec<Uuid> =
            sqlx::query_scalar("SELECT id FROM learning_nodes WHERE id = ANY($1)")
                .bind(&node_references)
                .fetch_all(&mut **transaction)
                .await?;
        if found.len() != node_references.len() {
            return Err(WriteFailure::Invalid);
        }
    }

    validate_role(transaction, string_in(unlock, "roleSlug")).await?;
    if !enabled(unlock.get("enabled")) {
        return Ok(());
    }
    let tool_enabled = object_in(unlock, "tool").is_some_and(|tool| enabled(tool.get("enabled")));
    let item_enabled = object_in(unlock, "item").is_some_and(|item| enabled(item.get("enabled")));
    if (tool_enabled && string_at(config, &["unlock", "tool", "toolId"]).is_none())
        || (item_enabled && string_at(config, &["unlock", "item", "itemId"]).is_none())
    {
        return Err(WriteFailure::Invalid);
    }
    let has_schedule = string_at(config, &["schedule", "unlockAt"]).is_some();
    let has_role = string_in(unlock, "roleSlug").is_some();
    let has_rules = unlock.get("rules").is_some();
    if node_references.is_empty()
        && !has_rules
        && !tool_enabled
        && !item_enabled
        && !has_role
        && !has_schedule
    {
        return Err(WriteFailure::Invalid);
    }
    if let Some(rule) = unlock.get("rules") {
        validate_rule(
            rule,
            current_node_id,
            tool_enabled,
            item_enabled,
            has_schedule,
            transaction,
        )
        .await?;
    }
    if form.state == "locked" {
        let mandatory = unlock
            .get("rules")
            .map(mandatory_node_references)
            .transpose()?
            .unwrap_or_else(|| node_references.into_iter().collect());
        if let Some(node_id) = current_node_id {
            for prerequisite in mandatory {
                if node_has_mandatory_path_to(
                    transaction,
                    prerequisite,
                    node_id,
                    &mut HashMap::new(),
                    &mut HashSet::new(),
                )
                .await?
                {
                    return Err(WriteFailure::Invalid);
                }
            }
        }
    }
    Ok(())
}

async fn validate_role(
    transaction: &mut Transaction<'_, Postgres>,
    role: Option<String>,
) -> Result<(), WriteFailure> {
    let Some(role) = role else {
        return Ok(());
    };
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM application_roles WHERE role_key = $1)")
            .bind(role)
            .fetch_one(&mut **transaction)
            .await?;
    exists.then_some(()).ok_or(WriteFailure::Invalid)
}

async fn validate_rule(
    rule: &Value,
    current_node_id: Option<Uuid>,
    tool_enabled: bool,
    item_enabled: bool,
    has_schedule: bool,
    transaction: &mut Transaction<'_, Postgres>,
) -> Result<(), WriteFailure> {
    match rule.get("type").and_then(Value::as_str) {
        Some("group") => {
            let children = rule
                .get("rules")
                .and_then(Value::as_array)
                .ok_or(WriteFailure::Invalid)?;
            for child in children {
                Box::pin(validate_rule(
                    child,
                    current_node_id,
                    tool_enabled,
                    item_enabled,
                    has_schedule,
                    transaction,
                ))
                .await?;
            }
            Ok(())
        }
        Some("node_completed") => {
            let node_id = string_in(rule.as_object().ok_or(WriteFailure::Invalid)?, "nodeId")
                .and_then(|value| Uuid::parse_str(&value).ok())
                .ok_or(WriteFailure::Invalid)?;
            (Some(node_id) != current_node_id)
                .then_some(())
                .ok_or(WriteFailure::Invalid)
        }
        Some("tool_used") => tool_enabled.then_some(()).ok_or(WriteFailure::Invalid),
        Some("item_owned") => item_enabled.then_some(()).ok_or(WriteFailure::Invalid),
        Some("role_has") => {
            let role = string_in(rule.as_object().ok_or(WriteFailure::Invalid)?, "roleSlug")
                .ok_or(WriteFailure::Invalid)?;
            validate_role(transaction, Some(role)).await
        }
        Some("time_after") => has_schedule.then_some(()).ok_or(WriteFailure::Invalid),
        _ => Err(WriteFailure::Invalid),
    }
}

async fn node_has_mandatory_path_to(
    transaction: &mut Transaction<'_, Postgres>,
    node_id: Uuid,
    target_node_id: Uuid,
    cache: &mut HashMap<Uuid, Vec<Uuid>>,
    visited: &mut HashSet<Uuid>,
) -> Result<bool, WriteFailure> {
    if node_id == target_node_id {
        return Ok(true);
    }
    if !visited.insert(node_id) {
        return Ok(false);
    }
    let dependencies = if let Some(dependencies) = cache.get(&node_id) {
        dependencies.clone()
    } else {
        let node: Option<(String, Value)> =
            sqlx::query_as("SELECT state, visual_config FROM learning_nodes WHERE id = $1")
                .bind(node_id)
                .fetch_optional(&mut **transaction)
                .await?;
        let dependencies = node
            .filter(|(state, _)| state == "locked")
            .map(|(_, config)| mandatory_references_from_config(&config))
            .transpose()?
            .unwrap_or_default();
        cache.insert(node_id, dependencies.clone());
        dependencies
    };
    for dependency in dependencies {
        if Box::pin(node_has_mandatory_path_to(
            transaction,
            dependency,
            target_node_id,
            cache,
            visited,
        ))
        .await?
        {
            return Ok(true);
        }
    }
    Ok(false)
}

fn mandatory_references_from_config(config: &Value) -> Result<Vec<Uuid>, WriteFailure> {
    let Some(unlock) = object_at(config, &["unlock"]) else {
        return Ok(vec![]);
    };
    if !enabled(unlock.get("enabled")) {
        return Ok(vec![]);
    }
    if let Some(rules) = unlock.get("rules") {
        return Ok(mandatory_node_references(rules)?.into_iter().collect());
    }
    node_references(unlock)
}

fn mandatory_node_references(rule: &Value) -> Result<HashSet<Uuid>, WriteFailure> {
    match rule.get("type").and_then(Value::as_str) {
        Some("node_completed") => {
            let reference = rule
                .get("nodeId")
                .and_then(Value::as_str)
                .and_then(|value| Uuid::parse_str(value).ok())
                .ok_or(WriteFailure::Invalid)?;
            Ok(HashSet::from([reference]))
        }
        Some("group") => {
            let children = rule
                .get("rules")
                .and_then(Value::as_array)
                .ok_or(WriteFailure::Invalid)?;
            let mut children = children.iter().map(mandatory_node_references);
            let Some(first) = children.next() else {
                return Err(WriteFailure::Invalid);
            };
            let mut mandatory = first?;
            for child in children {
                let child = child?;
                if rule.get("operator").and_then(Value::as_str) == Some("or") {
                    mandatory.retain(|node| child.contains(node));
                } else {
                    mandatory.extend(child);
                }
            }
            Ok(mandatory)
        }
        Some("item_owned" | "role_has" | "time_after" | "tool_used") => Ok(HashSet::new()),
        _ => Err(WriteFailure::Invalid),
    }
}

fn node_references(unlock: &Map<String, Value>) -> Result<Vec<Uuid>, WriteFailure> {
    let mut references = unlock
        .get("requiredNodeIds")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .map(|value| {
            value
                .as_str()
                .and_then(|value| Uuid::parse_str(value).ok())
                .ok_or(WriteFailure::Invalid)
        })
        .collect::<Result<Vec<_>, _>>()?;
    if let Some(rule) = unlock.get("rules") {
        references.extend(rule_node_references(rule)?);
    }
    Ok(references)
}

fn rule_node_references(rule: &Value) -> Result<Vec<Uuid>, WriteFailure> {
    let mut references = Vec::new();
    match rule.get("type").and_then(Value::as_str) {
        Some("node_completed") => {
            let reference = rule
                .get("nodeId")
                .and_then(Value::as_str)
                .and_then(|value| Uuid::parse_str(value).ok())
                .ok_or(WriteFailure::Invalid)?;
            references.push(reference);
        }
        Some("group") => {
            for child in rule
                .get("rules")
                .and_then(Value::as_array)
                .ok_or(WriteFailure::Invalid)?
            {
                references.extend(rule_node_references(child)?);
            }
        }
        Some("item_owned" | "role_has" | "time_after" | "tool_used") => {}
        _ => return Err(WriteFailure::Invalid),
    }
    Ok(references)
}

fn value_at<'value>(value: &'value Value, path: &[&str]) -> Option<&'value Value> {
    let mut value = value;
    for key in path {
        value = value.as_object()?.get(*key)?;
    }
    Some(value)
}

fn value_at_mut<'value>(value: &'value mut Value, path: &[&str]) -> Option<&'value mut Value> {
    let mut value = value;
    for key in path {
        value = value.as_object_mut()?.get_mut(*key)?;
    }
    Some(value)
}

fn string_at(value: &Value, path: &[&str]) -> Option<String> {
    value_at(value, path)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn set_string_at(value: &mut Value, path: &[&str], replacement: String) -> Option<()> {
    *value_at_mut(value, path)? = Value::String(replacement);
    Some(())
}

fn object_at<'value>(value: &'value Value, path: &[&str]) -> Option<&'value Map<String, Value>> {
    value_at(value, path)?.as_object()
}

fn object_in<'value>(
    value: &'value Map<String, Value>,
    key: &str,
) -> Option<&'value Map<String, Value>> {
    value.get(key)?.as_object()
}

fn string_in(value: &Map<String, Value>, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn enabled(value: Option<&Value>) -> bool {
    matches!(value, Some(Value::Bool(true)))
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
    use time::{OffsetDateTime, format_description::well_known::Rfc3339};

    use super::{normalize_schedule, parse_author_timestamp, remove_node_reference};

    #[test]
    fn source_datetime_local_values_are_canonicalized_before_they_reach_learners() {
        let mut config = json!({
            "schedule": {
                "unlockAt": "2026-11-08T12:10",
                "lockAt": "2026-11-08T13:10"
            }
        });

        normalize_schedule(&mut config).expect("ordered source date-times");

        assert_eq!(
            config["schedule"]["unlockAt"],
            OffsetDateTime::parse("2026-11-08T12:10:00Z", &Rfc3339)
                .expect("reference instant")
                .format(&Rfc3339)
                .expect("canonical instant")
        );
        assert!(parse_author_timestamp("not-a-time").is_none());
        assert!(
            normalize_schedule(&mut json!({
                "schedule": {
                    "unlockAt": "2026-11-08T13:10",
                    "lockAt": "2026-11-08T12:10"
                }
            }))
            .is_err()
        );
    }

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
