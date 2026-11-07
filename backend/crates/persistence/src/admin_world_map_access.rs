use sqlx::{FromRow, PgPool, types::Json};
use uuid::Uuid;
use wicked_learning_application::admin_world_map_access::{
    AdminWorldMapAccessError, AdminWorldMapAccessRepository as Port, UpdateWorldMapAccessForm,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

pub struct PostgresAdminWorldMapAccessRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldMapAccessRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldMapAccessRepository<'_> {
    fn update_map_access(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &UpdateWorldMapAccessForm,
    ) -> impl std::future::Future<Output = Result<Option<()>, AdminWorldMapAccessError>> + Send
    {
        async move {
            update_map_access(self.pool, principal, map_id, form)
                .await
                .map_err(map_error)
        }
    }
}

#[derive(FromRow)]
struct ScopedMap {
    creator_id: Option<Uuid>,
    access_roles: Json<Vec<String>>,
}

enum MapAccessMutationError {
    InvalidAccessRole,
    Storage(sqlx::Error),
}

fn map_error(error: MapAccessMutationError) -> AdminWorldMapAccessError {
    match error {
        MapAccessMutationError::InvalidAccessRole => AdminWorldMapAccessError::InvalidAccessRole,
        MapAccessMutationError::Storage(error) => {
            tracing::error!(%error, "could not update scoped World Builder map access");
            AdminWorldMapAccessError::Unavailable
        }
    }
}

impl From<sqlx::Error> for MapAccessMutationError {
    fn from(error: sqlx::Error) -> Self {
        Self::Storage(error)
    }
}

async fn update_map_access(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_id: Uuid,
    form: &UpdateWorldMapAccessForm,
) -> Result<Option<()>, MapAccessMutationError> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    let Some(map) = sqlx::query_as::<_, ScopedMap>(
        "SELECT created_by_principal_id AS creator_id, access_roles FROM learning_maps WHERE id = $1 FOR UPDATE",
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

    let configured_roles = form
        .access_roles
        .iter()
        .filter(|role| role.as_str() != "public")
        .collect::<Vec<_>>();
    let known_roles = sqlx::query_scalar::<_, String>(
        "SELECT role_key FROM application_roles WHERE role_key = ANY($1)",
    )
    .bind(
        configured_roles
            .iter()
            .map(|role| role.as_str())
            .collect::<Vec<_>>(),
    )
    .fetch_all(&mut *transaction)
    .await?;
    if known_roles.len() != configured_roles.len() {
        return Err(MapAccessMutationError::InvalidAccessRole);
    }

    if map.access_roles.0 != form.access_roles {
        sqlx::query("UPDATE learning_maps SET access_roles = $2, updated_at = NOW() WHERE id = $1")
            .bind(map_id)
            .bind(Json(&form.access_roles))
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await?;
    Ok(Some(()))
}

async fn can_manage_map_access(
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
    let Some(scope) = principal.permission_scope("world_map_access", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_editor))
}
