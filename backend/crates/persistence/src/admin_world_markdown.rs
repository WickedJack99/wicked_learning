use serde_json::{Map, Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::{
    admin_world_markdown::{
        AdminWorldMarkdownError, AdminWorldMarkdownRepository as Port, CreatedMarkdownActivity,
        MarkdownActivityForm, MarkdownGraphLayout, MarkdownPageForm, MarkdownPosition,
        UpdatedMarkdownActivity,
    },
    admin_world_reflection::generated_slug,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

use crate::admin_world_activity_history::record_activity_version;

const MEDIA_ASSET_CONTENT_PREFIX: &str = "/api/v1/admin/media-assets/";
const MEDIA_REFERENCE_KIND: &str = "activity";
const MAX_MEDIA_REFERENCES: usize = 24;

pub struct PostgresAdminWorldMarkdownRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldMarkdownRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldMarkdownRepository<'_> {
    fn create_markdown(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &MarkdownActivityForm,
    ) -> impl std::future::Future<
        Output = Result<Option<CreatedMarkdownActivity>, AdminWorldMarkdownError>,
    > + Send {
        async move {
            create(self.pool, principal, node_id, form)
                .await
                .map_err(map_error)
        }
    }

    fn update_markdown(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &MarkdownActivityForm,
        expected_updated_at: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<UpdatedMarkdownActivity>, AdminWorldMarkdownError>,
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
struct ScopedMarkdownActivity {
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

fn map_error(error: MutationError) -> AdminWorldMarkdownError {
    match error {
        MutationError::Invalid => AdminWorldMarkdownError::InvalidActivity,
        MutationError::Conflict => AdminWorldMarkdownError::Conflict,
        MutationError::Storage(error) => {
            tracing::error!(%error, "could not mutate scoped World Builder Markdown activity");
            AdminWorldMarkdownError::Unavailable
        }
    }
}

async fn create(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    form: &MarkdownActivityForm,
) -> Result<Option<CreatedMarkdownActivity>, MutationError> {
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
    let slug = unique_slug(&mut transaction, map_asset_id, form, None).await?;
    let position: i16 = sqlx::query_scalar(
        "SELECT (COALESCE(MAX(position), -1)::integer + 1)::smallint FROM learning_activities WHERE route_id = $1",
    )
    .bind(route_id)
    .fetch_one(&mut *transaction)
    .await?;
    let id = Uuid::new_v4();
    let activity_config = markdown_config(form);
    sqlx::query(
        "INSERT INTO learning_activities (id, route_id, slug, title, description, position, published_at, activity_type, activity_config, introduction, graph_position_x, graph_position_y, ai_review_status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'markdown', $7, $8, $9, $10, 'needs_review')",
    )
    .bind(id)
    .bind(route_id)
    .bind(&slug)
    .bind(&form.title)
    .bind(form.introduction.clone().unwrap_or_default())
    .bind(position)
    .bind(&activity_config)
    .bind(&form.introduction)
    .bind(form.graph_position_x.map(f64::from))
    .bind(form.graph_position_y.map(f64::from))
    .execute(&mut *transaction)
    .await?;
    synchronize_media_references(&mut transaction, id, &activity_config).await?;
    transaction.commit().await?;
    Ok(Some(CreatedMarkdownActivity {
        activity_id: id,
        slug,
    }))
}

async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    form: &MarkdownActivityForm,
    expected_updated_at: &str,
) -> Result<Option<UpdatedMarkdownActivity>, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(current) = lock_editable_markdown(&mut transaction, principal, activity_id).await?
    else {
        return Ok(None);
    };
    if current.updated_at != expected_updated_at {
        return Err(MutationError::Conflict);
    }
    let slug = unique_slug(
        &mut transaction,
        current.map_asset_id,
        form,
        Some(activity_id),
    )
    .await?;
    let mut config = current.config.clone();
    let target = config.as_object_mut().ok_or(MutationError::Invalid)?;
    for (key, value) in markdown_config(form)
        .as_object()
        .expect("Markdown config is always an object")
    {
        target.insert(key.clone(), value.clone());
    }
    synchronize_media_references(&mut transaction, activity_id, &config).await?;
    if current.slug == slug
        && current.title == form.title
        && current.introduction == form.introduction
        && current.config == config
    {
        transaction.commit().await?;
        return Ok(Some(UpdatedMarkdownActivity {
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
    Ok(Some(UpdatedMarkdownActivity {
        activity_id,
        updated_at,
    }))
}

pub fn markdown_config(form: &MarkdownActivityForm) -> Value {
    json!({
        "markdownGraphLayout": graph_layout(&form.graph_layout),
        "markdownPages": form.pages.iter().map(page_json).collect::<Vec<_>>(),
        "markdownTransitions": form.transitions.iter().map(|transition| json!({
            "id": transition.id,
            "from": transition.from,
            "to": transition.to,
        })).collect::<Vec<_>>(),
    })
}

fn graph_layout(layout: &MarkdownGraphLayout) -> Value {
    let mut object = Map::new();
    if let Some(position) = &layout.start {
        object.insert("start".to_owned(), position_json(position));
    }
    if let Some(position) = &layout.end {
        object.insert("end".to_owned(), position_json(position));
    }
    Value::Object(object)
}

fn page_json(page: &MarkdownPageForm) -> Value {
    json!({
        "id": page.id,
        "title": page.title,
        "body": page.body,
        "position": position_json(&page.position),
        "visual": {
            "pageColorDark": page.visual.page_color_dark,
            "pageColorLight": page.visual.page_color_light,
            "borderColorDark": page.visual.border_color_dark,
            "borderColorLight": page.visual.border_color_light,
            "headingColorDark": page.visual.heading_color_dark,
            "headingColorLight": page.visual.heading_color_light,
            "textColorDark": page.visual.text_color_dark,
            "textColorLight": page.visual.text_color_light,
        },
    })
}

fn position_json(position: &MarkdownPosition) -> Value {
    json!({ "x": position.x, "y": position.y })
}

fn media_references(config: &Value) -> Vec<(Uuid, String)> {
    let Some(pages) = config.get("markdownPages").and_then(Value::as_array) else {
        return vec![];
    };
    let mut references = Vec::new();
    for (index, page) in pages.iter().enumerate() {
        let Some(body) = page.get("body").and_then(Value::as_str) else {
            continue;
        };
        let mut remaining = body;
        while let Some(prefix_index) = remaining.find(MEDIA_ASSET_CONTENT_PREFIX) {
            let after_prefix = &remaining[prefix_index + MEDIA_ASSET_CONTENT_PREFIX.len()..];
            let Some(asset_id) = after_prefix
                .get(..36)
                .and_then(|value| Uuid::parse_str(value).ok())
            else {
                remaining = &after_prefix[after_prefix.len().min(1)..];
                continue;
            };
            let suffix = &after_prefix[36..];
            if let Some(next) = suffix.strip_prefix("/content") {
                references.push((asset_id, format!("markdownPages[{index}].body")));
                if references.len() == MAX_MEDIA_REFERENCES {
                    return references;
                }
                remaining = next;
            } else {
                remaining = suffix;
            }
        }
    }
    references
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
    form: &MarkdownActivityForm,
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

async fn lock_editable_markdown(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
) -> Result<Option<ScopedMarkdownActivity>, sqlx::Error> {
    let Some(principal_id) = application_principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let Some(activity) = sqlx::query_as::<_, ScopedMarkdownActivity>(
        "SELECT routes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id, activities.slug, activities.title, activities.introduction, activities.activity_config AS config, to_char(activities.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 AND activities.activity_type = 'markdown' FOR UPDATE OF activities, nodes",
    )
    .bind(activity_id)
    .fetch_optional(&mut **transaction)
    .await?
    else {
        return Ok(None);
    };
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
        "SELECT nodes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE nodes.id = $1 FOR UPDATE OF nodes",
    )
    .bind(node_id)
    .fetch_optional(&mut **transaction)
    .await?
    else {
        return Ok(None);
    };
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
    )
    .bind(map_id)
    .bind(principal_id)
    .fetch_one(&mut **transaction)
    .await?;
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
    fn finds_reusable_media_urls_embedded_in_markdown_pages() {
        let asset_id = Uuid::new_v4();
        let config = json!({
            "markdownPages": [{
                "body": format!("![A diagram](/api/v1/admin/media-assets/{asset_id}/content)"),
            }],
        });

        assert_eq!(
            media_references(&config),
            vec![(asset_id, "markdownPages[0].body".to_owned())]
        );
    }
}
