use axum::{
    Json,
    extract::{Path, State},
};
use serde::Serialize;
use sqlx::FromRow;

use crate::{AppState, error::ApiError};

#[derive(Serialize)]
pub struct PublicPageResponse {
    pub slug: String,
    pub title: String,
    pub body: String,
}

#[derive(FromRow)]
struct PublicPageRow {
    slug: String,
    title: String,
    body: String,
}

pub async fn show(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<PublicPageResponse>, ApiError> {
    if !is_valid_slug(&slug) {
        return Err(ApiError::not_found());
    }

    let page = sqlx::query_as::<_, PublicPageRow>(
        "SELECT slug, title, body FROM public_pages WHERE slug = $1 AND published_at IS NOT NULL LIMIT 1",
    )
    .bind(slug)
    .fetch_optional(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?
    .ok_or_else(ApiError::not_found)?;

    Ok(Json(PublicPageResponse {
        slug: page.slug,
        title: page.title,
        body: page.body,
    }))
}

fn is_valid_slug(slug: &str) -> bool {
    !slug.is_empty()
        && slug.len() <= 80
        && slug.bytes().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == b'-'
        })
}

#[cfg(test)]
mod tests {
    use super::is_valid_slug;

    #[test]
    fn public_page_slugs_are_bounded_lowercase_identifiers() {
        assert!(is_valid_slug("about"));
        assert!(is_valid_slug("data-protection"));
        assert!(!is_valid_slug("About"));
        assert!(!is_valid_slug("../about"));
        assert!(!is_valid_slug(""));
    }
}
