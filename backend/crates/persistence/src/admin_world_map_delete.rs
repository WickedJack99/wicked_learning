use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_world_map_delete::{
    AdminWorldMapDeleteError, AdminWorldMapDeleteRepository as Port,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

pub struct PostgresAdminWorldMapDeleteRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldMapDeleteRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldMapDeleteRepository<'_> {
    fn delete_map(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
    ) -> impl std::future::Future<Output = Result<bool, AdminWorldMapDeleteError>> + Send {
        async move {
            delete_map(self.pool, principal, map_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not delete scoped World Builder map");
                    AdminWorldMapDeleteError
                })
        }
    }
}

#[derive(FromRow)]
struct ScopedMap {
    id: Uuid,
    creator_id: Option<Uuid>,
}

async fn delete_map(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(false);
    };
    let Some(map) = sqlx::query_as::<_, ScopedMap>(
        "SELECT id, created_by_principal_id AS creator_id FROM learning_maps WHERE id = $1 FOR UPDATE",
    )
    .bind(map_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(false);
    };
    let direct_editor: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)",
    )
    .bind(map.id)
    .bind(principal_id)
    .fetch_one(&mut *transaction)
    .await?;
    let Some(scope) = principal.permission_scope("world_maps", "rud") else {
        return Ok(false);
    };
    let permitted = scope == "all"
        || (permission_scope_allows(scope, "own") && map.creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_editor);
    if !permitted {
        return Ok(false);
    }

    // The fresh schema cascades map-owned assets, nodes, routes, activities,
    // portal links and learner state in the same transaction.
    // Generic media references intentionally do not use a polymorphic foreign
    // key, so remove MapAsset-owned links before the database cascade deletes
    // those owners. Otherwise a reusable visual would be permanently marked
    // as referenced after its source map disappeared.
    sqlx::query("DELETE FROM reusable_media_asset_references WHERE owner_kind = 'map_asset' AND owner_id IN (SELECT id FROM learning_map_assets WHERE map_id = $1)")
        .bind(map.id)
        .execute(&mut *transaction)
        .await?;
    sqlx::query("DELETE FROM learning_maps WHERE id = $1")
        .bind(map.id)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(true)
}
