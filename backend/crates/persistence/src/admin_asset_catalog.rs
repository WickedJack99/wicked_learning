use std::future::Future;

use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_asset_catalog::{
    AdminAssetCatalogError, AdminAssetCatalogRepository, ItemForm, ToolForm,
};
use wicked_learning_domain::world_content::{AdminEditableItem, AdminEditableTool};

const MEDIA_ASSET_CONTENT_PREFIX: &str = "/api/v1/admin/media-assets/";

pub struct PostgresAdminAssetCatalogRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminAssetCatalogRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl AdminAssetCatalogRepository for PostgresAdminAssetCatalogRepository<'_> {
    fn list_items(
        &self,
    ) -> impl Future<Output = Result<Vec<AdminEditableItem>, AdminAssetCatalogError>> + Send {
        async move { list_items(self.pool).await.map_err(map_error) }
    }

    fn create_item(
        &self,
        form: &ItemForm,
    ) -> impl Future<Output = Result<AdminEditableItem, AdminAssetCatalogError>> + Send {
        async move { create_item(self.pool, form).await.map_err(map_error) }
    }

    fn update_item(
        &self,
        id: Uuid,
        form: &ItemForm,
    ) -> impl Future<Output = Result<Option<AdminEditableItem>, AdminAssetCatalogError>> + Send
    {
        async move { update_item(self.pool, id, form).await.map_err(map_error) }
    }

    fn list_tools(
        &self,
    ) -> impl Future<Output = Result<Vec<AdminEditableTool>, AdminAssetCatalogError>> + Send {
        async move { list_tools(self.pool).await.map_err(map_error) }
    }

    fn create_tool(
        &self,
        form: &ToolForm,
    ) -> impl Future<Output = Result<AdminEditableTool, AdminAssetCatalogError>> + Send {
        async move { create_tool(self.pool, form).await.map_err(map_error) }
    }

    fn update_tool(
        &self,
        id: Uuid,
        form: &ToolForm,
    ) -> impl Future<Output = Result<Option<AdminEditableTool>, AdminAssetCatalogError>> + Send
    {
        async move { update_tool(self.pool, id, form).await.map_err(map_error) }
    }
}

#[derive(FromRow)]
struct ItemRow {
    id: Uuid,
    slug: String,
    title: String,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    config: Value,
}

#[derive(FromRow)]
struct ToolRow {
    id: Uuid,
    slug: String,
    title: String,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    animation_dark: Option<String>,
    animation_light: Option<String>,
    config: Value,
    created_at: String,
    updated_at: String,
}

fn item(row: ItemRow) -> AdminEditableItem {
    AdminEditableItem {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        image_dark: row.image_dark,
        image_light: row.image_light,
        config: row.config,
    }
}

fn tool(row: ToolRow) -> AdminEditableTool {
    let animation_duration_seconds = row
        .config
        .get("animationDurationSeconds")
        .and_then(Value::as_f64);
    let animation_width_percent = row
        .config
        .get("animationWidthPercent")
        .and_then(Value::as_f64);
    let image_width_percent = row
        .config
        .get("imageWidthPercent")
        .and_then(Value::as_f64)
        .unwrap_or(16.0);
    AdminEditableTool {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        image_dark: row.image_dark,
        image_light: row.image_light,
        animation_dark: row.animation_dark,
        animation_light: row.animation_light,
        animation_duration_seconds,
        animation_width_percent,
        config: row.config,
        created_at: row.created_at,
        image_width_percent,
        updated_at: row.updated_at,
    }
}

fn map_error(error: sqlx::Error) -> AdminAssetCatalogError {
    if matches!(error, sqlx::Error::Protocol(_)) {
        return AdminAssetCatalogError::Invalid;
    }
    if error
        .as_database_error()
        .and_then(|database| database.code())
        .is_some_and(|code| code == "23505")
    {
        AdminAssetCatalogError::Conflict
    } else {
        tracing::error!(%error, "could not mutate reusable item and tool catalog");
        AdminAssetCatalogError::Unavailable
    }
}

async fn list_items(pool: &PgPool) -> Result<Vec<AdminEditableItem>, sqlx::Error> {
    let rows = sqlx::query_as::<_, ItemRow>("SELECT id, slug, title, description, image_dark, image_light, config FROM learning_items ORDER BY title ASC, id ASC").fetch_all(pool).await?;
    Ok(rows.into_iter().map(item).collect())
}

async fn list_tools(pool: &PgPool) -> Result<Vec<AdminEditableTool>, sqlx::Error> {
    let rows = sqlx::query_as::<_, ToolRow>("SELECT id, slug, title, description, image_dark, image_light, animation_dark, animation_light, config, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_tools ORDER BY title ASC, id ASC").fetch_all(pool).await?;
    Ok(rows.into_iter().map(tool).collect())
}

async fn create_item(pool: &PgPool, form: &ItemForm) -> Result<AdminEditableItem, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    assert_title_available(&mut transaction, "learning_items", &form.title, None).await?;
    let slug = unique_slug(
        &mut transaction,
        "learning_items",
        form.slug.as_deref(),
        &form.title,
        None,
    )
    .await?;
    let row = sqlx::query_as::<_, ItemRow>("INSERT INTO learning_items (id, slug, title, description, image_dark, image_light, config, published_at) VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, NOW()) RETURNING id, slug, title, description, image_dark, image_light, config")
        .bind(Uuid::new_v4()).bind(slug).bind(&form.title).bind(&form.description).bind(&form.image_dark).bind(&form.image_light).fetch_one(&mut *transaction).await?;
    synchronize_media_references(
        &mut transaction,
        "learning_item",
        row.id,
        item_references(&row),
    )
    .await?;
    transaction.commit().await?;
    Ok(item(row))
}

async fn update_item(
    pool: &PgPool,
    id: Uuid,
    form: &ItemForm,
) -> Result<Option<AdminEditableItem>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learning_items WHERE id = $1 FOR UPDATE)",
    )
    .bind(id)
    .fetch_one(&mut *transaction)
    .await?;
    if !exists {
        transaction.commit().await?;
        return Ok(None);
    }
    assert_title_available(&mut transaction, "learning_items", &form.title, Some(id)).await?;
    let slug = unique_slug(
        &mut transaction,
        "learning_items",
        form.slug.as_deref(),
        &form.title,
        Some(id),
    )
    .await?;
    let row = sqlx::query_as::<_, ItemRow>("UPDATE learning_items SET slug = $2, title = $3, description = $4, image_dark = $5, image_light = $6, updated_at = NOW() WHERE id = $1 RETURNING id, slug, title, description, image_dark, image_light, config")
        .bind(id).bind(slug).bind(&form.title).bind(&form.description).bind(&form.image_dark).bind(&form.image_light).fetch_one(&mut *transaction).await?;
    synchronize_media_references(&mut transaction, "learning_item", id, item_references(&row))
        .await?;
    transaction.commit().await?;
    Ok(Some(item(row)))
}

async fn create_tool(pool: &PgPool, form: &ToolForm) -> Result<AdminEditableTool, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    assert_title_available(&mut transaction, "learning_tools", &form.title, None).await?;
    let slug = unique_slug(
        &mut transaction,
        "learning_tools",
        form.slug.as_deref(),
        &form.title,
        None,
    )
    .await?;
    let config = created_tool_config(form);
    let row = sqlx::query_as::<_, ToolRow>("INSERT INTO learning_tools (id, slug, title, description, image_dark, image_light, animation_dark, animation_light, config, published_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING id, slug, title, description, image_dark, image_light, animation_dark, animation_light, config, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at")
        .bind(Uuid::new_v4()).bind(slug).bind(&form.title).bind(&form.description).bind(&form.image_dark).bind(&form.image_light).bind(&form.animation_dark).bind(&form.animation_light).bind(config).fetch_one(&mut *transaction).await?;
    synchronize_media_references(
        &mut transaction,
        "learning_tool",
        row.id,
        tool_references(&row),
    )
    .await?;
    transaction.commit().await?;
    Ok(tool(row))
}

async fn update_tool(
    pool: &PgPool,
    id: Uuid,
    form: &ToolForm,
) -> Result<Option<AdminEditableTool>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(existing_config) = sqlx::query_scalar::<_, Value>(
        "SELECT config FROM learning_tools WHERE id = $1 FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    assert_title_available(&mut transaction, "learning_tools", &form.title, Some(id)).await?;
    let slug = unique_slug(
        &mut transaction,
        "learning_tools",
        form.slug.as_deref(),
        &form.title,
        Some(id),
    )
    .await?;
    let config = updated_tool_config(existing_config, form);
    let row = sqlx::query_as::<_, ToolRow>("UPDATE learning_tools SET slug = $2, title = $3, description = $4, image_dark = $5, image_light = $6, animation_dark = $7, animation_light = $8, config = $9, updated_at = NOW() WHERE id = $1 RETURNING id, slug, title, description, image_dark, image_light, animation_dark, animation_light, config, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at")
        .bind(id).bind(slug).bind(&form.title).bind(&form.description).bind(&form.image_dark).bind(&form.image_light).bind(&form.animation_dark).bind(&form.animation_light).bind(config).fetch_one(&mut *transaction).await?;
    synchronize_media_references(&mut transaction, "learning_tool", id, tool_references(&row))
        .await?;
    transaction.commit().await?;
    Ok(Some(tool(row)))
}

fn created_tool_config(form: &ToolForm) -> Value {
    json!({ "animationDurationSeconds": form.animation_duration_seconds, "animationWidthPercent": form.animation_width_percent, "animationStrategy": "uploaded-asset", "futureFrameSequenceSupport": true, "imageWidthPercent": form.image_width_percent.unwrap_or(16.0) })
}

fn updated_tool_config(mut existing: Value, form: &ToolForm) -> Value {
    let Value::Object(ref mut object) = existing else {
        return created_tool_config(form);
    };
    object.insert(
        "animationDurationSeconds".to_owned(),
        json!(form.animation_duration_seconds),
    );
    object.insert(
        "animationWidthPercent".to_owned(),
        json!(form.animation_width_percent),
    );
    object.insert("animationStrategy".to_owned(), json!("uploaded-asset"));
    object.insert("futureFrameSequenceSupport".to_owned(), json!(true));
    object.insert(
        "imageWidthPercent".to_owned(),
        json!(form.image_width_percent.unwrap_or(16.0)),
    );
    existing
}

async fn assert_title_available(
    transaction: &mut Transaction<'_, Postgres>,
    table: &str,
    title: &str,
    excluded: Option<Uuid>,
) -> Result<(), sqlx::Error> {
    let statement = match table {
        "learning_items" => {
            "SELECT EXISTS (SELECT 1 FROM learning_items WHERE title = $1 AND ($2::uuid IS NULL OR id <> $2))"
        }
        "learning_tools" => {
            "SELECT EXISTS (SELECT 1 FROM learning_tools WHERE title = $1 AND ($2::uuid IS NULL OR id <> $2))"
        }
        _ => unreachable!(),
    };
    if sqlx::query_scalar::<_, bool>(statement)
        .bind(title)
        .bind(excluded)
        .fetch_one(&mut **transaction)
        .await?
    {
        return Err(sqlx::Error::Protocol(
            "catalog title already exists".to_owned(),
        ));
    }
    Ok(())
}

async fn unique_slug(
    transaction: &mut Transaction<'_, Postgres>,
    table: &str,
    explicit: Option<&str>,
    title: &str,
    excluded: Option<Uuid>,
) -> Result<String, sqlx::Error> {
    let base = explicit.map(str::to_owned).unwrap_or_else(|| {
        slugify(
            title,
            if table == "learning_items" {
                "item"
            } else {
                "tool"
            },
        )
    });
    for suffix in 1..=10_000 {
        let candidate = if suffix == 1 {
            base.clone()
        } else {
            format!("{base}-{suffix}")
        };
        let statement = match table {
            "learning_items" => {
                "SELECT EXISTS (SELECT 1 FROM learning_items WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2))"
            }
            "learning_tools" => {
                "SELECT EXISTS (SELECT 1 FROM learning_tools WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2))"
            }
            _ => unreachable!(),
        };
        let exists = sqlx::query_scalar::<_, bool>(statement)
            .bind(&candidate)
            .bind(excluded)
            .fetch_one(&mut **transaction)
            .await?;
        if !exists {
            return Ok(candidate);
        }
        if explicit.is_some() {
            return Err(sqlx::Error::Protocol(
                "catalog slug already exists".to_owned(),
            ));
        }
    }
    Err(sqlx::Error::Protocol(
        "could not allocate a catalog slug".to_owned(),
    ))
}

fn slugify(value: &str, fallback: &str) -> String {
    let slug = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();
    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        fallback.to_owned()
    } else {
        slug.to_owned()
    }
}

fn asset_id(value: &str) -> Option<Uuid> {
    value
        .strip_prefix(MEDIA_ASSET_CONTENT_PREFIX)?
        .strip_suffix("/content")
        .and_then(|id| Uuid::parse_str(id).ok())
}

fn item_references(row: &ItemRow) -> Vec<(Uuid, &'static str)> {
    [
        (row.image_dark.as_deref(), "image_dark"),
        (row.image_light.as_deref(), "image_light"),
    ]
    .into_iter()
    .filter_map(|(value, field)| value.and_then(asset_id).map(|id| (id, field)))
    .collect()
}

fn tool_references(row: &ToolRow) -> Vec<(Uuid, &'static str)> {
    [
        (row.image_dark.as_deref(), "image_dark"),
        (row.image_light.as_deref(), "image_light"),
        (row.animation_dark.as_deref(), "animation_dark"),
        (row.animation_light.as_deref(), "animation_light"),
    ]
    .into_iter()
    .filter_map(|(value, field)| value.and_then(asset_id).map(|id| (id, field)))
    .collect()
}

async fn synchronize_media_references(
    transaction: &mut Transaction<'_, Postgres>,
    owner_kind: &str,
    owner_id: Uuid,
    references: Vec<(Uuid, &'static str)>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM reusable_media_asset_references WHERE owner_kind = $1 AND owner_id = $2",
    )
    .bind(owner_kind)
    .bind(owner_id)
    .execute(&mut **transaction)
    .await?;
    for (asset_id, field_key) in references {
        sqlx::query("INSERT INTO reusable_media_asset_references (asset_id, owner_kind, owner_id, field_key) SELECT id, $2, $3, $4 FROM reusable_media_assets WHERE id = $1 ON CONFLICT DO NOTHING").bind(asset_id).bind(owner_kind).bind(owner_id).bind(field_key).execute(&mut **transaction).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::slugify;

    #[test]
    fn derives_source_compatible_catalog_slugs() {
        assert_eq!(slugify("Compass!", "item"), "compass");
        assert_eq!(slugify("---", "tool"), "tool");
    }
}
