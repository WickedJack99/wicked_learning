use std::collections::{HashMap, HashSet};

use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_world_item_grant::{
    AdminWorldItemGrantError, AdminWorldItemGrantRepository as Port, ItemGrantActivityForm,
    ItemGrantItem, UpdatedItemGrantActivity, generated_slug,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

use crate::admin_world_activity_history::record_activity_version;

const MEDIA_ASSET_CONTENT_PREFIX: &str = "/api/v1/admin/media-assets/";
const MEDIA_REFERENCE_KIND: &str = "activity";
const ITEM_GRANT_MEDIA_FIELDS: [&str; 2] = ["backgroundDark", "backgroundLight"];

pub struct PostgresAdminWorldItemGrantRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldItemGrantRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldItemGrantRepository<'_> {
    fn create_item_grant(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &ItemGrantActivityForm,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, AdminWorldItemGrantError>> + Send
    {
        async move {
            create_item_grant(self.pool, principal, node_id, form)
                .await
                .map_err(map_mutation_error)
        }
    }

    fn update_item_grant(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ItemGrantActivityForm,
        expected_updated_at: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<UpdatedItemGrantActivity>, AdminWorldItemGrantError>,
    > + Send {
        async move {
            update_item_grant(self.pool, principal, activity_id, form, expected_updated_at)
                .await
                .map_err(map_mutation_error)
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
struct ScopedItemGrantActivity {
    map_asset_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
    slug: String,
    title: String,
    introduction: Option<String>,
    config: Value,
    updated_at: String,
}

#[derive(FromRow)]
struct CatalogItem {
    id: Uuid,
    slug: String,
}

enum ItemGrantMutationError {
    Invalid,
    Conflict,
    Storage(sqlx::Error),
}

impl From<sqlx::Error> for ItemGrantMutationError {
    fn from(error: sqlx::Error) -> Self {
        Self::Storage(error)
    }
}

fn map_mutation_error(error: ItemGrantMutationError) -> AdminWorldItemGrantError {
    match error {
        ItemGrantMutationError::Invalid => AdminWorldItemGrantError::InvalidActivity,
        ItemGrantMutationError::Conflict => AdminWorldItemGrantError::Conflict,
        ItemGrantMutationError::Storage(error) => {
            tracing::error!(%error, "could not mutate scoped World Builder item-grant activity");
            AdminWorldItemGrantError::Unavailable
        }
    }
}

async fn create_item_grant(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    form: &ItemGrantActivityForm,
) -> Result<Option<Uuid>, ItemGrantMutationError> {
    let mut transaction = pool.begin().await?;
    let Some(node) = lock_editable_node(&mut transaction, principal, node_id).await? else {
        return Ok(None);
    };
    let Some(map_asset_id) = node.map_asset_id else {
        return Ok(None);
    };
    let item_slugs = load_catalog_item_slugs(&mut transaction, &form.items).await?;
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
    let activity_config = item_grant_config(form, &item_slugs);
    sqlx::query(
        "INSERT INTO learning_activities (id, route_id, slug, title, description, position, published_at, activity_type, activity_config, introduction, ai_review_status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'item_grant', $7, $8, 'needs_review')",
    )
    .bind(id)
    .bind(route_id)
    .bind(slug)
    .bind(&form.title)
    .bind(form.introduction.clone().unwrap_or_default())
    .bind(position)
    .bind(&activity_config)
    .bind(&form.introduction)
    .execute(&mut *transaction)
    .await?;
    synchronize_media_references(&mut transaction, id, &activity_config).await?;
    transaction.commit().await?;
    Ok(Some(id))
}

async fn update_item_grant(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    form: &ItemGrantActivityForm,
    expected_updated_at: &str,
) -> Result<Option<UpdatedItemGrantActivity>, ItemGrantMutationError> {
    let mut transaction = pool.begin().await?;
    let Some(current) = lock_editable_item_grant(&mut transaction, principal, activity_id).await?
    else {
        return Ok(None);
    };
    if current.updated_at != expected_updated_at {
        return Err(ItemGrantMutationError::Conflict);
    }
    let item_slugs = load_catalog_item_slugs(&mut transaction, &form.items).await?;
    let slug = unique_slug(
        &mut transaction,
        current.map_asset_id,
        form,
        Some(activity_id),
    )
    .await?;
    let mut config = current.config.clone();
    let config_object = config
        .as_object_mut()
        .ok_or(ItemGrantMutationError::Invalid)?;
    let item_grant_config = item_grant_config(form, &item_slugs);
    for (key, value) in item_grant_config
        .as_object()
        .expect("item-grant configuration is always an object")
    {
        config_object.insert(key.clone(), value.clone());
    }
    synchronize_media_references(&mut transaction, activity_id, &config).await?;
    let unchanged = current.slug == slug
        && current.title == form.title
        && current.introduction == form.introduction
        && current.config == config;
    if unchanged {
        transaction.commit().await?;
        return Ok(Some(UpdatedItemGrantActivity {
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
    Ok(Some(UpdatedItemGrantActivity {
        activity_id,
        updated_at,
    }))
}

/// Resolves the author-facing opaque catalog UUIDs only after the containing
/// node has passed the source World Builder scope check. Playback stores the
/// server-owned item slug, never a browser-provided identifier.
async fn load_catalog_item_slugs(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    items: &[ItemGrantItem],
) -> Result<Vec<String>, ItemGrantMutationError> {
    let item_ids: Vec<Uuid> = items.iter().map(|item| item.item_id).collect();
    let unique_item_ids: HashSet<Uuid> = item_ids.iter().copied().collect();
    if unique_item_ids.is_empty() {
        return Ok(vec![]);
    }
    let catalog_items: Vec<CatalogItem> =
        sqlx::query_as("SELECT id, slug FROM learning_items WHERE id = ANY($1)")
            .bind(&item_ids)
            .fetch_all(&mut **transaction)
            .await?;
    if catalog_items.len() != unique_item_ids.len() {
        return Err(ItemGrantMutationError::Invalid);
    }
    let slugs_by_id: HashMap<Uuid, String> = catalog_items
        .into_iter()
        .map(|item| (item.id, item.slug))
        .collect();
    item_ids
        .into_iter()
        .map(|item_id| {
            slugs_by_id
                .get(&item_id)
                .cloned()
                .ok_or(ItemGrantMutationError::Invalid)
        })
        .collect()
}

fn item_grant_config(form: &ItemGrantActivityForm, item_slugs: &[String]) -> Value {
    json!({
        "backgroundDark": form.background_dark,
        "backgroundLight": form.background_light,
        "backgroundMirrored": form.background_mirrored,
        "items": form.items.iter().zip(item_slugs).map(|(item, item_slug)| json!({
            "itemId": item_slug,
            "quantity": item.quantity,
        })).collect::<Vec<_>>(),
        "probabilityPercent": form.probability_percent,
    })
}

fn media_references(config: &Value) -> Vec<(Uuid, &'static str)> {
    let Some(config) = config.as_object() else {
        return vec![];
    };

    ITEM_GRANT_MEDIA_FIELDS
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
    form: &ItemGrantActivityForm,
    excluded_activity_id: Option<Uuid>,
) -> Result<String, ItemGrantMutationError> {
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
            return Err(ItemGrantMutationError::Invalid);
        }
        candidate = format!("{base}-{suffix}");
        if candidate.len() > 140 || suffix > 10_000 {
            return Err(ItemGrantMutationError::Invalid);
        }
        suffix += 1;
    }
}

async fn lock_editable_item_grant(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
) -> Result<Option<ScopedItemGrantActivity>, sqlx::Error> {
    let Some(principal_id) = application_principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let Some(activity) = sqlx::query_as::<_, ScopedItemGrantActivity>(
        "SELECT routes.map_asset_id, nodes.map_id, maps.created_by_principal_id AS map_creator_id, activities.slug, activities.title, activities.introduction, activities.activity_config AS config, to_char(activities.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 AND activities.activity_type = 'item_grant' FOR UPDATE OF activities, nodes",
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
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
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
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
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
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
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
    use wicked_learning_application::admin_world_item_grant::{
        ItemGrantActivityForm, ItemGrantItem,
    };

    use super::{item_grant_config, media_references};

    #[test]
    fn stores_only_server_resolved_item_slugs_for_playback() {
        let form = ItemGrantActivityForm::parse(
            "Grant",
            None,
            None,
            Some("/media/dark.webp"),
            Some("/media/light.webp"),
            true,
            vec![ItemGrantItem {
                item_id: Uuid::new_v4(),
                quantity: 3,
            }],
            72.5,
        )
        .expect("valid source-shaped item grant form");

        assert_eq!(
            item_grant_config(&form, &["field-notes".to_owned()]),
            json!({
                "backgroundDark": "/media/dark.webp",
                "backgroundLight": "/media/light.webp",
                "backgroundMirrored": true,
                "items": [{"itemId": "field-notes", "quantity": 3}],
                "probabilityPercent": 72.5,
            }),
        );
    }

    #[test]
    fn finds_only_exact_reusable_visual_urls_in_grant_background_fields() {
        let dark = Uuid::new_v4();
        let light = Uuid::new_v4();
        let config = json!({
            "backgroundDark": format!("/api/v1/admin/media-assets/{dark}/content"),
            "backgroundLight": format!("/api/v1/admin/media-assets/{light}/content"),
            "items": [{"itemId": format!("/api/v1/admin/media-assets/{dark}/content")}],
        });

        assert_eq!(
            media_references(&config),
            vec![(dark, "backgroundDark"), (light, "backgroundLight")]
        );
    }
}
