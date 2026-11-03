use axum::{
    Json,
    extract::{Query, State},
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::{AppState, error::ApiError};

const MAX_QUERY_CHARACTERS: usize = 80;
const PAGE_SIZE: i64 = 20;

#[derive(Deserialize)]
pub struct PublicSearchQuery {
    q: String,
}

#[derive(Serialize)]
pub struct PublicSearchResponse {
    pub query: String,
    pub results: Vec<PublicSearchResult>,
}

#[derive(Serialize)]
pub struct PublicSearchResult {
    pub world_slug: String,
    pub map_slug: String,
    pub map_title: String,
    pub asset_slug: String,
    pub title: String,
    pub description: String,
}

#[derive(FromRow)]
struct PublicSearchRow {
    world_slug: String,
    map_slug: String,
    map_title: String,
    asset_slug: String,
    title: String,
    description: String,
}

pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<PublicSearchQuery>,
) -> Result<Json<PublicSearchResponse>, ApiError> {
    let query = query.q.trim();
    let query_length = query.chars().count();
    if query_length < 2 || query_length > MAX_QUERY_CHARACTERS {
        return Err(ApiError::invalid_request());
    }
    let escaped_query = escape_like(query);
    let results = sqlx::query_as::<_, PublicSearchRow>(
        r#"
            SELECT
                worlds.slug AS world_slug,
                maps.slug AS map_slug,
                maps.title AS map_title,
                assets.slug AS asset_slug,
                assets.title,
                assets.description
            FROM learning_map_assets AS assets
            INNER JOIN learning_maps AS maps ON maps.id = assets.map_id
            INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id
            WHERE worlds.published_at IS NOT NULL
                AND maps.published_at IS NOT NULL
                AND assets.published_at IS NOT NULL
                AND (assets.title ILIKE '%' || $1 || '%' ESCAPE E'\\'
                    OR assets.description ILIKE '%' || $1 || '%' ESCAPE E'\\')
            ORDER BY maps.position ASC, assets.position_z ASC, assets.slug ASC
            LIMIT $2
        "#,
    )
    .bind(&escaped_query)
    .bind(PAGE_SIZE)
    .fetch_all(&state.application_database)
    .await
    .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(PublicSearchResponse {
        query: query.to_owned(),
        results: results
            .into_iter()
            .map(|result| PublicSearchResult {
                world_slug: result.world_slug,
                map_slug: result.map_slug,
                map_title: result.map_title,
                asset_slug: result.asset_slug,
                title: result.title,
                description: result.description,
            })
            .collect(),
    }))
}

fn escape_like(query: &str) -> String {
    query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

#[cfg(test)]
mod tests {
    use super::escape_like;

    #[test]
    fn search_wildcards_are_treated_as_literal_query_characters() {
        assert_eq!(escape_like("map%_\\"), "map\\%\\_\\\\");
    }
}
