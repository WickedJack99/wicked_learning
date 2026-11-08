use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_world_activity_delete::{
    AdminWorldActivityDeleteError, AdminWorldActivityDeleteRepository as Port,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

pub struct PostgresAdminWorldActivityDeleteRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldActivityDeleteRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldActivityDeleteRepository<'_> {
    fn delete_activity(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
    ) -> impl std::future::Future<Output = Result<bool, AdminWorldActivityDeleteError>> + Send {
        async move {
            delete_activity(self.pool, principal, activity_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not delete scoped World Builder activity");
                    AdminWorldActivityDeleteError
                })
        }
    }
}

#[derive(FromRow)]
struct ScopedActivity {
    id: Uuid,
    node_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
}

async fn delete_activity(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
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
    let Some(activity) = sqlx::query_as::<_, ScopedActivity>(
        "SELECT activities.id, nodes.id AS node_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 FOR UPDATE OF activities, nodes",
    )
    .bind(activity_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(false);
    };
    let direct_editor: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)",
    )
    .bind(activity.map_id)
    .bind(principal_id)
    .fetch_one(&mut *transaction)
    .await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(false);
    };
    let permitted = scope == "all"
        || (permission_scope_allows(scope, "own") && activity.map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_editor)
        || direct_editor;
    if !permitted {
        return Ok(false);
    }

    // This mirrors DeleteLearningActivity: remove the activity's route starts,
    // then recompute the node's compatibility preferred start before deleting.
    sqlx::query(
        "DELETE FROM reusable_media_asset_references WHERE owner_kind = 'activity' AND owner_id = $1",
    )
    .bind(activity.id)
    .execute(&mut *transaction)
    .await?;
    sqlx::query("DELETE FROM learning_activity_starts WHERE node_id = $1 AND activity_id = $2")
        .bind(activity.node_id)
        .bind(activity.id)
        .execute(&mut *transaction)
        .await?;
    synchronize_preferred_start(&mut transaction, activity.node_id).await?;
    sqlx::query("DELETE FROM learning_activities WHERE id = $1")
        .bind(activity.id)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(true)
}

async fn synchronize_preferred_start(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    node_id: Uuid,
) -> Result<(), sqlx::Error> {
    let first_start = sqlx::query_scalar::<_, Uuid>(
        "SELECT starts.activity_id FROM learning_activity_starts AS starts INNER JOIN learning_activities AS activities ON activities.id = starts.activity_id WHERE starts.node_id = $1 AND (activities.activity_type <> 'portal' OR activities.activity_config ->> 'portalMode' IS DISTINCT FROM 'input') ORDER BY starts.sort_order ASC, starts.id ASC LIMIT 1",
    )
    .bind(node_id)
    .fetch_optional(&mut **transaction)
    .await?;
    sqlx::query(
        "UPDATE learning_nodes SET start_activity_id = $2, updated_at = NOW() WHERE id = $1",
    )
    .bind(node_id)
    .bind(first_start)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}
