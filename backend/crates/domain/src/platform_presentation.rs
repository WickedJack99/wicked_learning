use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct PublicPage {
    pub slug: String,
    pub title: String,
    pub body: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicSourceLink {
    pub label: String,
    pub url: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct PublicSourceLinks {
    pub origin: PublicSourceLink,
    pub modified_sources: Vec<PublicSourceLink>,
}
