use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_world_node_layout::{
    AdminWorldNodeLayout, AdminWorldNodeLayoutError,
    AdminWorldNodeLayoutRepository as AdminWorldNodeLayoutRepositoryPort,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

pub struct PostgresAdminWorldNodeLayoutRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldNodeLayoutRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl AdminWorldNodeLayoutRepositoryPort for PostgresAdminWorldNodeLayoutRepository<'_> {
    fn update_activity_graph_layout(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        layout: &AdminWorldNodeLayout,
    ) -> impl std::future::Future<Output = Result<Option<Value>, AdminWorldNodeLayoutError>> + Send
    {
        async move {
            update_activity_graph_layout(self.pool, principal, node_id, layout)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not update the scoped World Builder node graph layout");
                    AdminWorldNodeLayoutError
                })
        }
    }
}

#[derive(FromRow)]
struct ScopedNode {
    id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
}

async fn update_activity_graph_layout(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    layout: &AdminWorldNodeLayout,
) -> Result<Option<Value>, sqlx::Error> {
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
    let Some(node) = sqlx::query_as::<_, ScopedNode>(
        "SELECT nodes.id, nodes.map_id, maps.created_by_principal_id AS map_creator_id FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE nodes.id = $1 FOR UPDATE OF nodes",
    )
    .bind(node_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    let direct_editor: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)")
        .bind(node.map_id)
        .bind(principal_id)
        .fetch_one(&mut *transaction)
        .await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(None);
    };
    let permitted = scope == "all"
        || (permission_scope_allows(scope, "own") && node.map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_editor)
        || direct_editor;
    if !permitted {
        return Ok(None);
    }

    let graph_layout = sqlx::query_scalar::<_, Value>(
        "UPDATE learning_nodes SET activity_graph_layout = jsonb_set(activity_graph_layout, ARRAY[$2]::text[], jsonb_build_object('x', $3::integer, 'y', $4::integer), true), updated_at = NOW() WHERE id = $1 RETURNING activity_graph_layout",
    )
    .bind(node.id)
    .bind(layout.graph_node.key())
    .bind(layout.x)
    .bind(layout.y)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;

    Ok(Some(graph_layout))
}
