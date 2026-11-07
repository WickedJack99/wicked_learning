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

/// The selected-node projection consumed by the original World Builder's
/// activity editor. It remains authoring-only and is intentionally separate
/// from any learner route/playback document.
#[derive(Clone, Debug, Serialize)]
pub struct AdminEditableNode {
    pub activity_graph: AdminActivityGraph,
    pub items: Vec<AdminEditableItem>,
    pub sounds: Vec<AdminEditableSound>,
    pub tools: Vec<AdminEditableTool>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityGraph {
    pub world: AdminActivityGraphWorld,
    pub map: AdminActivityGraphMap,
    pub node: AdminActivityGraphNode,
    pub activity_types: Vec<AdminActivityTypeDefinition>,
    pub can_manage_ai_review: bool,
    pub ai_review_templates: Vec<AdminActivityReviewTemplate>,
    pub competence_topic_options: Vec<String>,
    pub evidence_concept_options: Vec<String>,
    /// Exit-portal activities within the selected node's World. This differs
    /// from the overview graph's node-level portal candidates: the original
    /// activity editor links an entry portal to a specific exit activity.
    pub portal_candidates: Vec<AdminActivityPortalCandidate>,
    pub message_topics: Vec<AdminMessageTopicOption>,
    pub source_records: AdminSourceRecordPage,
    pub activities: Vec<AdminEditableActivity>,
    pub transitions: Vec<AdminActivityTransition>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityGraphWorld {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityGraphMap {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityGraphNode {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub graph_layout: Value,
    pub start_activity_id: Option<Uuid>,
    pub start_routes: Vec<AdminActivityStartRoute>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityTypeDefinition {
    pub key: String,
    pub label: String,
    pub description: String,
    pub inputs: Vec<AdminActivityConnector>,
    pub outputs: Vec<AdminActivityConnector>,
    pub portal_modes: Option<Vec<AdminPortalMode>>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityConnector {
    pub id: String,
    pub label: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminPortalMode {
    pub key: String,
    pub label: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityReviewTemplate {
    pub id: Uuid,
    pub model: Option<String>,
    pub name: String,
    pub provider_label: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityPortalCandidate {
    pub id: Uuid,
    pub title: String,
    pub node_id: Uuid,
    pub node_title: String,
    pub map_id: Uuid,
    pub map_title: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminMessageTopicOption {
    pub id: Uuid,
    pub title: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminSourceRecordPage {
    pub items: Vec<AdminSourceRecord>,
    pub pagination: AdminSourceRecordPagination,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminSourceRecordPagination {
    pub current_page: i64,
    pub last_page: i64,
    pub per_page: i64,
    pub total: i64,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminSourceRecord {
    pub id: Uuid,
    pub anchor: Option<String>,
    pub concepts: Vec<String>,
    pub excerpt: Option<String>,
    pub published_at: Option<String>,
    pub publisher: Option<String>,
    pub rights: Option<String>,
    pub title: String,
    pub url: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminEditableActivity {
    pub id: Uuid,
    pub slug: String,
    pub activity_type: String,
    pub title: String,
    pub introduction: Option<String>,
    pub config: Value,
    pub question: Option<Value>,
    pub updated_at: String,
    pub ai_review_status: String,
    pub ai_reviewed_at: Option<String>,
    pub ai_review: Option<Value>,
    pub ai_review_history: Vec<AdminActivityReviewHistoryEntry>,
    pub portal_link: Option<AdminActivityPortalLink>,
    pub position: AdminActivityGraphPosition,
    pub connectors: AdminActivityConnectors,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityReviewHistoryEntry {
    pub id: Uuid,
    pub reviewed_at: Option<String>,
    pub summary: Option<String>,
    pub provider: String,
    pub model: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityPortalLink {
    pub id: Uuid,
    pub label: Option<String>,
    pub description: Option<String>,
    pub target_activity: Option<AdminActivityPortalTargetActivity>,
    pub target_node: AdminActivityPortalTargetNode,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityPortalTargetActivity {
    pub id: Uuid,
    pub title: String,
    pub node_title: String,
    pub map_title: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityPortalTargetNode {
    pub id: Uuid,
    pub title: String,
    pub map_title: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityGraphPosition {
    pub x: Option<f64>,
    pub y: Option<f64>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityConnectors {
    pub inputs: Vec<AdminActivityConnector>,
    pub outputs: Vec<AdminActivityConnector>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityTransition {
    pub id: Uuid,
    pub from_activity_id: Uuid,
    pub to_activity_id: Option<Uuid>,
    pub from_connector: String,
    pub to_connector: String,
    pub trigger: String,
    pub trigger_value: Option<String>,
    pub label: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminActivityStartRoute {
    pub id: Uuid,
    pub activity_id: Uuid,
    pub label: String,
    pub description: Option<String>,
    pub image_dark: Option<String>,
    pub image_light: Option<String>,
    pub button_color_dark: Option<String>,
    pub button_border_color_dark: Option<String>,
    pub button_color_light: Option<String>,
    pub button_border_color_light: Option<String>,
    pub sort_order: i16,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminEditableSound {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub icon: Option<String>,
    pub url: String,
    pub volume: i16,
    pub play_seconds: Option<f64>,
    pub loop_enabled: bool,
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
