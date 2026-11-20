use sqlx::{FromRow, PgPool};
use wicked_learning_application::learner_desk_search::{
    LearnerDeskSearchReadError, LearnerDeskSearchRepository as LearnerDeskSearchRepositoryPort,
    LearnerDeskSearchRequest,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerDeskSearch, LearnerDeskSearchPagination, LearnerDeskSearchResult},
};

pub struct PostgresLearnerDeskSearchRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerDeskSearchRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl LearnerDeskSearchRepositoryPort for PostgresLearnerDeskSearchRepository<'_> {
    fn search(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerDeskSearchRequest,
    ) -> impl std::future::Future<Output = Result<LearnerDeskSearch, LearnerDeskSearchReadError>> + Send
    {
        async move {
            search(self.pool, principal, request)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load learner Desk search results");
                    LearnerDeskSearchReadError
                })
        }
    }
}

#[derive(FromRow)]
struct TopicRow {
    id: uuid::Uuid,
    slug: String,
    title: String,
}

#[derive(FromRow)]
struct MapRow {
    id: uuid::Uuid,
    slug: String,
    title: String,
}

#[derive(FromRow)]
struct NodeRow {
    id: uuid::Uuid,
    map_id: uuid::Uuid,
    map_slug: String,
    map_title: String,
    slug: String,
    state: String,
    title: String,
}

async fn search(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    request: &LearnerDeskSearchRequest,
) -> Result<LearnerDeskSearch, sqlx::Error> {
    let term = escape_like(&request.term);
    let topic_total = count_topics(pool, &term).await?;
    let map_total = count_maps(pool, &term, &principal.roles).await?;
    let node_total = count_nodes(pool, &term, &principal.roles).await?;
    let total = topic_total + map_total + node_total;
    let last_page = ((total + request.per_page - 1) / request.per_page).max(1);
    let current_page = request.page.min(last_page);
    let mut remaining_offset = (current_page - 1) * request.per_page;
    let mut remaining = request.per_page;
    let mut results = Vec::with_capacity(request.per_page as usize);

    if let Some((offset, take)) =
        category_window(topic_total, &mut remaining_offset, &mut remaining)
    {
        results.extend(
            load_topics(pool, &term, offset, take)
                .await?
                .into_iter()
                .map(|row| LearnerDeskSearchResult {
                    href: format!("/topics/{}", row.slug),
                    id: format!("topic:{}", row.id),
                    kind: "topic".to_owned(),
                    map_id: None,
                    node_id: None,
                    map_slug: None,
                    node_slug: None,
                    subtitle: "Topic".to_owned(),
                    title: row.title,
                }),
        );
    }
    if let Some((offset, take)) = category_window(map_total, &mut remaining_offset, &mut remaining)
    {
        results.extend(
            load_maps(pool, &term, &principal.roles, offset, take)
                .await?
                .into_iter()
                .map(|row| LearnerDeskSearchResult {
                    href: format!("/world?map={}", row.slug),
                    id: format!("map:{}", row.id),
                    kind: "map".to_owned(),
                    map_id: Some(row.id),
                    node_id: None,
                    map_slug: Some(row.slug),
                    node_slug: None,
                    subtitle: "World map".to_owned(),
                    title: row.title,
                }),
        );
    }
    if let Some((offset, take)) = category_window(node_total, &mut remaining_offset, &mut remaining)
    {
        results.extend(
            load_nodes(pool, &term, &principal.roles, offset, take)
                .await?
                .into_iter()
                .map(|row| LearnerDeskSearchResult {
                    href: format!("/world?map={}&focused={}", row.map_slug, row.slug),
                    id: format!("node:{}", row.id),
                    kind: "node".to_owned(),
                    map_id: Some(row.map_id),
                    node_id: Some(row.id),
                    map_slug: Some(row.map_slug),
                    node_slug: Some(row.slug),
                    subtitle: format!(
                        "{}{}",
                        row.map_title,
                        (row.state == "locked")
                            .then_some(" - locked")
                            .unwrap_or_default(),
                    ),
                    title: row.title,
                }),
        );
    }

    Ok(LearnerDeskSearch {
        pagination: LearnerDeskSearchPagination {
            current_page,
            last_page,
            per_page: request.per_page,
            total,
        },
        results,
    })
}

fn category_window(
    category_total: i64,
    remaining_offset: &mut i64,
    remaining: &mut i64,
) -> Option<(i64, i64)> {
    if category_total == 0 || *remaining == 0 {
        return None;
    }
    if *remaining_offset >= category_total {
        *remaining_offset -= category_total;
        return None;
    }

    let take = (*remaining).min(category_total - *remaining_offset);
    let offset = *remaining_offset;
    *remaining_offset = 0;
    *remaining -= take;
    Some((offset, take))
}

async fn count_topics(pool: &PgPool, term: &str) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(TOPIC_COUNT_SQL)
        .bind(term)
        .fetch_one(pool)
        .await
}

async fn count_maps(pool: &PgPool, term: &str, roles: &[String]) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(MAP_COUNT_SQL)
        .bind(term)
        .bind(roles)
        .fetch_one(pool)
        .await
}

async fn count_nodes(pool: &PgPool, term: &str, roles: &[String]) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(NODE_COUNT_SQL)
        .bind(term)
        .bind(roles)
        .fetch_one(pool)
        .await
}

async fn load_topics(
    pool: &PgPool,
    term: &str,
    offset: i64,
    take: i64,
) -> Result<Vec<TopicRow>, sqlx::Error> {
    sqlx::query_as(TOPIC_RESULTS_SQL)
        .bind(term)
        .bind(take)
        .bind(offset)
        .fetch_all(pool)
        .await
}

async fn load_maps(
    pool: &PgPool,
    term: &str,
    roles: &[String],
    offset: i64,
    take: i64,
) -> Result<Vec<MapRow>, sqlx::Error> {
    sqlx::query_as(MAP_RESULTS_SQL)
        .bind(term)
        .bind(roles)
        .bind(take)
        .bind(offset)
        .fetch_all(pool)
        .await
}

async fn load_nodes(
    pool: &PgPool,
    term: &str,
    roles: &[String],
    offset: i64,
    take: i64,
) -> Result<Vec<NodeRow>, sqlx::Error> {
    sqlx::query_as(NODE_RESULTS_SQL)
        .bind(term)
        .bind(roles)
        .bind(take)
        .bind(offset)
        .fetch_all(pool)
        .await
}

const TOPIC_COUNT_SQL: &str = r#"
SELECT count(*) FROM learning_topics AS topics
WHERE topics.published_at IS NOT NULL
  AND (topics.title ILIKE '%' || $1 || '%' ESCAPE E'\\'
       OR COALESCE(topics.description, '') ILIKE '%' || $1 || '%' ESCAPE E'\\'
       OR topics.slug ILIKE '%' || $1 || '%' ESCAPE E'\\')
"#;

const TOPIC_RESULTS_SQL: &str = r#"
SELECT topics.id, topics.slug, topics.title FROM learning_topics AS topics
WHERE topics.published_at IS NOT NULL
  AND (topics.title ILIKE '%' || $1 || '%' ESCAPE E'\\'
       OR COALESCE(topics.description, '') ILIKE '%' || $1 || '%' ESCAPE E'\\'
       OR topics.slug ILIKE '%' || $1 || '%' ESCAPE E'\\')
ORDER BY topics.title ASC, topics.id ASC LIMIT $2 OFFSET $3
"#;

const MAP_COUNT_SQL: &str = r#"
SELECT count(*) FROM learning_maps AS maps
INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id
WHERE worlds.id = (
    SELECT id FROM learning_worlds
    WHERE published_at IS NOT NULL
    ORDER BY created_at ASC, id ASC
    LIMIT 1
)
  AND maps.published_at IS NOT NULL
  AND (maps.access_roles @> '["public"]'::jsonb
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2)))
  AND (maps.title ILIKE '%' || $1 || '%' ESCAPE E'\\'
       OR maps.description ILIKE '%' || $1 || '%' ESCAPE E'\\'
       OR maps.slug ILIKE '%' || $1 || '%' ESCAPE E'\\')
"#;

const MAP_RESULTS_SQL: &str = r#"
SELECT maps.id, maps.slug, maps.title FROM learning_maps AS maps
INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id
WHERE worlds.id = (
    SELECT id FROM learning_worlds
    WHERE published_at IS NOT NULL
    ORDER BY created_at ASC, id ASC
    LIMIT 1
)
  AND maps.published_at IS NOT NULL
  AND (maps.access_roles @> '["public"]'::jsonb
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2)))
  AND (maps.title ILIKE '%' || $1 || '%' ESCAPE E'\\'
       OR maps.description ILIKE '%' || $1 || '%' ESCAPE E'\\'
       OR maps.slug ILIKE '%' || $1 || '%' ESCAPE E'\\')
ORDER BY maps.title ASC, maps.id ASC LIMIT $3 OFFSET $4
"#;

const NODE_COUNT_SQL: &str = r#"
SELECT count(*) FROM learning_nodes AS nodes
INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id
INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id
WHERE worlds.id = (
    SELECT id FROM learning_worlds
    WHERE published_at IS NOT NULL
    ORDER BY created_at ASC, id ASC
    LIMIT 1
)
  AND maps.published_at IS NOT NULL
  AND nodes.published_at IS NOT NULL
  AND nodes.state <> 'hidden'
  AND NOT (nodes.visual_config @> '{"hideEmptySpace": true}'::jsonb)
  AND (maps.access_roles @> '["public"]'::jsonb
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2)))
  AND (nodes.title ILIKE '%' || $1 || '%' ESCAPE E'\\'
       OR nodes.description ILIKE '%' || $1 || '%' ESCAPE E'\\'
       OR nodes.slug ILIKE '%' || $1 || '%' ESCAPE E'\\'
       OR maps.title ILIKE '%' || $1 || '%' ESCAPE E'\\')
"#;

const NODE_RESULTS_SQL: &str = r#"
SELECT nodes.id, maps.id AS map_id, maps.slug AS map_slug, maps.title AS map_title, nodes.slug, nodes.state, nodes.title
FROM learning_nodes AS nodes
INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id
INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id
WHERE worlds.id = (
    SELECT id FROM learning_worlds
    WHERE published_at IS NOT NULL
    ORDER BY created_at ASC, id ASC
    LIMIT 1
)
  AND maps.published_at IS NOT NULL
  AND nodes.published_at IS NOT NULL
  AND nodes.state <> 'hidden'
  AND NOT (nodes.visual_config @> '{"hideEmptySpace": true}'::jsonb)
  AND (maps.access_roles @> '["public"]'::jsonb
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2)))
  AND (nodes.title ILIKE '%' || $1 || '%' ESCAPE E'\\'
       OR nodes.description ILIKE '%' || $1 || '%' ESCAPE E'\\'
       OR nodes.slug ILIKE '%' || $1 || '%' ESCAPE E'\\'
       OR maps.title ILIKE '%' || $1 || '%' ESCAPE E'\\')
ORDER BY nodes.title ASC, nodes.id ASC LIMIT $3 OFFSET $4
"#;

fn escape_like(query: &str) -> String {
    query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

#[cfg(test)]
mod tests {
    use super::{category_window, escape_like};

    #[test]
    fn literal_search_characters_are_escaped_before_sql() {
        assert_eq!(escape_like("map%_\\"), "map\\%\\_\\\\");
    }

    #[test]
    fn category_windows_preserve_the_source_combined_result_order() {
        let mut offset = 6;
        let mut remaining = 5;
        assert_eq!(category_window(2, &mut offset, &mut remaining), None);
        assert_eq!(offset, 4);
        assert_eq!(category_window(3, &mut offset, &mut remaining), None);
        assert_eq!(offset, 1);
        assert_eq!(
            category_window(9, &mut offset, &mut remaining),
            Some((1, 5))
        );
    }

    #[tokio::test]
    #[ignore = "requires TEST_APPLICATION_DATABASE_URL pointing to the migrated local test stack"]
    async fn source_search_preserves_identities_visibility_and_category_pagination() {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .idle_timeout(None)
            .max_lifetime(None)
            .connect(&std::env::var("TEST_APPLICATION_DATABASE_URL").expect("test database URL"))
            .await
            .unwrap();
        for table in [
            "learning_topics",
            "learning_worlds",
            "learning_maps",
            "learning_nodes",
        ] {
            sqlx::query(&format!(
                "CREATE TEMP TABLE {table} AS SELECT * FROM public.{table} WITH NO DATA"
            ))
            .execute(&pool)
            .await
            .unwrap();
        }
        let world = uuid::Uuid::new_v4();
        let topic = uuid::Uuid::new_v4();
        let map = uuid::Uuid::new_v4();
        let restricted_map = uuid::Uuid::new_v4();
        let node = uuid::Uuid::new_v4();
        sqlx::query("INSERT INTO learning_worlds (id, slug, created_at, published_at) VALUES ($1, 'test-world', NOW(), NOW())")
            .bind(world).execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO learning_topics (id, slug, title, published_at) VALUES ($1, 'needle-topic', 'Needle topic', NOW())")
            .bind(topic).execute(&pool).await.unwrap();
        for (id, slug, roles) in [
            (map, "needle-map", r#"["public"]"#),
            (restricted_map, "needle-private", r#"["administrator"]"#),
        ] {
            sqlx::query("INSERT INTO learning_maps (id, world_id, slug, title, published_at, access_roles) VALUES ($1, $2, $3, 'Needle map', NOW(), $4::jsonb)")
                .bind(id).bind(world).bind(slug).bind(roles).execute(&pool).await.unwrap();
        }
        for (id, parent, slug, state, visual) in [
            (node, map, "needle-place", "locked", "{}"),
            (uuid::Uuid::new_v4(), map, "needle-hidden", "hidden", "{}"),
            (
                uuid::Uuid::new_v4(),
                map,
                "needle-empty",
                "open",
                r#"{"hideEmptySpace":true}"#,
            ),
            (
                uuid::Uuid::new_v4(),
                restricted_map,
                "needle-private-place",
                "open",
                "{}",
            ),
        ] {
            sqlx::query("INSERT INTO learning_nodes (id, map_id, slug, title, state, visual_config, published_at) VALUES ($1, $2, $3, 'Needle place', $4, $5::jsonb, NOW())")
                .bind(id).bind(parent).bind(slug).bind(state).bind(visual).execute(&pool).await.unwrap();
        }
        let principal = wicked_learning_domain::identity_access::AuthorizedPrincipal {
            subject_id: uuid::Uuid::new_v4(),
            roles: vec!["learner".into()],
            capabilities: vec![],
        };
        let first = super::search(
            &pool,
            &principal,
            &super::LearnerDeskSearchRequest::parse(Some("needle"), Some(1), Some(2)).unwrap(),
        )
        .await
        .unwrap();
        assert_eq!(first.pagination.total, 3);
        assert_eq!(first.pagination.last_page, 2);
        let first = serde_json::to_value(first).unwrap();
        assert_eq!(first["results"][0]["id"], format!("topic:{topic}"));
        assert!(first["results"][0]["map_id"].is_null());
        assert_eq!(first["results"][1]["map_id"], map.to_string());
        assert!(first["results"][1]["node_id"].is_null());
        let second = super::search(
            &pool,
            &principal,
            &super::LearnerDeskSearchRequest::parse(Some("needle"), Some(2), Some(2)).unwrap(),
        )
        .await
        .unwrap();
        assert_eq!(second.results.len(), 1);
        let second = serde_json::to_value(second).unwrap();
        assert_eq!(second["results"][0]["map_id"], map.to_string());
        assert_eq!(second["results"][0]["node_id"], node.to_string());
        assert_eq!(second["results"][0]["subtitle"], "Needle map - locked");
        assert_eq!(
            second["results"][0]["href"],
            "/world?map=needle-map&focused=needle-place"
        );
        pool.close().await;
    }
}
