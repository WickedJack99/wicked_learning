use serde_json::{Value, json};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_world_open_practice::{
    AdminWorldOpenPracticeError, AdminWorldOpenPracticeRepository as Port,
    OpenPracticeActivityForm, UpdatedOpenPracticeActivity, generated_slug,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

use crate::admin_world_activity_history::record_activity_version;

pub struct PostgresAdminWorldOpenPracticeRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldOpenPracticeRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldOpenPracticeRepository<'_> {
    fn create_open_practice(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &OpenPracticeActivityForm,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, AdminWorldOpenPracticeError>> + Send
    {
        async move {
            create_open_practice(self.pool, principal, node_id, form)
                .await
                .map_err(map_mutation_error)
        }
    }

    fn update_open_practice(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &OpenPracticeActivityForm,
        expected_updated_at: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<UpdatedOpenPracticeActivity>, AdminWorldOpenPracticeError>,
    > + Send {
        async move {
            update_open_practice(self.pool, principal, activity_id, form, expected_updated_at)
                .await
                .map_err(map_mutation_error)
        }
    }
}

#[derive(FromRow)]
struct ScopedNode {
    map_asset_id: Option<Uuid>,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
}

enum OpenPracticeMutationError {
    Invalid,
    Conflict,
    Storage(sqlx::Error),
}

fn map_mutation_error(error: OpenPracticeMutationError) -> AdminWorldOpenPracticeError {
    match error {
        OpenPracticeMutationError::Invalid => AdminWorldOpenPracticeError::InvalidActivity,
        OpenPracticeMutationError::Conflict => AdminWorldOpenPracticeError::Conflict,
        OpenPracticeMutationError::Storage(error) => {
            tracing::error!(%error, "could not mutate scoped World Builder open practice activity");
            AdminWorldOpenPracticeError::Unavailable
        }
    }
}

impl From<sqlx::Error> for OpenPracticeMutationError {
    fn from(error: sqlx::Error) -> Self {
        Self::Storage(error)
    }
}

#[derive(FromRow)]
struct ScopedOpenPracticeActivity {
    map_asset_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
    slug: String,
    title: String,
    introduction: Option<String>,
    config: Value,
    updated_at: String,
}

async fn create_open_practice(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    form: &OpenPracticeActivityForm,
) -> Result<Option<Uuid>, OpenPracticeMutationError> {
    let mut transaction = pool.begin().await?;
    let Some(node) = lock_editable_node(&mut transaction, principal, node_id).await? else {
        return Ok(None);
    };
    let Some(map_asset_id) = node.map_asset_id else {
        return Ok(None);
    };
    // The Rust read model retains routes as an internal playback grouping while
    // Laravel authors directly on a node. A deterministic primary route keeps
    // that storage detail out of the source-shaped authoring contract.
    let Some(route_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learning_routes WHERE map_asset_id = $1 ORDER BY position ASC, id ASC LIMIT 1 FOR UPDATE",
    )
    .bind(map_asset_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    let slug = unique_slug(&mut transaction, map_asset_id, form, None).await?;
    let position: i16 = sqlx::query_scalar(
        "SELECT (COALESCE(MAX(position), -1)::integer + 1)::smallint FROM learning_activities WHERE route_id = $1",
    )
    .bind(route_id)
    .fetch_one(&mut *transaction)
    .await?;
    let id = Uuid::new_v4();
    let description = form.introduction.clone().unwrap_or_default();
    sqlx::query(
        "INSERT INTO learning_activities (id, route_id, slug, title, description, position, published_at, activity_type, activity_config, introduction, ai_review_status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'open_practice', $7, $8, 'needs_review')",
    )
    .bind(id)
    .bind(route_id)
    .bind(slug)
    .bind(&form.title)
    .bind(description)
    .bind(position)
    .bind(json!({ "nextStep": form.next_step }))
    .bind(&form.introduction)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(id))
}

async fn update_open_practice(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    form: &OpenPracticeActivityForm,
    expected_updated_at: &str,
) -> Result<Option<UpdatedOpenPracticeActivity>, OpenPracticeMutationError> {
    let mut transaction = pool.begin().await?;
    let Some(current) =
        lock_editable_open_practice(&mut transaction, principal, activity_id).await?
    else {
        return Ok(None);
    };
    if current.updated_at != expected_updated_at {
        return Err(OpenPracticeMutationError::Conflict);
    }
    let slug = unique_slug(
        &mut transaction,
        current.map_asset_id,
        form,
        Some(activity_id),
    )
    .await?;
    let description = form.introduction.clone().unwrap_or_default();
    let mut config = current.config.clone();
    config
        .as_object_mut()
        .ok_or(OpenPracticeMutationError::Invalid)?
        .insert("nextStep".to_owned(), json!(form.next_step));
    let unchanged = current.slug == slug
        && current.title == form.title
        && current.introduction == form.introduction
        && current.config == config;
    if unchanged {
        transaction.commit().await?;
        return Ok(Some(UpdatedOpenPracticeActivity {
            activity_id,
            updated_at: current.updated_at,
        }));
    }
    record_activity_version(&mut transaction, activity_id, principal).await?;
    let updated_at: String = sqlx::query_scalar(
        "UPDATE learning_activities SET slug = $2, title = $3, description = $4, introduction = $5, activity_config = $6, ai_review_status = 'needs_review', ai_reviewed_at = NULL, ai_review = NULL, updated_at = NOW() WHERE id = $1 RETURNING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')",
    )
    .bind(activity_id)
    .bind(slug)
    .bind(&form.title)
    .bind(description)
    .bind(&form.introduction)
    .bind(config)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(UpdatedOpenPracticeActivity {
        activity_id,
        updated_at,
    }))
}

async fn unique_slug(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    map_asset_id: Uuid,
    form: &OpenPracticeActivityForm,
    excluded_activity_id: Option<Uuid>,
) -> Result<String, OpenPracticeMutationError> {
    let base = form
        .slug
        .clone()
        .unwrap_or_else(|| generated_slug(&form.title));
    let mut candidate = base.clone();
    let mut suffix = 2;
    loop {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE routes.map_asset_id = $1 AND activities.slug = $2 AND ($3::uuid IS NULL OR activities.id <> $3))",
        )
        .bind(map_asset_id)
        .bind(&candidate)
        .bind(excluded_activity_id)
        .fetch_one(&mut **transaction)
        .await?;
        if !exists {
            return Ok(candidate);
        }
        if form.slug.is_some() {
            return Err(OpenPracticeMutationError::Invalid);
        }
        candidate = format!("{base}-{suffix}");
        if candidate.len() > 140 {
            return Err(OpenPracticeMutationError::Invalid);
        }
        suffix += 1;
        // The source increments indefinitely. A database-backed candidate
        // guard avoids a pathological local test fixture monopolizing a
        // transaction while retaining practical source behavior.
        if suffix > 10_000 {
            return Err(OpenPracticeMutationError::Invalid);
        }
    }
}

async fn lock_editable_open_practice(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
) -> Result<Option<ScopedOpenPracticeActivity>, sqlx::Error> {
    let Some(principal_id) = application_principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let Some(activity) = sqlx::query_as::<_, ScopedOpenPracticeActivity>(
        "SELECT routes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id, activities.slug, activities.title, activities.introduction, activities.activity_config AS config, to_char(activities.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 AND activities.activity_type = 'open_practice' FOR UPDATE OF activities, nodes",
    )
    .bind(activity_id)
    .fetch_optional(&mut **transaction)
    .await?
    else {
        return Ok(None);
    };
    let permitted = scoped_map_access(
        transaction,
        principal,
        principal_id,
        activity.map_id,
        activity.map_creator_id,
    )
    .await?;
    Ok(permitted.then_some(activity))
}

async fn lock_editable_node(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
) -> Result<Option<ScopedNode>, sqlx::Error> {
    let Some(principal_id) = application_principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let Some(node) = sqlx::query_as::<_, ScopedNode>(
        "SELECT nodes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE nodes.id = $1 FOR UPDATE OF nodes",
    )
    .bind(node_id)
    .fetch_optional(&mut **transaction)
    .await?
    else {
        return Ok(None);
    };
    let permitted = scoped_map_access(
        transaction,
        principal,
        principal_id,
        node.map_id,
        node.map_creator_id,
    )
    .await?;
    Ok(permitted.then_some(node))
}

async fn application_principal_id(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut **transaction)
    .await
}

async fn scoped_map_access(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let direct_editor: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)",
    )
    .bind(map_id)
    .bind(principal_id)
    .fetch_one(&mut **transaction)
    .await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_editor)
        || direct_editor)
}
