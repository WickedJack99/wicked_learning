use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_world_node_unlock::{
    AdminWorldNodeUnlockError, AdminWorldNodeUnlockRepository as Port, ResetWorldNodeUnlocksResult,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

pub struct PostgresAdminWorldNodeUnlockRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldNodeUnlockRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldNodeUnlockRepository<'_> {
    fn reset_tool_unlocks(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<ResetWorldNodeUnlocksResult>, AdminWorldNodeUnlockError>,
    > + Send {
        async move {
            reset_tool_unlocks(self.pool, principal, node_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not reset learner node tool unlocks");
                    AdminWorldNodeUnlockError::Unavailable
                })
        }
    }
}

async fn reset_tool_unlocks(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
) -> Result<Option<ResetWorldNodeUnlocksResult>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut transaction, principal).await? else {
        return Ok(None);
    };
    let map_id =
        sqlx::query_scalar::<_, Uuid>("SELECT map_id FROM learning_nodes WHERE id = $1 FOR UPDATE")
            .bind(node_id)
            .fetch_optional(&mut *transaction)
            .await?;
    let Some(map_id) = map_id else {
        return Ok(None);
    };
    if !can_edit_map(&mut transaction, principal, principal_id, map_id).await? {
        return Ok(None);
    }

    // Source "Lock for all users" resets only learner-specific tool unlocks.
    // It must not revoke an explicit support override or erase discovery.
    let reset_count = sqlx::query("DELETE FROM learner_node_tool_uses WHERE node_id = $1")
        .bind(node_id)
        .execute(&mut *transaction)
        .await?
        .rows_affected();
    transaction.commit().await?;
    Ok(Some(ResetWorldNodeUnlocksResult { reset_count }))
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

async fn can_edit_map(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let creator = sqlx::query_scalar::<_, Option<Uuid>>(
        "SELECT created_by_principal_id FROM learning_maps WHERE id = $1",
    )
    .bind(map_id)
    .fetch_optional(&mut **transaction)
    .await?
    .flatten();
    let direct_assignment = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)",
    )
    .bind(map_id)
    .bind(principal_id)
    .fetch_one(&mut **transaction)
    .await?;
    let Some(scope) = principal.permission_scope("world_maps", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && creator == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_assignment)
        || direct_assignment)
}
