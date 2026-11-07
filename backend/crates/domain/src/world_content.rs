use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

/// The source World Builder's read-only graph. This is intentionally separate
/// from `PublicWorld`: an author sees draft content and authoring diagnostics,
/// while a learner must only receive a published, access-filtered projection.
#[derive(Clone, Debug, Serialize)]
pub struct AdminWorldGraph {
    pub world: AdminWorldSummary,
    pub maps: Vec<AdminMapSummary>,
    pub portal_candidates: Vec<AdminPortalCandidate>,
    pub portal_links: Vec<AdminPortalLink>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminWorldSummary {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminMapSummary {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub updated_at: String,
    pub node_count: i64,
    /// AI review state has its own later authoring slice. Keeping this field
    /// source-shaped makes the graph contract forward-compatible without
    /// implying that review queue data is already migrated.
    pub review_count: i64,
    pub access_roles: Vec<String>,
    pub nodes: Vec<AdminNodeSummary>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminNodeSummary {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub activity_review_count: i64,
    pub position: AdminNodePosition,
    pub state: String,
    /// Source-compatible authoring configuration. It is not part of learner
    /// World snapshots.
    pub visual_config: Value,
    /// A later node-authoring slice will calculate the source's complete
    /// reachability diagnostics. Empty means no diagnostic is currently known,
    /// not that browser code may infer an unlock path.
    pub unlock_diagnostics: Vec<AdminUnlockDiagnostic>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminNodePosition {
    pub q: i32,
    pub r: i32,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminUnlockDiagnostic {
    pub id: Uuid,
    pub title: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminPortalCandidate {
    pub map_id: Uuid,
    pub map_title: String,
    #[serde(flatten)]
    pub node: AdminNodeSummary,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminPortalLink {
    /// The Rust schema models a portal link by its unique source activity.
    /// It remains an opaque graph-link identity for the browser.
    pub id: Uuid,
    pub label: Option<String>,
    pub description: Option<String>,
    pub source_map_id: Uuid,
    pub target_map_id: Uuid,
    pub source_activity: Option<AdminPortalActivity>,
    pub target_activity: Option<AdminPortalActivity>,
    pub source_node: AdminNodeSummary,
    pub target_node: AdminNodeSummary,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminPortalActivity {
    pub id: Uuid,
    pub title: String,
    pub activity_type: String,
}

/// The selected-map payload consumed by the original World Builder map
/// configuration components. It is intentionally an authoring-only projection
/// and may include unpublished assets and nodes.
#[derive(Clone, Debug, Serialize)]
pub struct AdminEditableMap {
    pub can_delete_world_maps: bool,
    pub editable_map: AdminEditableMapDocument,
    pub access_groups: Vec<AdminMapAccessGroup>,
    pub items: Vec<AdminEditableItem>,
    pub learning_groups: Vec<AdminEditableLearningGroup>,
    pub role_options: Vec<AdminRoleOption>,
    pub topic_options: Vec<AdminTopicOption>,
    pub tools: Vec<AdminEditableTool>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminEditableMapDocument {
    pub world: AdminWorldSummary,
    pub map: AdminEditableMapSummary,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminEditableMapSummary {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub updated_at: String,
    pub node_count: i64,
    pub review_count: i64,
    pub access_roles: Vec<String>,
    pub nodes: Vec<AdminNodeSummary>,
    pub background_config: Value,
    pub editing_group_ids: Vec<Uuid>,
    pub grid_config: Value,
    pub map_assets_locked: bool,
    pub topic_id: Option<Uuid>,
    pub map_assets: Vec<AdminEditableMapAsset>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminEditableMapAsset {
    pub id: Uuid,
    pub node_id: Option<Uuid>,
    pub image_url: Option<String>,
    pub text: Option<String>,
    pub x: f64,
    pub y: f64,
    pub z: i32,
    pub width: f64,
    pub opacity: f64,
    pub locked: bool,
    /// The source carries this legacy flag alongside its richer interaction
    /// mode. The greenfield schema owns only interaction mode, so decorative
    /// assets are the sole non-focusable mode.
    pub focusable: bool,
    pub interaction_mode: String,
    pub interaction_config: Value,
    pub visual_config: Value,
    pub sound_config: Value,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminMapAccessGroup {
    pub description: Option<String>,
    pub label: String,
    pub slug: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminEditableLearningGroup {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminRoleOption {
    pub name: String,
    pub slug: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminTopicOption {
    pub id: Uuid,
    pub label: String,
    pub title: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminEditableItem {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
    pub description: Option<String>,
    pub image_dark: Option<String>,
    pub image_light: Option<String>,
    pub config: Value,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminEditableTool {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
    pub description: Option<String>,
    pub image_dark: Option<String>,
    pub image_light: Option<String>,
    pub animation_dark: Option<String>,
    pub animation_light: Option<String>,
    pub animation_duration_seconds: Option<f64>,
    pub animation_width_percent: Option<f64>,
    pub config: Value,
    pub created_at: String,
    pub image_width_percent: f64,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicWorld {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub theme_config: Value,
    pub maps: Vec<PublicMap>,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicMap {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub background_config: Value,
    pub grid_config: Value,
    pub map_assets_locked: bool,
    pub assets: Vec<PublicMapAsset>,
    pub nodes: Vec<PublicNode>,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicMapAsset {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub x: f64,
    pub y: f64,
    pub z: i32,
    pub image_url: Option<String>,
    pub text: Option<String>,
    pub width: f64,
    pub opacity: f64,
    pub locked: bool,
    pub visual_config: Value,
    pub interaction_config: Value,
    pub sound_config: Value,
    pub interaction_mode: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicNode {
    /// Internal persistence identity used only by authenticated policy
    /// evaluation. It must never become part of the browser's public graph.
    #[serde(skip)]
    pub id: uuid::Uuid,
    pub asset_slug: Option<String>,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub q: i32,
    pub r: i32,
    pub state: String,
    pub visual_config: Value,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicMapAssetDetail {
    pub world_slug: String,
    pub world_title: String,
    pub map_slug: String,
    pub map_title: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub routes: Vec<PublicRoutePreview>,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicRoutePreview {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub activity_count: i64,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicRouteOutline {
    pub world_slug: String,
    pub world_title: String,
    pub map_slug: String,
    pub map_title: String,
    pub asset_slug: String,
    pub asset_title: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub activities: Vec<PublicActivityOutline>,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicActivityOutline {
    pub slug: String,
    pub title: String,
    pub description: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicSearchResponse {
    pub query: String,
    pub results: Vec<PublicSearchResult>,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicSearchResult {
    pub world_slug: String,
    pub map_slug: String,
    pub map_title: String,
    pub asset_slug: String,
    pub title: String,
    pub description: String,
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use uuid::Uuid;

    use super::PublicNode;

    #[test]
    fn internal_node_identity_is_not_part_of_the_public_graph() {
        let node = PublicNode {
            id: Uuid::nil(),
            asset_slug: Some("first-asset".to_owned()),
            slug: "first-node".to_owned(),
            title: "First node".to_owned(),
            description: "A node used to verify the serialization boundary.".to_owned(),
            q: 2,
            r: -1,
            state: "available".to_owned(),
            visual_config: json!({}),
        };

        let serialized = serde_json::to_value(node).expect("public node serializes");

        assert!(serialized.get("id").is_none());
        assert_eq!(serialized["slug"], "first-node");
    }
}
