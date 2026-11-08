use serde_json::Value;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_world_node_starts::{
    AdminWorldNodeStarts, AdminWorldNodeStartsError,
    AdminWorldNodeStartsRepository as AdminWorldNodeStartsRepositoryPort, StartRouteDirection,
    StartRouteForm,
};
use wicked_learning_domain::{
    identity_access::{AuthorizedPrincipal, permission_scope_allows},
    world_content::AdminActivityStartRoute,
};

const MEDIA_ASSET_CONTENT_PREFIX: &str = "/api/v1/admin/media-assets/";
const MEDIA_REFERENCE_KIND: &str = "activity_start";

pub struct PostgresAdminWorldNodeStartsRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldNodeStartsRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl AdminWorldNodeStartsRepositoryPort for PostgresAdminWorldNodeStartsRepository<'_> {
    fn add_start(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>,
    > + Send {
        async move {
            match add_start(self.pool, principal, node_id, activity_id).await {
                Ok(starts) => Ok(starts),
                Err(AddStartError::InvalidActivity) => {
                    Err(AdminWorldNodeStartsError::InvalidActivity)
                }
                Err(AddStartError::Storage(error)) => {
                    tracing::error!(%error, "could not add the scoped World Builder start route");
                    Err(AdminWorldNodeStartsError::Unavailable)
                }
            }
        }
    }

    fn remove_starts(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Option<Uuid>,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>,
    > + Send {
        async move {
            remove_starts(self.pool, principal, node_id, activity_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not remove the scoped World Builder start routes");
                    AdminWorldNodeStartsError::Unavailable
                })
        }
    }

    fn update_start(
        &self,
        principal: &AuthorizedPrincipal,
        start_route_id: Uuid,
        form: &StartRouteForm,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>,
    > + Send {
        async move {
            update_start(self.pool, principal, start_route_id, form)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not update the scoped World Builder start route");
                    AdminWorldNodeStartsError::Unavailable
                })
        }
    }

    fn reorder_start(
        &self,
        principal: &AuthorizedPrincipal,
        start_route_id: Uuid,
        direction: StartRouteDirection,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>,
    > + Send {
        async move {
            reorder_start(self.pool, principal, start_route_id, direction)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not reorder the scoped World Builder start route");
                    AdminWorldNodeStartsError::Unavailable
                })
        }
    }

    fn delete_start(
        &self,
        principal: &AuthorizedPrincipal,
        start_route_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>,
    > + Send {
        async move {
            delete_start(self.pool, principal, start_route_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not delete the scoped World Builder start route");
                    AdminWorldNodeStartsError::Unavailable
                })
        }
    }
}

#[derive(FromRow)]
struct ScopedNode {
    id: Uuid,
    map_asset_id: Option<Uuid>,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
}

#[derive(FromRow)]
struct ScopedStart {
    id: Uuid,
    node_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
}

#[derive(FromRow)]
struct ActivityEligibility {
    activity_type: String,
    config: Value,
}

#[derive(FromRow)]
struct StartRow {
    id: Uuid,
    activity_id: Uuid,
    label: String,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    button_color_dark: Option<String>,
    button_border_color_dark: Option<String>,
    button_color_light: Option<String>,
    button_border_color_light: Option<String>,
    sort_order: i16,
}

enum AddStartError {
    InvalidActivity,
    Storage(sqlx::Error),
}

impl From<sqlx::Error> for AddStartError {
    fn from(error: sqlx::Error) -> Self {
        Self::Storage(error)
    }
}

async fn add_start(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    activity_id: Uuid,
) -> Result<Option<AdminWorldNodeStarts>, AddStartError> {
    let mut transaction = pool.begin().await?;
    let Some(node) = lock_editable_node(&mut transaction, principal, node_id).await? else {
        return Ok(None);
    };
    let Some(activity) = sqlx::query_as::<_, ActivityEligibility>(
        "SELECT activities.activity_type, activities.activity_config AS config FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE activities.id = $1 AND routes.map_asset_id = $2",
    )
    .bind(activity_id)
    .bind(node.map_asset_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    if activity.activity_type == "portal"
        && activity
            .config
            .get("portalMode")
            .and_then(Value::as_str)
            .is_some_and(|mode| mode == "input")
    {
        return Err(AddStartError::InvalidActivity);
    }

    let next_sort_order: i16 = sqlx::query_scalar(
        "SELECT (COALESCE(MAX(sort_order), 0)::integer + 10)::smallint FROM learning_activity_starts WHERE node_id = $1",
    )
    .bind(node.id)
    .fetch_one(&mut *transaction)
    .await?;
    sqlx::query(
        "INSERT INTO learning_activity_starts (node_id, activity_id, sort_order) VALUES ($1, $2, $3) ON CONFLICT (node_id, activity_id) DO NOTHING",
    )
    .bind(node.id)
    .bind(activity_id)
    .bind(next_sort_order)
    .execute(&mut *transaction)
    .await?;

    synchronize_legacy_start(&mut transaction, node.id).await?;
    let starts = load_starts(&mut transaction, node.id).await?;
    let start_activity_id = load_start_activity_id(&mut transaction, node.id).await?;
    transaction.commit().await?;

    Ok(Some(AdminWorldNodeStarts {
        start_activity_id,
        start_routes: starts,
    }))
}

async fn remove_starts(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    activity_id: Option<Uuid>,
) -> Result<Option<AdminWorldNodeStarts>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(node) = lock_editable_node(&mut transaction, principal, node_id).await? else {
        return Ok(None);
    };
    sqlx::query(
        "DELETE FROM reusable_media_asset_references WHERE owner_kind = $1 AND owner_id IN (SELECT id FROM learning_activity_starts WHERE node_id = $2 AND ($3::uuid IS NULL OR activity_id = $3))",
    )
    .bind(MEDIA_REFERENCE_KIND)
    .bind(node.id)
    .bind(activity_id)
    .execute(&mut *transaction)
    .await?;
    if let Some(activity_id) = activity_id {
        sqlx::query("DELETE FROM learning_activity_starts WHERE node_id = $1 AND activity_id = $2")
            .bind(node.id)
            .bind(activity_id)
            .execute(&mut *transaction)
            .await?;
    } else {
        sqlx::query("DELETE FROM learning_activity_starts WHERE node_id = $1")
            .bind(node.id)
            .execute(&mut *transaction)
            .await?;
    }
    synchronize_legacy_start(&mut transaction, node.id).await?;
    let starts = load_starts(&mut transaction, node.id).await?;
    let start_activity_id = load_start_activity_id(&mut transaction, node.id).await?;
    transaction.commit().await?;

    Ok(Some(AdminWorldNodeStarts {
        start_activity_id,
        start_routes: starts,
    }))
}

async fn update_start(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    start_route_id: Uuid,
    form: &StartRouteForm,
) -> Result<Option<AdminWorldNodeStarts>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(start) = lock_editable_start(&mut transaction, principal, start_route_id).await?
    else {
        return Ok(None);
    };
    sqlx::query(
        "UPDATE learning_activity_starts SET label = $2, description = $3, image_dark = $4, image_light = $5, button_color_dark = $6, button_border_color_dark = $7, button_color_light = $8, button_border_color_light = $9, updated_at = NOW() WHERE id = $1",
    )
    .bind(start.id)
    .bind(&form.label)
    .bind(&form.description)
    .bind(&form.image_dark)
    .bind(&form.image_light)
    .bind(&form.button_color_dark)
    .bind(&form.button_border_color_dark)
    .bind(&form.button_color_light)
    .bind(&form.button_border_color_light)
    .execute(&mut *transaction)
    .await?;
    synchronize_media_references(&mut transaction, start.id, form).await?;
    let result = load_node_starts(&mut transaction, start.node_id).await?;
    transaction.commit().await?;
    Ok(Some(result))
}

async fn reorder_start(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    start_route_id: Uuid,
    direction: StartRouteDirection,
) -> Result<Option<AdminWorldNodeStarts>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(start) = lock_editable_start(&mut transaction, principal, start_route_id).await?
    else {
        return Ok(None);
    };
    let mut start_ids = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learning_activity_starts WHERE node_id = $1 ORDER BY sort_order ASC, id ASC FOR UPDATE",
    )
    .bind(start.node_id)
    .fetch_all(&mut *transaction)
    .await?;
    let Some(current_index) = start_ids.iter().position(|id| *id == start.id) else {
        return Ok(None);
    };
    let target_index = match direction {
        StartRouteDirection::Up => current_index.checked_sub(1),
        StartRouteDirection::Down => {
            (current_index + 1 < start_ids.len()).then_some(current_index + 1)
        }
    };
    if let Some(target_index) = target_index {
        let moved = start_ids.remove(current_index);
        start_ids.insert(target_index, moved);
        for (index, route_id) in start_ids.iter().enumerate() {
            sqlx::query(
                "UPDATE learning_activity_starts SET sort_order = $2, updated_at = NOW() WHERE id = $1",
            )
            .bind(route_id)
            .bind(((index + 1) * 10) as i16)
            .execute(&mut *transaction)
            .await?;
        }
        synchronize_legacy_start(&mut transaction, start.node_id).await?;
    }
    let result = load_node_starts(&mut transaction, start.node_id).await?;
    transaction.commit().await?;
    Ok(Some(result))
}

async fn delete_start(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    start_route_id: Uuid,
) -> Result<Option<AdminWorldNodeStarts>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(start) = lock_editable_start(&mut transaction, principal, start_route_id).await?
    else {
        return Ok(None);
    };
    sqlx::query(
        "DELETE FROM reusable_media_asset_references WHERE owner_kind = $1 AND owner_id = $2",
    )
    .bind(MEDIA_REFERENCE_KIND)
    .bind(start.id)
    .execute(&mut *transaction)
    .await?;
    sqlx::query("DELETE FROM learning_activity_starts WHERE id = $1")
        .bind(start.id)
        .execute(&mut *transaction)
        .await?;
    synchronize_legacy_start(&mut transaction, start.node_id).await?;
    let result = load_node_starts(&mut transaction, start.node_id).await?;
    transaction.commit().await?;
    Ok(Some(result))
}

async fn lock_editable_node(
    transaction: &mut Transaction<'_, Postgres>,
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
        "SELECT nodes.id, nodes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE nodes.id = $1 FOR UPDATE OF nodes",
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
    if !permitted {
        return Ok(None);
    }

    Ok(Some(node))
}

async fn lock_editable_start(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    start_route_id: Uuid,
) -> Result<Option<ScopedStart>, sqlx::Error> {
    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut **transaction)
    .await?
    else {
        return Ok(None);
    };
    let Some(start) = sqlx::query_as::<_, ScopedStart>(
        "SELECT starts.id, starts.node_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id FROM learning_activity_starts AS starts INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE starts.id = $1 FOR UPDATE OF starts, nodes",
    )
    .bind(start_route_id)
    .fetch_optional(&mut **transaction)
    .await?
    else {
        return Ok(None);
    };
    let direct_editor: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)",
    )
    .bind(start.map_id)
    .bind(principal_id)
    .fetch_one(&mut **transaction)
    .await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(None);
    };
    let permitted = scope == "all"
        || (permission_scope_allows(scope, "own") && start.map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_editor)
        || direct_editor;
    Ok(permitted.then_some(start))
}

async fn synchronize_legacy_start(
    transaction: &mut Transaction<'_, Postgres>,
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

async fn load_starts(
    transaction: &mut Transaction<'_, Postgres>,
    node_id: Uuid,
) -> Result<Vec<AdminActivityStartRoute>, sqlx::Error> {
    let rows: Vec<StartRow> = sqlx::query_as(
        "SELECT starts.id, starts.activity_id, COALESCE(starts.label, routes.title) AS label, starts.description, starts.image_dark, starts.image_light, starts.button_color_dark, starts.button_border_color_dark, starts.button_color_light, starts.button_border_color_light, starts.sort_order FROM learning_activity_starts AS starts INNER JOIN learning_activities AS activities ON activities.id = starts.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE starts.node_id = $1 AND (activities.activity_type <> 'portal' OR activities.activity_config ->> 'portalMode' IS DISTINCT FROM 'input') ORDER BY starts.sort_order ASC, starts.id ASC",
    )
    .bind(node_id)
    .fetch_all(&mut **transaction)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| AdminActivityStartRoute {
            id: row.id,
            activity_id: row.activity_id,
            label: row.label,
            description: row.description,
            image_dark: row.image_dark,
            image_light: row.image_light,
            button_color_dark: row.button_color_dark,
            button_border_color_dark: row.button_border_color_dark,
            button_color_light: row.button_color_light,
            button_border_color_light: row.button_border_color_light,
            sort_order: row.sort_order,
        })
        .collect())
}

async fn load_start_activity_id(
    transaction: &mut Transaction<'_, Postgres>,
    node_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT start_activity_id FROM learning_nodes WHERE id = $1")
        .bind(node_id)
        .fetch_optional(&mut **transaction)
        .await
        .map(|id| id.flatten())
}

async fn load_node_starts(
    transaction: &mut Transaction<'_, Postgres>,
    node_id: Uuid,
) -> Result<AdminWorldNodeStarts, sqlx::Error> {
    Ok(AdminWorldNodeStarts {
        start_activity_id: load_start_activity_id(transaction, node_id).await?,
        start_routes: load_starts(transaction, node_id).await?,
    })
}

fn media_references(form: &StartRouteForm) -> Vec<(Uuid, &'static str)> {
    [
        (form.image_dark.as_deref(), "image_dark"),
        (form.image_light.as_deref(), "image_light"),
    ]
    .into_iter()
    .filter_map(|(url, field_key)| {
        let asset_id = url?
            .strip_prefix(MEDIA_ASSET_CONTENT_PREFIX)?
            .strip_suffix("/content")?;
        Uuid::parse_str(asset_id)
            .ok()
            .map(|asset_id| (asset_id, field_key))
    })
    .collect()
}

async fn synchronize_media_references(
    transaction: &mut Transaction<'_, Postgres>,
    start_route_id: Uuid,
    form: &StartRouteForm,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM reusable_media_asset_references WHERE owner_kind = $1 AND owner_id = $2",
    )
    .bind(MEDIA_REFERENCE_KIND)
    .bind(start_route_id)
    .execute(&mut **transaction)
    .await?;
    for (asset_id, field_key) in media_references(form) {
        sqlx::query("INSERT INTO reusable_media_asset_references (asset_id, owner_kind, owner_id, field_key) SELECT id, $2, $3, $4 FROM reusable_media_assets WHERE id = $1 ON CONFLICT DO NOTHING")
            .bind(asset_id)
            .bind(MEDIA_REFERENCE_KIND)
            .bind(start_route_id)
            .bind(field_key)
            .execute(&mut **transaction)
            .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;
    use wicked_learning_application::admin_world_node_starts::StartRouteForm;

    use super::media_references;

    #[test]
    fn finds_only_exact_reusable_route_visual_urls() {
        let dark = Uuid::new_v4();
        let light = Uuid::new_v4();
        let form = StartRouteForm::parse(
            None,
            None,
            Some(&format!("/api/v1/admin/media-assets/{dark}/content")),
            Some(&format!("/api/v1/admin/media-assets/{light}/content")),
            None,
            None,
            None,
            None,
        )
        .expect("valid route visual form");

        assert_eq!(
            media_references(&form),
            vec![(dark, "image_dark"), (light, "image_light")]
        );

        let unmanaged = StartRouteForm::parse(
            None,
            None,
            Some("https://example.test/visual.svg"),
            Some(&format!("/api/v1/admin/media-assets/{light}/thumbnail")),
            None,
            None,
            None,
            None,
        )
        .expect("valid unmanaged route visual form");
        assert!(media_references(&unmanaged).is_empty());
    }
}
