use serde::Serialize;
use serde_json::Value;

#[derive(Clone, Debug, Serialize)]
pub struct PublicWorld {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub maps: Vec<PublicMap>,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicMap {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub background_config: Value,
    pub grid_config: Value,
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
    pub visual_config: Value,
    pub interaction_config: Value,
    pub interaction_mode: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicNode {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub q: i32,
    pub r: i32,
    pub state: String,
    pub visual_config: Value,
}
