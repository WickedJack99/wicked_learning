use serde::Serialize;

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
    pub assets: Vec<PublicMapAsset>,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicMapAsset {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub x: f64,
    pub y: f64,
    pub interaction_mode: String,
}
