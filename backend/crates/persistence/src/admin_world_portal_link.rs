use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_world_portal_link::{
    AdminWorldPortalLinkError, AdminWorldPortalLinkRepository as Port, CreateWorldPortalLinkForm,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

pub struct PostgresAdminWorldPortalLinkRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldPortalLinkRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldPortalLinkRepository<'_> {
    fn create_portal_link(
        &self,
        principal: &AuthorizedPrincipal,
        form: &CreateWorldPortalLinkForm,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, AdminWorldPortalLinkError>> + Send
    {
        async move {
            create(self.pool, principal, form).await.map_err(|error| match error {
                PortalLinkMutationError::Conflict => AdminWorldPortalLinkError::Conflict,
                PortalLinkMutationError::Storage(error) => {
                    tracing::error!(%error, "could not create global World Builder portal link");
                    AdminWorldPortalLinkError::Unavailable
                }
            })
        }
    }

    fn delete_portal_link(
        &self,
        principal: &AuthorizedPrincipal,
        portal_link_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<()>, AdminWorldPortalLinkError>> + Send
    {
        async move {
            delete(self.pool, principal, portal_link_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not delete global World Builder portal link");
                    AdminWorldPortalLinkError::Unavailable
                })
        }
    }
}

enum PortalLinkMutationError {
    Conflict,
    Storage(sqlx::Error),
}

impl From<sqlx::Error> for PortalLinkMutationError {
    fn from(error: sqlx::Error) -> Self {
        Self::Storage(error)
    }
}

async fn create(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    form: &CreateWorldPortalLinkForm,
) -> Result<Option<Uuid>, PortalLinkMutationError> {
    let mut transaction = pool.begin().await?;
    let map_ids = scoped_map_ids(&mut transaction, principal).await?;
    if map_ids.is_empty() {
        return Ok(None);
    }
    let source_title = sqlx::query_scalar::<_, String>(
        "SELECT title FROM learning_nodes WHERE id = $1 AND map_id = ANY($2) FOR UPDATE",
    )
    .bind(form.source_node_id)
    .bind(&map_ids)
    .fetch_optional(&mut *transaction)
    .await?;
    let target_title = sqlx::query_scalar::<_, String>(
        "SELECT title FROM learning_nodes WHERE id = $1 AND map_id = ANY($2) FOR UPDATE",
    )
    .bind(form.target_node_id)
    .bind(&map_ids)
    .fetch_optional(&mut *transaction)
    .await?;
    let (Some(source_title), Some(target_title)) = (source_title, target_title) else {
        return Ok(None);
    };
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM learning_portal_links WHERE source_node_id = $1 AND target_node_id = $2)",
    )
    .bind(form.source_node_id)
    .bind(form.target_node_id)
    .fetch_one(&mut *transaction)
    .await?;
    if exists {
        return Err(PortalLinkMutationError::Conflict);
    }
    let label = form
        .label
        .clone()
        .unwrap_or_else(|| format!("{source_title} to {target_title}"));
    let id = sqlx::query_scalar(
        "INSERT INTO learning_portal_links (id, source_activity_id, target_activity_id, source_node_id, target_node_id, label, description) VALUES ($1, NULL, NULL, $2, $3, $4, $5) RETURNING id",
    )
    .bind(Uuid::new_v4())
    .bind(form.source_node_id)
    .bind(form.target_node_id)
    .bind(label)
    .bind(&form.description)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(id))
}

async fn delete(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    portal_link_id: Uuid,
) -> Result<Option<()>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let map_ids = scoped_map_ids(&mut transaction, principal).await?;
    if map_ids.is_empty() {
        return Ok(None);
    }
    let deleted = sqlx::query_scalar::<_, Uuid>(
        "DELETE FROM learning_portal_links AS links USING learning_nodes AS source_nodes, learning_nodes AS target_nodes WHERE links.id = $1 AND source_nodes.id = links.source_node_id AND target_nodes.id = links.target_node_id AND (source_nodes.map_id = ANY($2) OR target_nodes.map_id = ANY($2)) RETURNING links.id",
    )
    .bind(portal_link_id)
    .bind(&map_ids)
    .fetch_optional(&mut *transaction)
    .await?;
    if deleted.is_none() {
        return Ok(None);
    }
    transaction.commit().await?;
    Ok(Some(()))
}

async fn scoped_map_ids(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Vec<Uuid>, sqlx::Error> {
    let Some(world_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learning_worlds ORDER BY created_at ASC, slug ASC LIMIT 1",
    )
    .fetch_optional(&mut **transaction)
    .await?
    else {
        return Ok(vec![]);
    };
    let update_scopes = ["world_maps", "world_nodes", "world_activities"]
        .into_iter()
        .filter_map(|resource| principal.permission_scope(resource, "ru"))
        .collect::<Vec<_>>();
    if update_scopes.iter().any(|scope| *scope == "all") {
        return sqlx::query_scalar("SELECT id FROM learning_maps WHERE world_id = $1")
            .bind(world_id)
            .fetch_all(&mut **transaction)
            .await;
    }
    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut **transaction)
    .await?
    else {
        return Ok(vec![]);
    };
    let can_edit_own = update_scopes
        .iter()
        .any(|scope| permission_scope_allows(scope, "own"));
    sqlx::query_scalar(
        "SELECT maps.id FROM learning_maps AS maps WHERE maps.world_id = $1 AND (($2 AND maps.created_by_principal_id = $3) OR EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = maps.id AND memberships.principal_id = $3))",
    )
    .bind(world_id)
    .bind(can_edit_own)
    .bind(principal_id)
    .fetch_all(&mut **transaction)
    .await
}
