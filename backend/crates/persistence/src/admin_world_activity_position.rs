use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_world_activity_position::{
    ActivityGraphPosition, AdminWorldActivityPositionError,
    AdminWorldActivityPositionRepository as Port,
};
use wicked_learning_domain::{
    identity_access::{AuthorizedPrincipal, permission_scope_allows},
    world_content::AdminActivityGraphPosition,
};

pub struct PostgresAdminWorldActivityPositionRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldActivityPositionRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldActivityPositionRepository<'_> {
    fn update_position(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        position: ActivityGraphPosition,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminActivityGraphPosition>, AdminWorldActivityPositionError>,
    > + Send {
        async move {
            update_position(self.pool, principal, activity_id, position)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not update scoped World Builder activity position");
                    AdminWorldActivityPositionError
                })
        }
    }
}

#[derive(FromRow)]
struct ScopedActivity {
    id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
}

#[derive(FromRow)]
struct PositionRow {
    x: Option<f64>,
    y: Option<f64>,
}

async fn update_position(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    position: ActivityGraphPosition,
) -> Result<Option<AdminActivityGraphPosition>, sqlx::Error> {
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
    let Some(activity) = sqlx::query_as::<_, ScopedActivity>(
        "SELECT activities.id, nodes.map_id, maps.created_by_principal_id AS map_creator_id FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 FOR UPDATE OF activities, nodes",
    )
    .bind(activity_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    let direct_editor: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)",
    )
    .bind(activity.map_id)
    .bind(principal_id)
    .fetch_one(&mut *transaction)
    .await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(None);
    };
    let permitted = scope == "all"
        || (permission_scope_allows(scope, "own") && activity.map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_editor)
        || direct_editor;
    if !permitted {
        return Ok(None);
    }

    let position = sqlx::query_as::<_, PositionRow>(
        "UPDATE learning_activities SET graph_position_x = $2, graph_position_y = $3, updated_at = NOW() WHERE id = $1 RETURNING graph_position_x AS x, graph_position_y AS y",
    )
    .bind(activity.id)
    .bind(f64::from(position.x))
    .bind(f64::from(position.y))
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;

    Ok(Some(AdminActivityGraphPosition {
        x: position.x,
        y: position.y,
    }))
}
