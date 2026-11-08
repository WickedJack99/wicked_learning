use std::collections::HashSet;

use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_world_map_editing_groups::{
    AdminWorldMapEditingGroupsError, AdminWorldMapEditingGroupsRepository as Port,
    UpdateWorldMapEditingGroupsForm,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

pub struct PostgresAdminWorldMapEditingGroupsRepository<'pool> {
    pool: &'pool PgPool,
}
impl<'pool> PostgresAdminWorldMapEditingGroupsRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}
impl Port for PostgresAdminWorldMapEditingGroupsRepository<'_> {
    fn update_map_editing_groups(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &UpdateWorldMapEditingGroupsForm,
    ) -> impl std::future::Future<Output = Result<Option<()>, AdminWorldMapEditingGroupsError>> + Send
    {
        async move {
            update(self.pool, principal, map_id, form)
                .await
                .map_err(map_error)
        }
    }
}
#[derive(FromRow)]
struct ScopedMap {
    creator_id: Option<Uuid>,
}
enum MutationError {
    InvalidGroup,
    Storage(sqlx::Error),
}
impl From<sqlx::Error> for MutationError {
    fn from(error: sqlx::Error) -> Self {
        Self::Storage(error)
    }
}
fn map_error(error: MutationError) -> AdminWorldMapEditingGroupsError {
    match error {
        MutationError::InvalidGroup => AdminWorldMapEditingGroupsError::InvalidGroup,
        MutationError::Storage(error) => {
            tracing::error!(%error, "could not update scoped World Builder map editing groups");
            AdminWorldMapEditingGroupsError::Unavailable
        }
    }
}

async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_id: Uuid,
    form: &UpdateWorldMapEditingGroupsForm,
) -> Result<Option<()>, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id=$1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    let Some(map) = sqlx::query_as::<_, ScopedMap>(
        "SELECT created_by_principal_id AS creator_id FROM learning_maps WHERE id=$1 FOR UPDATE",
    )
    .bind(map_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    if !can_manage_map_access(
        &mut transaction,
        principal,
        principal_id,
        map_id,
        map.creator_id,
    )
    .await?
    {
        return Ok(None);
    }
    let group_ids: Vec<Uuid> = form
        .group_ids
        .iter()
        .copied()
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    if !group_ids.is_empty()
        && !manageable_groups(&mut transaction, principal, principal_id, &group_ids).await?
    {
        return Err(MutationError::InvalidGroup);
    }
    sqlx::query("DELETE FROM learning_map_editing_groups WHERE map_id=$1")
        .bind(map_id)
        .execute(&mut *transaction)
        .await?;
    for group_id in group_ids {
        sqlx::query("INSERT INTO learning_map_editing_groups (map_id, group_id) VALUES ($1,$2)")
            .bind(map_id)
            .bind(group_id)
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await?;
    Ok(Some(()))
}
async fn manageable_groups(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    group_ids: &[Uuid],
) -> Result<bool, sqlx::Error> {
    let Some(scope) = principal.permission_scope("groups", "ru") else {
        return Ok(false);
    };
    if !permission_scope_allows(scope, "own") {
        return Ok(false);
    }
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM learning_groups AS groups WHERE groups.id=ANY($1) AND ($2 OR groups.created_by_principal_id=$3 OR ($4 AND EXISTS (SELECT 1 FROM learning_group_memberships AS memberships WHERE memberships.group_id=groups.id AND memberships.principal_id=$3 AND memberships.role='manager'))) ").bind(group_ids).bind(scope == "all").bind(principal_id).bind(permission_scope_allows(scope, "assigned")).fetch_one(&mut **transaction).await?;
    Ok(count == group_ids.len() as i64)
}
async fn can_manage_map_access(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    creator_id: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id=groups.group_id WHERE groups.map_id=$1 AND memberships.principal_id=$2)").bind(map_id).bind(principal_id).fetch_one(&mut **transaction).await?;
    let Some(scope) = principal.permission_scope("world_map_access", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct))
}
