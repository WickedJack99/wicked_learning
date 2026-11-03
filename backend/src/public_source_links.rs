use axum::{Json, extract::State};
use serde::Serialize;
use sqlx::FromRow;

use crate::{AppState, error::ApiError};

#[derive(Serialize)]
pub struct PublicSourceLinksResponse {
    pub origin: PublicSourceLink,
    pub modified_sources: Vec<PublicSourceLink>,
}

#[derive(Serialize)]
pub struct PublicSourceLink {
    pub label: String,
    pub url: String,
}

#[derive(FromRow)]
struct PublicSourceLinkRow {
    label: String,
    url: String,
    is_origin: bool,
}

pub async fn index(
    State(state): State<AppState>,
) -> Result<Json<PublicSourceLinksResponse>, ApiError> {
    let links = sqlx::query_as::<_, PublicSourceLinkRow>(
        "SELECT label, url, is_origin FROM public_source_links ORDER BY position ASC",
    )
    .fetch_all(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?;

    let mut origin = None;
    let mut modified_sources = Vec::new();
    for link in links {
        let response_link = PublicSourceLink {
            label: link.label,
            url: link.url,
        };
        if link.is_origin {
            origin = Some(response_link);
        } else {
            modified_sources.push(response_link);
        }
    }

    Ok(Json(PublicSourceLinksResponse {
        origin: origin.ok_or_else(ApiError::service_unavailable)?,
        modified_sources,
    }))
}
