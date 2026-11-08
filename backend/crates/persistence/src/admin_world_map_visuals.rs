use serde_json::{Map, Value};
use sqlx::{FromRow, PgPool, Postgres, Transaction, types::Json};
use uuid::Uuid;
use wicked_learning_application::admin_world_map_visuals::{
    AdminWorldMapVisualsError, AdminWorldMapVisualsRepository as Port, UpdateWorldMapVisualsForm,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

const MEDIA_ASSET_CONTENT_PREFIX: &str = "/api/v1/admin/media-assets/";
const MEDIA_REFERENCE_KIND: &str = "map";

pub struct PostgresAdminWorldMapVisualsRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldMapVisualsRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldMapVisualsRepository<'_> {
    fn update_map_visuals(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &UpdateWorldMapVisualsForm,
    ) -> impl std::future::Future<Output = Result<Option<Value>, AdminWorldMapVisualsError>> + Send
    {
        async move {
            update(self.pool, principal, map_id, form)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not update scoped World Builder map visuals");
                    AdminWorldMapVisualsError::Unavailable
                })
        }
    }
}

#[derive(FromRow)]
struct ScopedMap {
    creator_id: Option<Uuid>,
    background_config: Value,
}

async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_id: Uuid,
    form: &UpdateWorldMapVisualsForm,
) -> Result<Option<Value>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut transaction, principal).await? else {
        return Ok(None);
    };
    let Some(map) = sqlx::query_as::<_, ScopedMap>(
        "SELECT created_by_principal_id AS creator_id, background_config FROM learning_maps WHERE id = $1 FOR UPDATE",
    )
    .bind(map_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    if !editable(
        &mut transaction,
        principal,
        principal_id,
        map_id,
        map.creator_id,
    )
    .await?
    {
        return Ok(None);
    }

    let background_config = merge_config(map.background_config, &form.background_config);
    sqlx::query(
        "UPDATE learning_maps SET background_config = $2, updated_at = NOW() WHERE id = $1",
    )
    .bind(map_id)
    .bind(Json(&background_config))
    .execute(&mut *transaction)
    .await?;
    synchronize_media_references(&mut transaction, map_id, &background_config).await?;
    transaction.commit().await?;
    Ok(Some(background_config))
}

async fn principal_id(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(&mut **transaction)
        .await
}

async fn editable(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    creator_id: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)")
        .bind(map_id)
        .bind(principal_id)
        .fetch_one(&mut **transaction)
        .await?;
    let Some(scope) = principal.permission_scope("world_maps", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct)
        || direct)
}

/// Laravel's SubmittedConfigMerger recursively updates known object fields,
/// clears explicit empty/null scalar values and replaces the decorative-assets
/// array as one authored collection.
fn merge_config(existing: Value, incoming: &Value) -> Value {
    let mut merged = existing.as_object().cloned().unwrap_or_default();
    let Some(incoming) = incoming.as_object() else {
        return Value::Object(merged);
    };
    for (key, value) in incoming {
        match value {
            Value::Array(_) => {
                merged.insert(key.clone(), value.clone());
            }
            Value::Object(_) => {
                let nested = merge_config(
                    merged
                        .remove(key)
                        .unwrap_or_else(|| Value::Object(Map::new())),
                    value,
                );
                if nested.as_object().is_none_or(Map::is_empty) {
                    continue;
                }
                merged.insert(key.clone(), nested);
            }
            Value::Null => {
                merged.remove(key);
            }
            Value::String(value) if value.is_empty() => {
                merged.remove(key);
            }
            _ => {
                merged.insert(key.clone(), value.clone());
            }
        }
    }
    Value::Object(merged)
}

fn media_references(config: &Value) -> Vec<(Uuid, String)> {
    fn visit(value: &Value, path: String, references: &mut Vec<(Uuid, String)>, depth: usize) {
        if depth > 16 {
            return;
        }
        match value {
            Value::Object(values) => {
                for (key, value) in values {
                    let path = if path.is_empty() {
                        key.clone()
                    } else {
                        format!("{path}.{key}")
                    };
                    visit(value, path, references, depth + 1);
                }
            }
            Value::Array(values) => {
                for (index, value) in values.iter().enumerate() {
                    visit(value, format!("{path}[{index}]"), references, depth + 1);
                }
            }
            Value::String(value) => {
                let Some(path_without_prefix) = value.strip_prefix(MEDIA_ASSET_CONTENT_PREFIX)
                else {
                    return;
                };
                let Some((asset_id, suffix)) = path_without_prefix.split_once('/') else {
                    return;
                };
                if suffix == "content" && path.len() <= 160 {
                    if let Ok(asset_id) = Uuid::parse_str(asset_id) {
                        references.push((asset_id, path));
                    }
                }
            }
            _ => {}
        }
    }

    let mut references = vec![];
    visit(config, String::new(), &mut references, 0);
    references
}

async fn synchronize_media_references(
    transaction: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    config: &Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM reusable_media_asset_references WHERE owner_kind = $1 AND owner_id = $2",
    )
    .bind(MEDIA_REFERENCE_KIND)
    .bind(map_id)
    .execute(&mut **transaction)
    .await?;
    for (asset_id, field_key) in media_references(config) {
        sqlx::query("INSERT INTO reusable_media_asset_references (asset_id, owner_kind, owner_id, field_key) SELECT id, $2, $3, $4 FROM reusable_media_assets WHERE id = $1 ON CONFLICT DO NOTHING")
            .bind(asset_id)
            .bind(MEDIA_REFERENCE_KIND)
            .bind(map_id)
            .bind(field_key)
            .execute(&mut **transaction)
            .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;

    use super::{media_references, merge_config};

    #[test]
    fn applies_the_source_merge_and_decorative_asset_replacement_rules() {
        let merged = merge_config(
            json!({"dark":{"accentColor":"#000","assets":[{"id":"old"}],"preserved":"yes"}}),
            &json!({"dark":{"accentColor":"","assets":[{"id":"new"}]}}),
        );

        assert!(merged["dark"].get("accentColor").is_none());
        assert_eq!(merged["dark"]["assets"][0]["id"], "new");
        assert_eq!(merged["dark"]["preserved"], "yes");
    }

    #[test]
    fn finds_managed_reusable_visuals_in_map_background_and_decorative_layers() {
        let image = Uuid::new_v4();
        let layer = Uuid::new_v4();
        assert_eq!(
            media_references(&json!({
                "dark": {
                    "imageUrl": format!("/api/v1/admin/media-assets/{image}/content"),
                    "assets": [{"imageUrl": format!("/api/v1/admin/media-assets/{layer}/content")}]
                }
            })),
            vec![
                (layer, "dark.assets[0].imageUrl".to_owned()),
                (image, "dark.imageUrl".to_owned()),
            ],
        );
    }
}
