use std::future::Future;

use serde_json::{Value, json};
use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

use crate::admin_world_map_export_preflight::{MapExportPreflightResult, validate_manifest};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldMapAssetImportError {
    Invalid,
    Unavailable,
}

pub trait AdminWorldMapAssetImportRepository {
    fn import_map_asset(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        manifest: &Value,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldMapAssetImportError>> + Send;
}

pub struct AdminWorldMapAssetImportCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapAssetImportCommand<'repository, Repository>
where
    Repository: AdminWorldMapAssetImportRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        manifest: &[u8],
    ) -> Result<Option<Uuid>, AdminWorldMapAssetImportError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }
        let validation = validate_asset_manifest(manifest);
        if !validation.valid {
            return Ok(None);
        }
        let payload =
            serde_json::from_slice(manifest).map_err(|_| AdminWorldMapAssetImportError::Invalid)?;
        self.repository
            .import_map_asset(principal, map_id, &payload)
            .await
    }
}

/// Validates the standalone source shape by projecting its one optional node
/// and one MapAsset through the established bounded authored-map validator.
/// The projection deliberately has no portal list: portals never transfer with
/// a standalone asset.
pub fn validate_asset_manifest(manifest: &[u8]) -> MapExportPreflightResult {
    let Ok(payload) = serde_json::from_slice::<Value>(manifest) else {
        return invalid_asset("The selected file is not valid JSON.");
    };
    let Some(payload) = payload.as_object() else {
        return invalid_asset("The export must contain a JSON object.");
    };
    if payload.get("format").and_then(Value::as_str) != Some("wicked-learning-map-asset") {
        return invalid_asset("format must be 'wicked-learning-map-asset'.");
    }
    if payload.get("formatVersion").and_then(Value::as_u64) != Some(1) {
        return invalid_asset("formatVersion must be 1.");
    }
    let Some(source) = payload.get("source").and_then(Value::as_object) else {
        return invalid_asset("source must be an object.");
    };
    let Some(world) = source.get("world").and_then(Value::as_object) else {
        return invalid_asset("source.world must be an object.");
    };
    let Some(map) = source.get("map").and_then(Value::as_object) else {
        return invalid_asset("source.map must be an object.");
    };
    let Some(map_asset) = payload.get("mapAsset").and_then(Value::as_object) else {
        return invalid_asset("mapAsset must be an object.");
    };
    let nodes = match payload.get("node") {
        Some(Value::Null) => vec![],
        Some(node @ Value::Object(_)) => vec![node.clone()],
        _ => return invalid_asset("node must be an object or null."),
    };
    let node_slug = nodes
        .first()
        .and_then(|node| node.get("slug"))
        .and_then(Value::as_str);
    let asset_node_slug = map_asset.get("nodeSlug").and_then(Value::as_str);
    if node_slug != asset_node_slug {
        return invalid_asset(
            "mapAsset.nodeSlug must match the exported node, or both must be null.",
        );
    }
    let references = payload
        .get("references")
        .cloned()
        .unwrap_or_else(|| json!({"mediaUrls": []}));
    let projected = json!({
        "format": "wicked-learning-map",
        "formatVersion": 1,
        "world": world,
        "map": map,
        "nodes": nodes,
        "mapAssets": [map_asset],
        "portalTargets": [],
        "references": references,
    });
    validate_manifest(&serde_json::to_vec(&projected).expect("serializable projected manifest"))
}

fn invalid_asset(error: &str) -> MapExportPreflightResult {
    MapExportPreflightResult {
        valid: false,
        summary: "The MapAsset export is not ready for transfer.".to_owned(),
        errors: vec![error.to_owned()],
        warnings: vec![],
        counts: crate::admin_world_map_export_preflight::MapExportPreflightCounts {
            nodes: 0,
            activities: 0,
            map_assets: 0,
            portal_targets: 0,
            media_references: 0,
        },
    }
}

#[cfg(test)]
mod tests {
    use std::{
        future::Future,
        sync::{
            Arc,
            atomic::{AtomicBool, Ordering},
        },
    };

    use super::*;

    struct Repository(Arc<AtomicBool>);

    impl AdminWorldMapAssetImportRepository for Repository {
        fn import_map_asset(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
            _: &Value,
        ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldMapAssetImportError>> + Send
        {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[test]
    fn validates_a_source_shaped_asset_graph_without_portals() {
        let result = validate_asset_manifest(br#"{"format":"wicked-learning-map-asset","formatVersion":1,"source":{"world":{"slug":"world"},"map":{"slug":"map"}},"node":{"slug":"place","activities":[{"slug":"start","type":"markdown","title":"Start","transitions":[],"dialogueNodes":[],"dialogueTransitions":[]}]},"mapAsset":{"nodeSlug":"place"},"references":{"mediaUrls":[]}}"#);

        assert!(result.valid, "{:#?}", result.errors);
        assert_eq!(result.counts.nodes, 1);
        assert_eq!(result.counts.portal_targets, 0);
    }

    #[tokio::test]
    async fn rejects_invalid_asset_manifest_before_calling_the_importer() {
        let called = Arc::new(AtomicBool::new(false));
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:ru:all".to_owned()],
        };

        let imported = AdminWorldMapAssetImportCommand::new(&Repository(called.clone()))
            .execute(&principal, Uuid::new_v4(), br#"{}"#)
            .await
            .expect("validation");

        assert!(imported.is_none());
        assert!(!called.load(Ordering::SeqCst));
    }
}
