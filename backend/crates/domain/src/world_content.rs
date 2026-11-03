use serde::Serialize;
use serde_json::Value;

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
