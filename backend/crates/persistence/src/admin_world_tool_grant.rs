use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::{
    admin_world_open_practice::generated_slug,
    admin_world_tool_grant::{
        AdminWorldToolGrantError, AdminWorldToolGrantRepository as Port, CreatedToolGrantActivity,
        ToolGrantActivityForm, UpdatedToolGrantActivity,
    },
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

use crate::admin_world_activity_history::record_activity_version;

const MEDIA_ASSET_CONTENT_PREFIX: &str = "/api/v1/admin/media-assets/";
const MEDIA_REFERENCE_KIND: &str = "activity";
const TOOL_GRANT_MEDIA_FIELDS: [&str; 2] = ["backgroundDark", "backgroundLight"];

pub struct PostgresAdminWorldToolGrantRepository<'pool> {
    pool: &'pool PgPool,
}
impl<'pool> PostgresAdminWorldToolGrantRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldToolGrantRepository<'_> {
    fn create_tool_grant(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &ToolGrantActivityForm,
    ) -> impl std::future::Future<
        Output = Result<Option<CreatedToolGrantActivity>, AdminWorldToolGrantError>,
    > + Send {
        async move {
            create(self.pool, principal, node_id, form)
                .await
                .map_err(map_error)
        }
    }
    fn update_tool_grant(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ToolGrantActivityForm,
        expected_updated_at: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<UpdatedToolGrantActivity>, AdminWorldToolGrantError>,
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
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
}
#[derive(FromRow)]
struct ScopedActivity {
    map_asset_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
    slug: String,
    title: String,
    introduction: Option<String>,
    config: Value,
    updated_at: String,
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
fn map_error(error: MutationError) -> AdminWorldToolGrantError {
    match error {
        MutationError::Invalid => AdminWorldToolGrantError::InvalidActivity,
        MutationError::Conflict => AdminWorldToolGrantError::Conflict,
        MutationError::Storage(error) => {
            tracing::error!(%error, "could not mutate scoped World Builder tool-grant activity");
            AdminWorldToolGrantError::Unavailable
        }
    }
}

async fn create(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    form: &ToolGrantActivityForm,
) -> Result<Option<CreatedToolGrantActivity>, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(node) = lock_node(&mut transaction, principal, node_id).await? else {
        return Ok(None);
    };
    let Some(map_asset_id) = node.map_asset_id else {
        return Ok(None);
    };
    let tool_slug = resolve_tool_slug(&mut transaction, form.tool_id).await?;
    let Some(route_id) = sqlx::query_scalar::<_, Uuid>("SELECT id FROM learning_routes WHERE map_asset_id = $1 ORDER BY position ASC, id ASC LIMIT 1 FOR UPDATE").bind(map_asset_id).fetch_optional(&mut *transaction).await? else { return Ok(None); };
    let slug = unique_slug(&mut transaction, map_asset_id, form, None).await?;
    let position: i16 = sqlx::query_scalar("SELECT (COALESCE(MAX(position), -1)::integer + 1)::smallint FROM learning_activities WHERE route_id = $1").bind(route_id).fetch_one(&mut *transaction).await?;
    let id = Uuid::new_v4();
    let activity_config = config(form, tool_slug);
    sqlx::query("INSERT INTO learning_activities (id, route_id, slug, title, description, position, published_at, activity_type, activity_config, introduction, graph_position_x, graph_position_y, ai_review_status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'tool_grant', $7, $8, $9, $10, 'needs_review')")
        .bind(id).bind(route_id).bind(&slug).bind(&form.title).bind(form.introduction.clone().unwrap_or_default()).bind(position).bind(&activity_config).bind(&form.introduction).bind(form.graph_position_x.map(f64::from)).bind(form.graph_position_y.map(f64::from)).execute(&mut *transaction).await?;
    synchronize_media_references(&mut transaction, id, &activity_config).await?;
    transaction.commit().await?;
    Ok(Some(CreatedToolGrantActivity {
        activity_id: id,
        config: activity_config,
        slug,
    }))
}

async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    form: &ToolGrantActivityForm,
    expected_updated_at: &str,
) -> Result<Option<UpdatedToolGrantActivity>, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(current) = lock_activity(&mut transaction, principal, activity_id).await? else {
        return Ok(None);
    };
    if current.updated_at != expected_updated_at {
        return Err(MutationError::Conflict);
    }
    let tool_slug = resolve_tool_slug(&mut transaction, form.tool_id).await?;
    let slug = unique_slug(
        &mut transaction,
        current.map_asset_id,
        form,
        Some(activity_id),
    )
    .await?;
    let mut config_value = current.config.clone();
    let target = config_value.as_object_mut().ok_or(MutationError::Invalid)?;
    for (key, value) in config(form, tool_slug)
        .as_object()
        .expect("tool-grant config is an object")
    {
        target.insert(key.clone(), value.clone());
    }
    synchronize_media_references(&mut transaction, activity_id, &config_value).await?;
    if current.slug == slug
        && current.title == form.title
        && current.introduction == form.introduction
        && current.config == config_value
    {
        transaction.commit().await?;
        return Ok(Some(UpdatedToolGrantActivity {
            activity_id,
            updated_at: current.updated_at,
        }));
    }
    record_activity_version(&mut transaction, activity_id, principal).await?;
    let updated_at: String = sqlx::query_scalar(
        "UPDATE learning_activities SET slug = $2, title = $3, description = $4, introduction = $5, activity_config = $6, ai_review_status = 'needs_review', ai_reviewed_at = NULL, ai_review = NULL, updated_at = NOW() WHERE id = $1 RETURNING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')",
    )
        .bind(activity_id).bind(slug).bind(&form.title).bind(form.introduction.clone().unwrap_or_default()).bind(&form.introduction).bind(config_value).fetch_one(&mut *transaction).await?;
    transaction.commit().await?;
    Ok(Some(UpdatedToolGrantActivity {
        activity_id,
        updated_at,
    }))
}

async fn resolve_tool_slug(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tool_id: Option<Uuid>,
) -> Result<Option<String>, MutationError> {
    let Some(tool_id) = tool_id else {
        return Ok(None);
    };
    sqlx::query_scalar("SELECT slug FROM learning_tools WHERE id = $1")
        .bind(tool_id)
        .fetch_optional(&mut **transaction)
        .await?
        .ok_or(MutationError::Invalid)
        .map(Some)
}

fn config(form: &ToolGrantActivityForm, tool_slug: Option<String>) -> Value {
    json!({
        "backgroundDark": form.background_dark, "backgroundLight": form.background_light, "backgroundMirrored": form.background_mirrored,
        "bubbleBorderColorDark": form.bubble_border_color_dark, "bubbleBorderColorLight": form.bubble_border_color_light, "bubbleColorDark": form.bubble_color_dark, "bubbleColorLight": form.bubble_color_light,
        "bubbleOpacityDark": form.bubble_opacity_dark, "bubbleOpacityLight": form.bubble_opacity_light, "fadeDurationSeconds": form.fade_duration_seconds, "slideDirection": form.slide_direction, "slideDurationSeconds": form.slide_duration_seconds,
        "text": form.text, "toolId": tool_slug, "toolMirrored": form.tool_mirrored, "toolX": form.tool_x, "toolY": form.tool_y, "typingSpeed": form.typing_speed,
    })
}

fn media_references(config: &Value) -> Vec<(Uuid, &'static str)> {
    let Some(config) = config.as_object() else {
        return vec![];
    };

    TOOL_GRANT_MEDIA_FIELDS
        .iter()
        .filter_map(|field_key| {
            let asset_id = config
                .get(*field_key)?
                .as_str()?
                .strip_prefix(MEDIA_ASSET_CONTENT_PREFIX)?
                .strip_suffix("/content")?;
            Uuid::parse_str(asset_id)
                .ok()
                .map(|asset_id| (asset_id, *field_key))
        })
        .collect()
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
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    map_asset_id: Uuid,
    form: &ToolGrantActivityForm,
    excluded_activity_id: Option<Uuid>,
) -> Result<String, MutationError> {
    let base = form
        .slug
        .clone()
        .unwrap_or_else(|| generated_slug(&form.title));
    let mut candidate = base.clone();
    let mut suffix = 2;
    loop {
        let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE routes.map_asset_id = $1 AND activities.slug = $2 AND ($3::uuid IS NULL OR activities.id <> $3))").bind(map_asset_id).bind(&candidate).bind(excluded_activity_id).fetch_one(&mut **transaction).await?;
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

async fn lock_activity(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
) -> Result<Option<ScopedActivity>, sqlx::Error> {
    let Some(principal_id) = principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let Some(activity) = sqlx::query_as::<_, ScopedActivity>("SELECT routes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id, activities.slug, activities.title, activities.introduction, activities.activity_config AS config, to_char(activities.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 AND activities.activity_type = 'tool_grant' FOR UPDATE OF activities, nodes").bind(activity_id).fetch_optional(&mut **transaction).await? else { return Ok(None); };
    Ok(scoped_access(
        transaction,
        principal,
        principal_id,
        activity.map_id,
        activity.map_creator_id,
    )
    .await?
    .then_some(activity))
}
async fn lock_node(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
) -> Result<Option<ScopedNode>, sqlx::Error> {
    let Some(principal_id) = principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let Some(node) = sqlx::query_as::<_, ScopedNode>("SELECT nodes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE nodes.id = $1 FOR UPDATE OF nodes").bind(node_id).fetch_optional(&mut **transaction).await? else { return Ok(None); };
    Ok(scoped_access(
        transaction,
        principal,
        principal_id,
        node.map_id,
        node.map_creator_id,
    )
    .await?
    .then_some(node))
}
async fn principal_id(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(&mut **transaction)
        .await
}
async fn scoped_access(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let editor: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)").bind(map_id).bind(principal_id).fetch_one(&mut **transaction).await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && editor)
        || editor)
}

#[cfg(test)]
mod tests {
    use super::{config, media_references};
    use serde_json::json;
    use uuid::Uuid;
    use wicked_learning_application::admin_world_tool_grant::ToolGrantActivityForm;
    #[test]
    fn uses_only_the_server_resolved_tool_slug() {
        let form = ToolGrantActivityForm::parse(
            "Grant", None, None, None, None, false, None, None, None, None, 92., 94., 0.4, None,
            0.6, None, None, false, 50., 50., 24.,
        )
        .expect("valid form");
        assert_eq!(
            config(&form, Some("lens".to_owned())).get("toolId"),
            Some(&json!("lens"))
        );
    }

    #[test]
    fn finds_only_exact_reusable_visual_urls_in_grant_background_fields() {
        let dark = Uuid::new_v4();
        let light = Uuid::new_v4();
        let config = json!({
            "backgroundDark": format!("/api/v1/admin/media-assets/{dark}/content"),
            "backgroundLight": format!("/api/v1/admin/media-assets/{light}/content"),
            "text": format!("/api/v1/admin/media-assets/{dark}/content"),
        });

        assert_eq!(
            media_references(&config),
            vec![(dark, "backgroundDark"), (light, "backgroundLight")]
        );
    }
}
