use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::{
    admin_world_portal::{
        AdminWorldPortalError, AdminWorldPortalRepository as Port, CreatedPortalActivity,
        PortalActivityForm, PortalAssetForm, UpdatedPortalActivity,
    },
    admin_world_reflection::generated_slug,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

use crate::admin_world_activity_history::record_activity_version;

const MEDIA_ASSET_CONTENT_PREFIX: &str = "/api/v1/admin/media-assets/";
const MEDIA_REFERENCE_KIND: &str = "activity";
const MAX_MEDIA_REFERENCES: usize = 44;

pub struct PostgresAdminWorldPortalRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldPortalRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldPortalRepository<'_> {
    fn create_portal(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &PortalActivityForm,
    ) -> impl std::future::Future<
        Output = Result<Option<CreatedPortalActivity>, AdminWorldPortalError>,
    > + Send {
        async move {
            create(self.pool, principal, node_id, form)
                .await
                .map_err(map_error)
        }
    }

    fn update_portal(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &PortalActivityForm,
        expected_updated_at: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<UpdatedPortalActivity>, AdminWorldPortalError>,
    > + Send {
        async move {
            update(self.pool, principal, activity_id, form, expected_updated_at)
                .await
                .map_err(map_error)
        }
    }
}

#[derive(FromRow)]
struct ScopedNode {
    map_asset_id: Option<Uuid>,
    map_creator_id: Option<Uuid>,
    map_id: Uuid,
    node_id: Uuid,
    node_title: String,
    world_id: Uuid,
}

#[derive(FromRow)]
struct ScopedPortalActivity {
    config: Value,
    introduction: Option<String>,
    map_asset_id: Uuid,
    map_creator_id: Option<Uuid>,
    map_id: Uuid,
    node_id: Uuid,
    node_title: String,
    portal_link_target_activity_id: Option<Uuid>,
    slug: String,
    title: String,
    updated_at: String,
    world_id: Uuid,
}

#[derive(FromRow)]
struct PortalTarget {
    activity_id: Uuid,
    node_id: Uuid,
    node_title: String,
    title: String,
}

enum MutationError {
    Invalid,
    Conflict,
    Storage(sqlx::Error),
}

impl From<sqlx::Error> for MutationError {
    fn from(error: sqlx::Error) -> Self {
        Self::Storage(error)
    }
}

fn map_error(error: MutationError) -> AdminWorldPortalError {
    match error {
        MutationError::Invalid => AdminWorldPortalError::InvalidActivity,
        MutationError::Conflict => AdminWorldPortalError::Conflict,
        MutationError::Storage(error) => {
            tracing::error!(%error, "could not mutate scoped World Builder Portal activity");
            AdminWorldPortalError::Unavailable
        }
    }
}

async fn create(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    form: &PortalActivityForm,
) -> Result<Option<CreatedPortalActivity>, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(node) = lock_editable_node(&mut transaction, principal, node_id).await? else {
        return Ok(None);
    };
    let Some(map_asset_id) = node.map_asset_id else {
        return Ok(None);
    };
    let Some(route_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learning_routes WHERE map_asset_id = $1 ORDER BY position ASC, id ASC LIMIT 1 FOR UPDATE",
    )
    .bind(map_asset_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    let target = resolve_target(&mut transaction, node.world_id, node.node_id, form).await?;
    let slug = unique_slug(&mut transaction, map_asset_id, form, None).await?;
    let position: i16 = sqlx::query_scalar(
        "SELECT (COALESCE(MAX(position), -1)::integer + 1)::smallint FROM learning_activities WHERE route_id = $1",
    )
    .bind(route_id)
    .fetch_one(&mut *transaction)
    .await?;
    let activity_id = Uuid::new_v4();
    let config = portal_config(form);
    sqlx::query(
        "INSERT INTO learning_activities (id, route_id, slug, title, description, position, published_at, activity_type, activity_config, introduction, graph_position_x, graph_position_y, ai_review_status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'portal', $7, $8, $9, $10, 'needs_review')",
    )
    .bind(activity_id)
    .bind(route_id)
    .bind(&slug)
    .bind(&form.title)
    .bind(form.introduction.clone().unwrap_or_default())
    .bind(position)
    .bind(&config)
    .bind(&form.introduction)
    .bind(form.graph_position_x.map(f64::from))
    .bind(form.graph_position_y.map(f64::from))
    .execute(&mut *transaction)
    .await?;
    synchronize_portal_link(
        &mut transaction,
        activity_id,
        &node,
        &form.title,
        target.as_ref(),
    )
    .await?;
    synchronize_media_references(&mut transaction, activity_id, &config).await?;
    transaction.commit().await?;
    Ok(Some(CreatedPortalActivity {
        activity_id,
        config,
        slug,
    }))
}

async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    form: &PortalActivityForm,
    expected_updated_at: &str,
) -> Result<Option<UpdatedPortalActivity>, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(current) = lock_editable_portal(&mut transaction, principal, activity_id).await?
    else {
        return Ok(None);
    };
    if current.updated_at != expected_updated_at {
        return Err(MutationError::Conflict);
    }
    let node = ScopedNode {
        map_asset_id: Some(current.map_asset_id),
        map_creator_id: current.map_creator_id,
        map_id: current.map_id,
        node_id: current.node_id,
        node_title: current.node_title.clone(),
        world_id: current.world_id,
    };
    let target = resolve_target(&mut transaction, current.world_id, current.node_id, form).await?;
    let slug = unique_slug(
        &mut transaction,
        current.map_asset_id,
        form,
        Some(activity_id),
    )
    .await?;
    let mut config = current.config.clone();
    let object = config.as_object_mut().ok_or(MutationError::Invalid)?;
    for (key, value) in portal_config(form)
        .as_object()
        .expect("Portal config is always an object")
    {
        object.insert(key.clone(), value.clone());
    }
    let unchanged = current.slug == slug
        && current.title == form.title
        && current.introduction == form.introduction
        && current.config == config
        && current.portal_link_target_activity_id
            == target.as_ref().map(|target| target.activity_id);
    synchronize_portal_link(
        &mut transaction,
        activity_id,
        &node,
        &form.title,
        target.as_ref(),
    )
    .await?;
    synchronize_media_references(&mut transaction, activity_id, &config).await?;
    if unchanged {
        transaction.commit().await?;
        return Ok(Some(UpdatedPortalActivity {
            activity_id,
            updated_at: current.updated_at,
        }));
    }
    record_activity_version(&mut transaction, activity_id, principal).await?;
    let updated_at: String = sqlx::query_scalar(
        "UPDATE learning_activities SET slug = $2, title = $3, description = $4, introduction = $5, activity_config = $6, ai_review_status = 'needs_review', ai_reviewed_at = NULL, ai_review = NULL, updated_at = NOW() WHERE id = $1 RETURNING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')",
    )
    .bind(activity_id)
    .bind(slug)
    .bind(&form.title)
    .bind(form.introduction.clone().unwrap_or_default())
    .bind(&form.introduction)
    .bind(config)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(UpdatedPortalActivity {
        activity_id,
        updated_at,
    }))
}

fn portal_config(form: &PortalActivityForm) -> Value {
    json!({
        "portalMode": form.mode.as_str(),
        "portalBackgroundDark": form.background_dark,
        "portalBackgroundLight": form.background_light,
        "portalBackgroundMirrored": form.background_mirrored,
        "portalAssets": form.assets.iter().map(portal_asset_json).collect::<Vec<_>>(),
        "portalDurationSeconds": form.duration_seconds,
        "portalForegroundDark": form.foreground_dark,
        "portalForegroundLight": form.foreground_light,
        "portalForegroundMirrored": form.foreground_mirrored,
        "portalForegroundWidth": form.foreground_width,
        "portalForegroundX": form.foreground_x,
        "portalForegroundY": form.foreground_y,
        "portalShowOnArrival": form.show_on_arrival,
        "portalSwirlEnabled": form.swirl_enabled,
        "portalBubbleText": form.bubble_text,
        "portalBubbleTypingSpeed": form.bubble_typing_speed,
        "portalBubbleColorDark": form.bubble_color_dark,
        "portalBubbleColorLight": form.bubble_color_light,
        "portalBubbleBorderColorDark": form.bubble_border_color_dark,
        "portalBubbleBorderColorLight": form.bubble_border_color_light,
        "portalBubbleTextColorDark": form.bubble_text_color_dark,
        "portalBubbleTextColorLight": form.bubble_text_color_light,
        "portalWaitForEnter": form.wait_for_enter,
    })
}

fn portal_asset_json(asset: &PortalAssetForm) -> Value {
    json!({
        "id": asset.id,
        "imageDark": asset.image_dark,
        "imageLight": asset.image_light,
        "label": asset.label,
        "layer": asset.layer,
        "mirrored": asset.mirrored,
        "opacity": asset.opacity,
        "width": asset.width,
        "x": asset.x,
        "y": asset.y,
    })
}

async fn resolve_target(
    transaction: &mut Transaction<'_, Postgres>,
    world_id: Uuid,
    source_node_id: Uuid,
    form: &PortalActivityForm,
) -> Result<Option<PortalTarget>, MutationError> {
    let Some(target_activity_id) = form.target_portal_activity_id else {
        return Ok(None);
    };
    let target = sqlx::query_as::<_, PortalTarget>(
        "SELECT activities.id AS activity_id, nodes.id AS node_id, nodes.title AS node_title, activities.title FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 AND maps.world_id = $2 AND activities.activity_type = 'portal' AND activities.activity_config ->> 'portalMode' = 'input' FOR UPDATE OF activities, nodes",
    )
    .bind(target_activity_id)
    .bind(world_id)
    .fetch_optional(&mut **transaction)
    .await?
    .filter(|target| target.node_id != source_node_id)
    .ok_or(MutationError::Invalid)?;
    Ok(Some(target))
}

async fn synchronize_portal_link(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
    source_node: &ScopedNode,
    source_title: &str,
    target: Option<&PortalTarget>,
) -> Result<(), sqlx::Error> {
    let Some(target) = target else {
        sqlx::query("DELETE FROM learning_portal_links WHERE source_activity_id = $1")
            .bind(activity_id)
            .execute(&mut **transaction)
            .await?;
        return Ok(());
    };
    sqlx::query(
        "INSERT INTO learning_portal_links (source_activity_id, target_activity_id, source_node_id, target_node_id, label, description) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (source_activity_id) DO UPDATE SET target_activity_id = EXCLUDED.target_activity_id, source_node_id = EXCLUDED.source_node_id, target_node_id = EXCLUDED.target_node_id, label = EXCLUDED.label, description = EXCLUDED.description, updated_at = NOW()",
    )
    .bind(activity_id)
    .bind(target.activity_id)
    .bind(source_node.node_id)
    .bind(target.node_id)
    .bind(format!("{source_title} to {}", target.title))
    .bind(format!("Travel from {} to {}.", source_node.node_title, target.node_title))
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

fn media_references(config: &Value) -> Vec<(Uuid, String)> {
    let Some(object) = config.as_object() else {
        return vec![];
    };
    let mut fields = vec![
        ("portalBackgroundDark", "portalBackgroundDark".to_owned()),
        ("portalBackgroundLight", "portalBackgroundLight".to_owned()),
        ("portalForegroundDark", "portalForegroundDark".to_owned()),
        ("portalForegroundLight", "portalForegroundLight".to_owned()),
    ];
    let mut references = Vec::new();
    for (key, field) in fields.drain(..) {
        if let Some(asset_id) = reusable_media_id(object.get(key).and_then(Value::as_str)) {
            references.push((asset_id, field));
        }
    }
    for (index, asset) in object
        .get("portalAssets")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .enumerate()
    {
        for key in ["imageDark", "imageLight"] {
            if let Some(asset_id) = reusable_media_id(asset.get(key).and_then(Value::as_str)) {
                references.push((asset_id, format!("portalAssets[{index}].{key}")));
                if references.len() == MAX_MEDIA_REFERENCES {
                    return references;
                }
            }
        }
    }
    references.truncate(MAX_MEDIA_REFERENCES);
    references
}

fn reusable_media_id(value: Option<&str>) -> Option<Uuid> {
    let value = value?;
    let remainder = value.strip_prefix(MEDIA_ASSET_CONTENT_PREFIX)?;
    let id = remainder.strip_suffix("/content")?;
    Uuid::parse_str(id).ok()
}

async fn synchronize_media_references(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
    config: &Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM reusable_media_asset_references WHERE owner_kind = $1 AND owner_id = $2",
    )
    .bind(MEDIA_REFERENCE_KIND)
    .bind(activity_id)
    .execute(&mut **transaction)
    .await?;
    for (asset_id, field_key) in media_references(config) {
        sqlx::query("INSERT INTO reusable_media_asset_references (asset_id, owner_kind, owner_id, field_key) SELECT id, $2, $3, $4 FROM reusable_media_assets WHERE id = $1 ON CONFLICT DO NOTHING")
            .bind(asset_id)
            .bind(MEDIA_REFERENCE_KIND)
            .bind(activity_id)
            .bind(field_key)
            .execute(&mut **transaction)
            .await?;
    }
    Ok(())
}

async fn unique_slug(
    transaction: &mut Transaction<'_, Postgres>,
    map_asset_id: Uuid,
    form: &PortalActivityForm,
    excluded_activity_id: Option<Uuid>,
) -> Result<String, MutationError> {
    let base = form
        .slug
        .clone()
        .unwrap_or_else(|| generated_slug(&form.title));
    let mut candidate = base.clone();
    let mut suffix = 2;
    loop {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE routes.map_asset_id = $1 AND activities.slug = $2 AND ($3::uuid IS NULL OR activities.id <> $3))",
        )
        .bind(map_asset_id)
        .bind(&candidate)
        .bind(excluded_activity_id)
        .fetch_one(&mut **transaction)
        .await?;
        if !exists {
            return Ok(candidate);
        }
        if form.slug.is_some() {
            return Err(MutationError::Invalid);
        }
        candidate = format!("{base}-{suffix}");
        if candidate.len() > 140 || suffix > 10_000 {
            return Err(MutationError::Invalid);
        }
        suffix += 1;
    }
}

async fn lock_editable_portal(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
) -> Result<Option<ScopedPortalActivity>, sqlx::Error> {
    let Some(principal_id) = application_principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let Some(activity) = sqlx::query_as::<_, ScopedPortalActivity>(
        "SELECT activities.activity_config AS config, activities.introduction, routes.map_asset_id, maps.created_by_principal_id AS map_creator_id, nodes.map_id, nodes.id AS node_id, nodes.title AS node_title, links.target_activity_id AS portal_link_target_activity_id, activities.slug, activities.title, to_char(activities.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at, maps.world_id FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id LEFT JOIN learning_portal_links AS links ON links.source_activity_id = activities.id WHERE activities.id = $1 AND activities.activity_type = 'portal' FOR UPDATE OF activities, nodes",
    )
    .bind(activity_id)
    .fetch_optional(&mut **transaction)
    .await? else { return Ok(None); };
    Ok(scoped_map_access(
        transaction,
        principal,
        principal_id,
        activity.map_id,
        activity.map_creator_id,
    )
    .await?
    .then_some(activity))
}

async fn lock_editable_node(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
) -> Result<Option<ScopedNode>, sqlx::Error> {
    let Some(principal_id) = application_principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let Some(node) = sqlx::query_as::<_, ScopedNode>(
        "SELECT nodes.map_asset_id, maps.created_by_principal_id AS map_creator_id, nodes.map_id, nodes.id AS node_id, nodes.title AS node_title, maps.world_id FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE nodes.id = $1 FOR UPDATE OF nodes",
    )
    .bind(node_id)
    .fetch_optional(&mut **transaction)
    .await? else { return Ok(None); };
    Ok(scoped_map_access(
        transaction,
        principal,
        principal_id,
        node.map_id,
        node.map_creator_id,
    )
    .await?
    .then_some(node))
}

async fn application_principal_id(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut **transaction)
    .await
}

async fn scoped_map_access(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let direct_editor: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)",
    ).bind(map_id).bind(principal_id).fetch_one(&mut **transaction).await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_editor)
        || direct_editor)
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;

    use super::media_references;

    #[test]
    fn preserves_references_for_every_source_portal_visual() {
        let background = Uuid::new_v4();
        let asset = Uuid::new_v4();
        let config = json!({
            "portalBackgroundDark": format!("/api/v1/admin/media-assets/{background}/content"),
            "portalAssets": [{ "imageLight": format!("/api/v1/admin/media-assets/{asset}/content") }],
        });
        assert_eq!(
            media_references(&config),
            vec![
                (background, "portalBackgroundDark".to_owned()),
                (asset, "portalAssets[0].imageLight".to_owned()),
            ]
        );
    }
}
