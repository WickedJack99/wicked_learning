use serde_json::{Value, json};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_world_map_asset_export::{
    AdminWorldMapAssetExportError, AdminWorldMapAssetExportRepository as Port,
    ExportedWorldMapAsset,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

use crate::admin_world_map_export::{export_map_payload, exported_at};

pub struct PostgresAdminWorldMapAssetExportRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldMapAssetExportRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldMapAssetExportRepository<'_> {
    fn export_map_asset(
        &self,
        principal: &AuthorizedPrincipal,
        asset_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<ExportedWorldMapAsset>, AdminWorldMapAssetExportError>,
    > + Send {
        async move {
            export_asset(self.pool, principal, asset_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not export scoped World Builder MapAsset");
                    AdminWorldMapAssetExportError
                })
        }
    }
}

#[derive(FromRow)]
struct SourceAsset {
    map_id: Uuid,
    map_slug: String,
    map_title: String,
    world_slug: String,
    world_title: String,
    creator_id: Option<Uuid>,
}

async fn export_asset(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    asset_id: Uuid,
) -> Result<Option<ExportedWorldMapAsset>, sqlx::Error> {
    let Some(asset) = sqlx::query_as::<_, SourceAsset>(
        "SELECT assets.map_id, maps.slug AS map_slug, maps.title AS map_title, worlds.slug AS world_slug, worlds.title AS world_title, maps.created_by_principal_id AS creator_id FROM learning_map_assets AS assets INNER JOIN learning_maps AS maps ON maps.id = assets.map_id INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id WHERE assets.id = $1",
    )
    .bind(asset_id)
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
        return Ok(None);
    };
    let Some(scope) = principal.permission_scope("world_maps", "ru") else {
        return Ok(None);
    };
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)")
        .bind(asset.map_id)
        .bind(principal_id)
        .fetch_one(pool)
        .await?;
    if !(scope == "all"
        || (permission_scope_allows(scope, "own") && asset.creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct)
        || direct)
    {
        return Ok(None);
    }

    // The established exporter supplies the same source graph projection as a
    // map transfer. This extracts one asset and its linked node after the map
    // editor scope has been checked; it never exposes another asset in output.
    let Some(map_payload) = export_map_payload(pool, asset.map_id).await? else {
        return Ok(None);
    };
    let source_asset_id = asset_id.to_string();
    let map_assets = map_payload
        .get("mapAssets")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let Some(map_asset) = map_assets.into_iter().find(|candidate| {
        candidate.get("sourceId").and_then(Value::as_str) == Some(source_asset_id.as_str())
    }) else {
        return Ok(None);
    };
    let node_slug = map_asset.get("nodeSlug").and_then(Value::as_str);
    let node = node_slug.and_then(|slug| {
        map_payload
            .get("nodes")
            .and_then(Value::as_array)
            .and_then(|nodes| {
                nodes
                    .iter()
                    .find(|node| node.get("slug").and_then(Value::as_str) == Some(slug))
            })
            .cloned()
    });
    let filename_base = node
        .as_ref()
        .and_then(|node| node.get("slug"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| format!("map-asset-{asset_id}"));
    let media_urls = crate::admin_world_map_export::collect_media_urls(&json!({
        "node": node,
        "mapAsset": map_asset,
    }));
    Ok(Some(ExportedWorldMapAsset {
        filename: format!("{filename_base}-wicked-learning-asset.json"),
        payload: json!({
            "format": "wicked-learning-map-asset",
            "formatVersion": 1,
            "exportedAt": exported_at(),
            "source": {
                "world": {"slug": asset.world_slug, "title": asset.world_title},
                "map": {"slug": asset.map_slug, "title": asset.map_title},
                "assetId": asset_id,
            },
            "node": node,
            "mapAsset": map_asset,
            "references": {"mediaUrls": media_urls},
        }),
    }))
}
