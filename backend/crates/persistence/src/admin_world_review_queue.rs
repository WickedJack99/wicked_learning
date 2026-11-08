use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_world_review_queue::{
    AdminWorldReviewQueueError, AdminWorldReviewQueuePageRequest,
    AdminWorldReviewQueueRepository as Port,
};
use wicked_learning_domain::{
    identity_access::{AuthorizedPrincipal, permission_scope_allows},
    world_content::{
        AdminWorldReviewQueueItem, AdminWorldReviewQueueMap, AdminWorldReviewQueueNode,
        AdminWorldReviewQueuePage, AdminWorldReviewQueuePagination,
    },
};

/// PostgreSQL projection of the source world-level Review queue. The query is
/// intentionally authored-map scoped; it never starts from learner visibility.
pub struct PostgresAdminWorldReviewQueueRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldReviewQueueRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct WorldRow {
    id: Uuid,
}

#[derive(FromRow)]
struct MapScopeRow {
    id: Uuid,
    created_by_principal_id: Option<Uuid>,
}

#[derive(FromRow)]
struct QueueRow {
    id: Uuid,
    title: String,
    activity_type: String,
    map_id: Uuid,
    map_title: String,
    node_id: Uuid,
    node_title: String,
}

impl Port for PostgresAdminWorldReviewQueueRepository<'_> {
    fn load_review_queue(
        &self,
        principal: &AuthorizedPrincipal,
        page: AdminWorldReviewQueuePageRequest,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminWorldReviewQueuePage>, AdminWorldReviewQueueError>,
    > + Send {
        async move {
            load_review_queue(self.pool, principal, page)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load the scoped World Builder review queue");
                    AdminWorldReviewQueueError
                })
        }
    }
}

async fn load_review_queue(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    page: AdminWorldReviewQueuePageRequest,
) -> Result<Option<AdminWorldReviewQueuePage>, sqlx::Error> {
    let Some(world) = sqlx::query_as::<_, WorldRow>(
        "SELECT id FROM learning_worlds ORDER BY created_at ASC, slug ASC LIMIT 1",
    )
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };
    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(Some(empty_page(page)));
    };
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(Some(empty_page(page)));
    };
    let maps = sqlx::query_as::<_, MapScopeRow>(
        "SELECT maps.id, maps.created_by_principal_id FROM learning_maps AS maps WHERE maps.world_id = $1 ORDER BY maps.id ASC",
    )
    .bind(world.id)
    .fetch_all(pool)
    .await?;
    let mut map_ids = Vec::new();
    for map in maps {
        if scope_allows_map(pool, &scope, &map, principal_id).await? {
            map_ids.push(map.id);
        }
    }
    if map_ids.is_empty() {
        return Ok(Some(empty_page(page)));
    }

    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*)::BIGINT FROM learning_activities AS activities \
         INNER JOIN learning_routes AS routes ON routes.id = activities.route_id \
         INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id \
         INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id \
         WHERE nodes.map_id = ANY($1) \
           AND (activities.ai_review_status IS NULL OR activities.ai_review_status <> 'reviewed')",
    )
    .bind(&map_ids)
    .fetch_one(pool)
    .await?;
    let last_page = ((total + page.per_page - 1) / page.per_page).max(1);
    let current_page = page.page.min(last_page);
    let rows = sqlx::query_as::<_, QueueRow>(
        "SELECT activities.id, activities.title, activities.activity_type, \
                maps.id AS map_id, maps.title AS map_title, nodes.id AS node_id, nodes.title AS node_title \
         FROM learning_activities AS activities \
         INNER JOIN learning_routes AS routes ON routes.id = activities.route_id \
         INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id \
         INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id \
         INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id \
         WHERE maps.id = ANY($1) \
           AND (activities.ai_review_status IS NULL OR activities.ai_review_status <> 'reviewed') \
         ORDER BY maps.id ASC, nodes.position_q ASC, nodes.position_r ASC, routes.position ASC, activities.position ASC, activities.id ASC \
         LIMIT $2 OFFSET $3",
    )
    .bind(&map_ids)
    .bind(page.per_page)
    .bind((current_page - 1) * page.per_page)
    .fetch_all(pool)
    .await?;

    Ok(Some(AdminWorldReviewQueuePage {
        items: rows
            .into_iter()
            .map(|row| AdminWorldReviewQueueItem {
                id: row.id,
                title: row.title,
                activity_type: row.activity_type,
                map: AdminWorldReviewQueueMap {
                    id: row.map_id,
                    title: row.map_title,
                },
                node: AdminWorldReviewQueueNode {
                    id: row.node_id,
                    title: row.node_title,
                },
            })
            .collect(),
        pagination: AdminWorldReviewQueuePagination {
            current_page,
            last_page,
            per_page: page.per_page,
            total,
        },
    }))
}

fn empty_page(page: AdminWorldReviewQueuePageRequest) -> AdminWorldReviewQueuePage {
    AdminWorldReviewQueuePage {
        items: vec![],
        pagination: AdminWorldReviewQueuePagination {
            current_page: 1,
            last_page: 1,
            per_page: page.per_page,
            total: 0,
        },
    }
}

async fn scope_allows_map(
    pool: &PgPool,
    scope: &str,
    map: &MapScopeRow,
    principal_id: Uuid,
) -> Result<bool, sqlx::Error> {
    if scope == "all"
        || (permission_scope_allows(scope, "own")
            && map.created_by_principal_id == Some(principal_id))
    {
        return Ok(true);
    }

    let direct_editor = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups \
         INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id \
         WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)",
    )
    .bind(map.id)
    .bind(principal_id)
    .fetch_one(pool)
    .await?;

    // As in the existing selected-node reader, an explicit editing-group
    // assignment is a map-level grant and remains effective independently of
    // broad all/own role scope.
    Ok(direct_editor)
}

#[cfg(test)]
mod tests {
    use wicked_learning_application::admin_world_review_queue::AdminWorldReviewQueuePageRequest;

    use super::empty_page;

    #[test]
    fn empty_scoped_queue_keeps_the_requested_page_size() {
        let queue = empty_page(AdminWorldReviewQueuePageRequest {
            page: 8,
            per_page: 12,
        });

        assert_eq!(queue.pagination.current_page, 1);
        assert_eq!(queue.pagination.per_page, 12);
        assert!(queue.items.is_empty());
    }
}
