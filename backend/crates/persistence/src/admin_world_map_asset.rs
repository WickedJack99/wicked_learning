use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction, types::Json};
use uuid::Uuid;
use wicked_learning_application::admin_world_map_asset::{
    AdminWorldMapAssetError, AdminWorldMapAssetRepository as Port, CreatedWorldMapAsset,
    WorldMapAssetForm,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

const MEDIA_ASSET_CONTENT_PREFIX: &str = "/api/v1/admin/media-assets/";
const MEDIA_REFERENCE_KIND: &str = "map_asset";
const MAX_MEDIA_REFERENCES: usize = 48;

pub struct PostgresAdminWorldMapAssetRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldMapAssetRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldMapAssetRepository<'_> {
    fn create_map_asset(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &WorldMapAssetForm,
    ) -> impl std::future::Future<
        Output = Result<Option<CreatedWorldMapAsset>, AdminWorldMapAssetError>,
    > + Send {
        async move {
            create(self.pool, principal, map_id, form)
                .await
                .map_err(unavailable)
        }
    }

    fn update_map_asset(
        &self,
        principal: &AuthorizedPrincipal,
        asset_id: Uuid,
        form: &WorldMapAssetForm,
    ) -> impl std::future::Future<Output = Result<bool, AdminWorldMapAssetError>> + Send {
        async move {
            update(self.pool, principal, asset_id, form)
                .await
                .map_err(unavailable)
        }
    }

    fn delete_map_asset(
        &self,
        principal: &AuthorizedPrincipal,
        asset_id: Uuid,
    ) -> impl std::future::Future<Output = Result<bool, AdminWorldMapAssetError>> + Send {
        async move {
            delete(self.pool, principal, asset_id)
                .await
                .map_err(unavailable)
        }
    }
}

fn unavailable(error: sqlx::Error) -> AdminWorldMapAssetError {
    tracing::error!(%error, "could not mutate scoped World Builder MapAsset");
    AdminWorldMapAssetError::Unavailable
}

#[derive(FromRow)]
struct ScopedMap {
    creator_id: Option<Uuid>,
}

#[derive(FromRow)]
struct ScopedAsset {
    map_id: Uuid,
    creator_id: Option<Uuid>,
}

async fn create(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_id: Uuid,
    form: &WorldMapAssetForm,
) -> Result<Option<CreatedWorldMapAsset>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut tx, principal).await? else {
        return Ok(None);
    };
    let Some(map) = sqlx::query_as::<_, ScopedMap>(
        "SELECT created_by_principal_id AS creator_id FROM learning_maps WHERE id = $1 FOR UPDATE",
    )
    .bind(map_id)
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Ok(None);
    };
    if !editable(&mut tx, principal, principal_id, map_id, map.creator_id).await? {
        return Ok(None);
    }

    let title = form.text.as_deref().unwrap_or("MapAsset");
    let asset_id = Uuid::new_v4();
    let node_id = Uuid::new_v4();
    let route_id = Uuid::new_v4();
    let asset_slug = unique_slug(&mut tx, map_id, "map-asset", "learning_map_assets").await?;
    let node_slug = unique_slug(&mut tx, map_id, "map-asset", "learning_nodes").await?;
    let route_slug = "map-asset";
    let position_q: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(position_q), -1) + 1 FROM learning_nodes WHERE map_id = $1 AND position_r = 0",
    )
    .bind(map_id)
    .fetch_one(&mut *tx)
    .await?;
    let visual_config = normalized_visual_config(&mut tx, &form.visual_config).await?;

    sqlx::query("INSERT INTO learning_map_assets (id, map_id, slug, title, description, image_url, text, position_x, position_y, position_z, interaction_mode, published_at, width, opacity, locked, visual_config, interaction_config, sound_config) VALUES ($1, $2, $3, $4, '', $5, $6, $7, $8, $9, $10, NULL, $11, $12, $13, $14, $15, $16)")
        .bind(asset_id).bind(map_id).bind(asset_slug).bind(title).bind(&form.image_url).bind(&form.text).bind(form.position_x).bind(form.position_y).bind(form.position_z).bind(&form.interaction_mode).bind(form.width).bind(form.opacity).bind(form.locked).bind(Json(&visual_config)).bind(Json(&form.interaction_config)).bind(Json(&form.sound_config)).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO learning_nodes (id, map_id, map_asset_id, slug, title, description, position_q, position_r, state, visual_config, published_at) VALUES ($1, $2, $3, $4, $5, '', $6, 0, 'available', $7, NULL)")
        .bind(node_id).bind(map_id).bind(asset_id).bind(node_slug).bind(title).bind(position_q).bind(Json(&visual_config)).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO learning_routes (id, map_asset_id, slug, title, description, position, published_at) VALUES ($1, $2, $3, $4, '', 0, NULL)")
        .bind(route_id).bind(asset_id).bind(route_slug).bind(title).execute(&mut *tx).await?;
    synchronize_media_references(&mut tx, asset_id, form).await?;
    tx.commit().await?;
    Ok(Some(CreatedWorldMapAsset { asset_id, node_id }))
}

async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    asset_id: Uuid,
    form: &WorldMapAssetForm,
) -> Result<bool, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut tx, principal).await? else {
        return Ok(false);
    };
    let Some(asset) = sqlx::query_as::<_, ScopedAsset>(
        "SELECT assets.map_id, maps.created_by_principal_id AS creator_id FROM learning_map_assets AS assets INNER JOIN learning_maps AS maps ON maps.id = assets.map_id WHERE assets.id = $1 FOR UPDATE OF assets, maps",
    )
    .bind(asset_id)
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Ok(false);
    };
    if !editable(
        &mut tx,
        principal,
        principal_id,
        asset.map_id,
        asset.creator_id,
    )
    .await?
    {
        return Ok(false);
    }
    let visual_config = normalized_visual_config(&mut tx, &form.visual_config).await?;
    sqlx::query("UPDATE learning_map_assets SET image_url = $2, text = $3, position_x = $4, position_y = $5, position_z = $6, width = $7, opacity = $8, locked = $9, interaction_mode = $10, interaction_config = $11, visual_config = $12, sound_config = $13, updated_at = NOW() WHERE id = $1")
        .bind(asset_id).bind(&form.image_url).bind(&form.text).bind(form.position_x).bind(form.position_y).bind(form.position_z).bind(form.width).bind(form.opacity).bind(form.locked).bind(&form.interaction_mode).bind(Json(&form.interaction_config)).bind(Json(&visual_config)).bind(Json(&form.sound_config)).execute(&mut *tx).await?;
    synchronize_media_references(&mut tx, asset_id, form).await?;
    tx.commit().await?;
    Ok(true)
}

async fn normalized_visual_config(
    tx: &mut Transaction<'_, Postgres>,
    visual_config: &Value,
) -> Result<Value, sqlx::Error> {
    let mut normalized = visual_config.clone();
    let Some(sounds) = normalized
        .as_object_mut()
        .and_then(|config| config.get_mut("sounds"))
        .and_then(Value::as_object_mut)
    else {
        return Ok(normalized);
    };

    for trigger in ["mouseEnter", "click", "mouseLeave", "unlock"] {
        let Some(sound) = sounds.get(trigger).and_then(Value::as_object) else {
            continue;
        };
        let enabled = sound
            .get("enabled")
            .and_then(Value::as_bool)
            .expect("sound config was validated by the application form");
        let sound_id = sound.get("soundId").and_then(Value::as_str);
        if enabled && sound_id.is_none() {
            return Err(sqlx::Error::Protocol(
                "an enabled MapAsset interaction sound needs a selected reusable sound".to_owned(),
            ));
        }
        let Some(sound_id) = sound_id else {
            continue;
        };
        let sound_id =
            Uuid::parse_str(sound_id).expect("sound ID was validated by the application form");
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM learning_sounds WHERE id = $1 AND published_at IS NOT NULL)",
        )
        .bind(sound_id)
        .fetch_one(&mut **tx)
        .await?;
        if !exists {
            return Err(sqlx::Error::Protocol(
                "MapAsset interaction sound is unavailable".to_owned(),
            ));
        }
    }
    Ok(normalized)
}

async fn delete(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    asset_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut tx, principal).await? else {
        return Ok(false);
    };
    let Some(asset) = sqlx::query_as::<_, ScopedAsset>(
        "SELECT assets.map_id, maps.created_by_principal_id AS creator_id FROM learning_map_assets AS assets INNER JOIN learning_maps AS maps ON maps.id = assets.map_id WHERE assets.id = $1 FOR UPDATE OF assets, maps",
    )
    .bind(asset_id)
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Ok(false);
    };
    if !editable(
        &mut tx,
        principal,
        principal_id,
        asset.map_id,
        asset.creator_id,
    )
    .await?
    {
        return Ok(false);
    }
    sqlx::query(
        "DELETE FROM reusable_media_asset_references WHERE owner_kind = $1 AND owner_id = $2",
    )
    .bind(MEDIA_REFERENCE_KIND)
    .bind(asset_id)
    .execute(&mut *tx)
    .await?;
    sqlx::query("DELETE FROM learning_map_assets WHERE id = $1")
        .bind(asset_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(true)
}

async fn principal_id(
    tx: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(&mut **tx)
        .await
}

async fn editable(
    tx: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    creator_id: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)")
        .bind(map_id).bind(principal_id).fetch_one(&mut **tx).await?;
    let Some(scope) = principal.permission_scope("world_maps", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct)
        || direct)
}

async fn unique_slug(
    tx: &mut Transaction<'_, Postgres>,
    map_id: Uuid,
    base: &str,
    table: &str,
) -> Result<String, sqlx::Error> {
    for suffix in 1..10_000 {
        let slug = if suffix == 1 {
            base.to_owned()
        } else {
            format!("{base}-{suffix}")
        };
        let exists: bool = match table {
            "learning_map_assets" => sqlx::query_scalar(
                "SELECT EXISTS (SELECT 1 FROM learning_map_assets WHERE map_id = $1 AND slug = $2)",
            )
            .bind(map_id)
            .bind(&slug)
            .fetch_one(&mut **tx)
            .await?,
            _ => {
                sqlx::query_scalar(
                    "SELECT EXISTS (SELECT 1 FROM learning_nodes WHERE map_id = $1 AND slug = $2)",
                )
                .bind(map_id)
                .bind(&slug)
                .fetch_one(&mut **tx)
                .await?
            }
        };
        if !exists {
            return Ok(slug);
        }
    }
    Err(sqlx::Error::Protocol(
        "could not create a unique MapAsset slug".to_owned(),
    ))
}

fn media_references(form: &WorldMapAssetForm) -> Vec<(Uuid, String)> {
    fn visit(value: &Value, path: String, output: &mut Vec<(Uuid, String)>, depth: usize) {
        if output.len() == MAX_MEDIA_REFERENCES || depth > 16 {
            return;
        }
        match value {
            Value::Object(object) => {
                for (key, value) in object {
                    let next = if path.is_empty() {
                        key.to_owned()
                    } else {
                        format!("{path}.{key}")
                    };
                    visit(value, next, output, depth + 1);
                }
            }
            Value::Array(values) => {
                for (index, value) in values.iter().enumerate() {
                    visit(value, format!("{path}[{index}]"), output, depth + 1);
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
                if suffix == "content" && Uuid::parse_str(asset_id).is_ok() && path.len() <= 160 {
                    output.push((Uuid::parse_str(asset_id).expect("checked UUID"), path));
                }
            }
            _ => {}
        }
    }

    let snapshot = json!({
        "image_url": form.image_url,
        "interaction_config": form.interaction_config,
        "visual_config": form.visual_config,
        "sound_config": form.sound_config,
    });
    let mut references = vec![];
    visit(&snapshot, String::new(), &mut references, 0);
    references
}

async fn synchronize_media_references(
    tx: &mut Transaction<'_, Postgres>,
    asset_id: Uuid,
    form: &WorldMapAssetForm,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM reusable_media_asset_references WHERE owner_kind = $1 AND owner_id = $2",
    )
    .bind(MEDIA_REFERENCE_KIND)
    .bind(asset_id)
    .execute(&mut **tx)
    .await?;
    for (media_asset_id, field_key) in media_references(form) {
        sqlx::query("INSERT INTO reusable_media_asset_references (asset_id, owner_kind, owner_id, field_key) SELECT id, $2, $3, $4 FROM reusable_media_assets WHERE id = $1 ON CONFLICT DO NOTHING")
            .bind(media_asset_id).bind(MEDIA_REFERENCE_KIND).bind(asset_id).bind(field_key).execute(&mut **tx).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;
    use wicked_learning_application::admin_world_map_asset::WorldMapAssetForm;

    use super::media_references;

    #[test]
    fn finds_reusable_media_links_across_the_source_asset_surface() {
        let media = Uuid::new_v4();
        let form = WorldMapAssetForm::parse(
            Some(&format!("/api/v1/admin/media-assets/{media}/content")),
            None,
            50.0,
            50.0,
            0,
            14.0,
            1.0,
            false,
            "focusable",
            json!({}),
            json!({"imageUrl": format!("/api/v1/admin/media-assets/{media}/content")}),
            json!({}),
        )
        .expect("valid source-shaped form");
        assert_eq!(
            media_references(&form),
            vec![
                (media, "image_url".to_owned()),
                (media, "visual_config.imageUrl".to_owned())
            ]
        );
    }
}
