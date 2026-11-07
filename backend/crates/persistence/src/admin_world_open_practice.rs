use serde_json::json;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_world_open_practice::{
    AdminWorldOpenPracticeError, AdminWorldOpenPracticeRepository as Port,
    OpenPracticeActivityForm, generated_slug,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

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
                .map_err(|error| match error {
                    CreateError::Invalid => AdminWorldOpenPracticeError::InvalidActivity,
                    CreateError::Storage(error) => {
                        tracing::error!(%error, "could not create scoped World Builder open practice activity");
                        AdminWorldOpenPracticeError::Unavailable
                    }
                })
        }
    }
}

#[derive(FromRow)]
struct ScopedNode {
    map_asset_id: Option<Uuid>,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
}

enum CreateError {
    Invalid,
    Storage(sqlx::Error),
}

impl From<sqlx::Error> for CreateError {
    fn from(error: sqlx::Error) -> Self {
        Self::Storage(error)
    }
}

async fn create_open_practice(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    form: &OpenPracticeActivityForm,
) -> Result<Option<Uuid>, CreateError> {
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
    let slug = unique_slug(&mut transaction, map_asset_id, form).await?;
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

async fn unique_slug(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    map_asset_id: Uuid,
    form: &OpenPracticeActivityForm,
) -> Result<String, CreateError> {
    let base = form
        .slug
        .clone()
        .unwrap_or_else(|| generated_slug(&form.title));
    let mut candidate = base.clone();
    let mut suffix = 2;
    loop {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE routes.map_asset_id = $1 AND activities.slug = $2)",
        )
        .bind(map_asset_id)
        .bind(&candidate)
        .fetch_one(&mut **transaction)
        .await?;
        if !exists {
            return Ok(candidate);
        }
        if form.slug.is_some() {
            return Err(CreateError::Invalid);
        }
        candidate = format!("{base}-{suffix}");
        if candidate.len() > 140 {
            return Err(CreateError::Invalid);
        }
        suffix += 1;
        // The source increments indefinitely. A database-backed candidate
        // guard avoids a pathological local test fixture monopolizing a
        // transaction while retaining practical source behavior.
        if suffix > 10_000 {
            return Err(CreateError::Invalid);
        }
    }
}

async fn lock_editable_node(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
) -> Result<Option<ScopedNode>, sqlx::Error> {
    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut **transaction)
    .await?
    else {
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
    let direct_editor: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)",
    )
    .bind(node.map_id)
    .bind(principal_id)
    .fetch_one(&mut **transaction)
    .await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(None);
    };
    let permitted = scope == "all"
        || (permission_scope_allows(scope, "own") && node.map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_editor)
        || direct_editor;
    Ok(permitted.then_some(node))
}
