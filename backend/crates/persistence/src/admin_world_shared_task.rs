use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_world_shared_task::{
    AdminWorldSharedTaskError, AdminWorldSharedTaskRepository as Port, CreatedSharedTaskActivity,
    SharedTaskActivityForm, UpdatedSharedTaskActivity, generated_slug,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

use crate::admin_world_activity_history::record_activity_version;

pub struct PostgresAdminWorldSharedTaskRepository<'pool> {
    pool: &'pool PgPool,
}
impl<'pool> PostgresAdminWorldSharedTaskRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldSharedTaskRepository<'_> {
    fn create_shared_task(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &SharedTaskActivityForm,
    ) -> impl std::future::Future<
        Output = Result<Option<CreatedSharedTaskActivity>, AdminWorldSharedTaskError>,
    > + Send {
        async move {
            create(self.pool, principal, node_id, form)
                .await
                .map_err(map_error)
        }
    }
    fn update_shared_task(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &SharedTaskActivityForm,
        expected_updated_at: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<UpdatedSharedTaskActivity>, AdminWorldSharedTaskError>,
    > + Send {
        async move {
            update(self.pool, principal, activity_id, form, expected_updated_at)
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
    slug: String,
    title: String,
    introduction: Option<String>,
    config: Value,
    updated_at: String,
}
enum MutationError {
    Invalid,
    Conflict,
    Storage(sqlx::Error),
}
impl From<sqlx::Error> for MutationError {
    fn from(error: sqlx::Error) -> Self {
        Self::Storage(error)
    }
}
fn map_error(error: MutationError) -> AdminWorldSharedTaskError {
    match error {
        MutationError::Invalid => AdminWorldSharedTaskError::InvalidActivity,
        MutationError::Conflict => AdminWorldSharedTaskError::Conflict,
        MutationError::Storage(error) => {
            tracing::error!(%error, "could not mutate scoped World Builder shared-task activity");
            AdminWorldSharedTaskError::Unavailable
        }
    }
}

async fn create(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    form: &SharedTaskActivityForm,
) -> Result<Option<CreatedSharedTaskActivity>, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(node) = lock_node(&mut transaction, principal, node_id).await? else {
        return Ok(None);
    };
    let Some(map_asset_id) = node.map_asset_id else {
        return Ok(None);
    };
    let Some(route_id) = sqlx::query_scalar::<_, Uuid>("SELECT id FROM learning_routes WHERE map_asset_id = $1 ORDER BY position ASC, id ASC LIMIT 1 FOR UPDATE").bind(map_asset_id).fetch_optional(&mut *transaction).await? else { return Ok(None); };
    let slug = unique_slug(&mut transaction, map_asset_id, form, None).await?;
    let position: i16 = sqlx::query_scalar("SELECT (COALESCE(MAX(position), -1)::integer + 1)::smallint FROM learning_activities WHERE route_id = $1").bind(route_id).fetch_one(&mut *transaction).await?;
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO learning_activities (id, route_id, slug, title, description, position, published_at, activity_type, activity_config, introduction, graph_position_x, graph_position_y, ai_review_status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'shared_task', $7, $8, $9, $10, 'needs_review')")
        .bind(id).bind(route_id).bind(&slug).bind(&form.title).bind(form.introduction.clone().unwrap_or_default()).bind(position).bind(config(form)).bind(&form.introduction).bind(form.graph_position_x.map(f64::from)).bind(form.graph_position_y.map(f64::from)).execute(&mut *transaction).await?;
    transaction.commit().await?;
    Ok(Some(CreatedSharedTaskActivity {
        activity_id: id,
        slug,
    }))
}

async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    form: &SharedTaskActivityForm,
    expected_updated_at: &str,
) -> Result<Option<UpdatedSharedTaskActivity>, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(current) = lock_activity(&mut transaction, principal, activity_id).await? else {
        return Ok(None);
    };
    if current.updated_at != expected_updated_at {
        return Err(MutationError::Conflict);
    }
    let slug = unique_slug(
        &mut transaction,
        current.map_asset_id,
        form,
        Some(activity_id),
    )
    .await?;
    let mut next = current.config.clone();
    let object = next.as_object_mut().ok_or(MutationError::Invalid)?;
    for (key, value) in config(form).as_object().ok_or(MutationError::Invalid)? {
        object.insert(key.clone(), value.clone());
    }
    if current.slug == slug
        && current.title == form.title
        && current.introduction == form.introduction
        && current.config == next
    {
        transaction.commit().await?;
        return Ok(Some(UpdatedSharedTaskActivity {
            activity_id,
            updated_at: current.updated_at,
        }));
    }
    record_activity_version(&mut transaction, activity_id, principal).await?;
    let updated_at: String = sqlx::query_scalar("UPDATE learning_activities SET slug = $2, title = $3, description = $4, introduction = $5, activity_config = $6, ai_review_status = 'needs_review', ai_reviewed_at = NULL, ai_review = NULL, updated_at = NOW() WHERE id = $1 RETURNING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')")
        .bind(activity_id).bind(slug).bind(&form.title).bind(form.introduction.clone().unwrap_or_default()).bind(&form.introduction).bind(next).fetch_one(&mut *transaction).await?;
    transaction.commit().await?;
    Ok(Some(UpdatedSharedTaskActivity {
        activity_id,
        updated_at,
    }))
}

pub fn config(form: &SharedTaskActivityForm) -> Value {
    json!({ "taskKind": form.task_kind, "showContributions": form.show_contributions, "prompt": form.prompt, "instructions": form.instructions, "inputLabel": form.input_label, "projectGoal": form.project_goal, "projectDeliverable": form.project_deliverable, "projectSteps": form.project_steps, "peerReviewEnabled": form.peer_review_enabled, "peerReviewPrompt": form.peer_review_prompt, "threshold": form.threshold, "minimumLength": form.minimum_length, "repeatPolicy": form.repeat_policy, "validationMode": form.validation_mode, "cycleMode": form.cycle_mode })
}

async fn unique_slug(
    transaction: &mut Transaction<'_, Postgres>,
    map_asset_id: Uuid,
    form: &SharedTaskActivityForm,
    excluded: Option<Uuid>,
) -> Result<String, MutationError> {
    let base = form
        .slug
        .clone()
        .unwrap_or_else(|| generated_slug(&form.title));
    let mut candidate = base.clone();
    let mut suffix = 2;
    loop {
        let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE routes.map_asset_id = $1 AND activities.slug = $2 AND ($3::uuid IS NULL OR activities.id <> $3))").bind(map_asset_id).bind(&candidate).bind(excluded).fetch_one(&mut **transaction).await?;
        if !exists {
            return Ok(candidate);
        }
        if form.slug.is_some() {
            return Err(MutationError::Invalid);
        }
        candidate = format!("{base}-{suffix}");
        if candidate.len() > 140 || suffix > 10_000 {
            return Err(MutationError::Invalid);
        }
        suffix += 1;
    }
}

async fn lock_activity(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
) -> Result<Option<ScopedActivity>, sqlx::Error> {
    let Some(principal_id) = principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let Some(activity) = sqlx::query_as::<_, ScopedActivity>("SELECT routes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id, activities.slug, activities.title, activities.introduction, activities.activity_config AS config, to_char(activities.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 AND activities.activity_type = 'shared_task' FOR UPDATE OF activities, nodes").bind(activity_id).fetch_optional(&mut **transaction).await? else { return Ok(None); };
    Ok(has_scope(
        transaction,
        principal,
        principal_id,
        activity.map_id,
        activity.map_creator_id,
    )
    .await?
    .then_some(activity))
}
async fn lock_node(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
) -> Result<Option<ScopedNode>, sqlx::Error> {
    let Some(principal_id) = principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let Some(node) = sqlx::query_as::<_, ScopedNode>("SELECT nodes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE nodes.id = $1 FOR UPDATE OF nodes").bind(node_id).fetch_optional(&mut **transaction).await? else { return Ok(None); };
    Ok(has_scope(
        transaction,
        principal,
        principal_id,
        node.map_id,
        node.map_creator_id,
    )
    .await?
    .then_some(node))
}
async fn principal_id(
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
async fn has_scope(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    creator: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let assigned: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)").bind(map_id).bind(principal_id).fetch_one(&mut **transaction).await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && creator == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && assigned)
        || assigned)
}
