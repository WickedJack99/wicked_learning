use sqlx::{FromRow, PgPool};
use wicked_learning_application::public_search::{
    PublicSearchReadError, PublicSearchRepository as PublicSearchRepositoryPort, PublicSearchTerm,
};
use wicked_learning_domain::world_content::{PublicSearchResponse, PublicSearchResult};

const PAGE_SIZE: i64 = 20;

pub struct PostgresPublicSearchRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresPublicSearchRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl PublicSearchRepositoryPort for PostgresPublicSearchRepository<'_> {
    fn search_published(
        &self,
        term: &PublicSearchTerm,
    ) -> impl std::future::Future<Output = Result<PublicSearchResponse, PublicSearchReadError>> + Send
    {
        async move {
            search_published(self.pool, term)
                .await
                .map_err(|_| PublicSearchReadError)
        }
    }
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

async fn search_published(
    pool: &PgPool,
    term: &PublicSearchTerm,
) -> Result<PublicSearchResponse, sqlx::Error> {
    let query = escape_like(term.as_str());
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
    .bind(&query)
    .bind(PAGE_SIZE)
    .fetch_all(pool)
    .await?;

    Ok(PublicSearchResponse {
        query: term.as_str().to_owned(),
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
    })
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
