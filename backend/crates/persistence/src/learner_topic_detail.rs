use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_topic_detail::{
    LearnerTopicDetailReadError, LearnerTopicDetailRepository as LearnerTopicDetailRepositoryPort,
    LearnerTopicDetailRequest,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerTopicDetailHeader, LearnerTopicMapSummary, LearnerTopicMaps, LearnerTopicOverview,
        LearnerTopicPagination, LearnerTopicParent, LearnerTopicSummary,
    },
};

const MAPS_PER_PAGE: i64 = 4;
const SUBTOPICS_PER_PAGE: i64 = 4;

pub struct PostgresLearnerTopicDetailRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerTopicDetailRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct HeaderRow {
    area_slug: String,
    area_title: String,
    content: Option<String>,
    description: Option<String>,
    id: Uuid,
    parent_slug: Option<String>,
    parent_title: Option<String>,
    slug: String,
    title: String,
}

#[derive(FromRow)]
struct TopicRow {
    description: Option<String>,
    map_count: i64,
    slug: String,
    title: String,
}

#[derive(FromRow)]
struct MapRow {
    description: String,
    node_count: i64,
    slug: String,
    title: String,
}

impl LearnerTopicDetailRepositoryPort for PostgresLearnerTopicDetailRepository<'_> {
    fn load_maps(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerTopicDetailRequest,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerTopicMaps>, LearnerTopicDetailReadError>,
    > + Send {
        async move {
            load_maps(self.pool, principal, request)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load learner topic maps");
                    LearnerTopicDetailReadError
                })
        }
    }

    fn load_overview(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerTopicDetailRequest,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerTopicOverview>, LearnerTopicDetailReadError>,
    > + Send {
        async move {
            load_overview(self.pool, principal, request)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load learner topic overview");
                    LearnerTopicDetailReadError
                })
        }
    }
}

async fn load_maps(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    request: &LearnerTopicDetailRequest,
) -> Result<Option<LearnerTopicMaps>, sqlx::Error> {
    let Some(header) = load_header(pool, &request.topic_slug).await? else {
        return Ok(None);
    };
    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM learning_maps AS maps WHERE maps.topic_id = $1 AND maps.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2)))",
    )
    .bind(header.id)
    .bind(&principal.roles)
    .fetch_one(pool)
    .await?;
    let pagination = pagination(request.page, total, MAPS_PER_PAGE);
    let maps = sqlx::query_as::<_, MapRow>(
        "SELECT maps.description, COUNT(nodes.id) AS node_count, maps.slug, maps.title FROM learning_maps AS maps LEFT JOIN learning_nodes AS nodes ON nodes.map_id = maps.id AND nodes.published_at IS NOT NULL WHERE maps.topic_id = $1 AND maps.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) GROUP BY maps.id ORDER BY maps.title ASC LIMIT $3 OFFSET $4",
    )
    .bind(header.id)
    .bind(&principal.roles)
    .bind(pagination.per_page)
    .bind((pagination.current_page - 1) * pagination.per_page)
    .fetch_all(pool)
    .await?;

    Ok(Some(LearnerTopicMaps {
        maps: maps
            .into_iter()
            .map(|map| LearnerTopicMapSummary {
                description: map.description,
                href: map_href(&map.slug),
                node_count: map.node_count,
                slug: map.slug,
                title: map.title,
            })
            .collect(),
        maps_pagination: pagination,
        topic: header.into(),
    }))
}

async fn load_overview(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    request: &LearnerTopicDetailRequest,
) -> Result<Option<LearnerTopicOverview>, sqlx::Error> {
    let Some(header) = load_header(pool, &request.topic_slug).await? else {
        return Ok(None);
    };
    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM learning_topics WHERE parent_id = $1 AND published_at IS NOT NULL",
    )
    .bind(header.id)
    .fetch_one(pool)
    .await?;
    let pagination = pagination(request.page, total, SUBTOPICS_PER_PAGE);
    let subtopics = sqlx::query_as::<_, TopicRow>(
        "SELECT topics.description, COUNT(maps.id) AS map_count, topics.slug, topics.title FROM learning_topics AS topics LEFT JOIN learning_maps AS maps ON maps.topic_id = topics.id AND maps.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) WHERE topics.parent_id = $1 AND topics.published_at IS NOT NULL GROUP BY topics.id ORDER BY topics.title ASC LIMIT $3 OFFSET $4",
    )
    .bind(header.id)
    .bind(&principal.roles)
    .bind(pagination.per_page)
    .bind((pagination.current_page - 1) * pagination.per_page)
    .fetch_all(pool)
    .await?;

    Ok(Some(LearnerTopicOverview {
        subtopics: subtopics
            .into_iter()
            .map(|topic| LearnerTopicSummary {
                description: topic.description,
                href: topic_href(&topic.slug),
                map_count: topic.map_count,
                slug: topic.slug,
                title: topic.title,
            })
            .collect(),
        subtopics_pagination: pagination,
        topic: header.into(),
    }))
}

fn map_href(slug: &str) -> String {
    format!("/world?map={slug}")
}

fn topic_href(slug: &str) -> String {
    format!("/topics/{slug}")
}

async fn load_header(pool: &PgPool, topic_slug: &str) -> Result<Option<HeaderRow>, sqlx::Error> {
    sqlx::query_as::<_, HeaderRow>(
        "SELECT areas.slug AS area_slug, areas.title AS area_title, topics.content, topics.description, topics.id, parents.slug AS parent_slug, parents.title AS parent_title, topics.slug, topics.title FROM learning_topics AS topics INNER JOIN learning_topic_areas AS areas ON areas.id = topics.area_id LEFT JOIN learning_topics AS parents ON parents.id = topics.parent_id WHERE topics.slug = $1 AND topics.published_at IS NOT NULL",
    )
    .bind(topic_slug)
    .fetch_optional(pool)
    .await
}

fn pagination(requested_page: i64, total: i64, per_page: i64) -> LearnerTopicPagination {
    let last_page = (total + per_page - 1).div_euclid(per_page).max(1);

    LearnerTopicPagination {
        current_page: if total > 0 {
            requested_page.min(last_page)
        } else {
            requested_page
        },
        last_page,
        per_page,
        total,
    }
}

impl From<HeaderRow> for LearnerTopicDetailHeader {
    fn from(row: HeaderRow) -> Self {
        Self {
            area_slug: row.area_slug,
            area_title: row.area_title,
            content: row.content,
            description: row.description,
            parent: row
                .parent_slug
                .zip(row.parent_title)
                .map(|(slug, title)| LearnerTopicParent {
                    href: topic_href(&slug),
                    slug,
                    title,
                }),
            slug: row.slug,
            title: row.title,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::pagination;

    #[test]
    fn detail_pagination_clamps_only_nonempty_overflow_pages() {
        assert_eq!(pagination(8, 5, 4).current_page, 2);
        assert_eq!(pagination(8, 0, 4).current_page, 8);
    }
}
