use sqlx::{FromRow, PgPool};
use wicked_learning_application::learner_topics::{
    LearnerTopicDirectoryReadError,
    LearnerTopicDirectoryRepository as LearnerTopicDirectoryRepositoryPort,
    LearnerTopicDirectoryRequest,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerTopicArea, LearnerTopicAreaOption, LearnerTopicDirectory, LearnerTopicPagination,
        LearnerTopicSummary,
    },
};

const TOPICS_PER_PAGE: i64 = 6;

pub struct PostgresLearnerTopicDirectoryRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerTopicDirectoryRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct AreaRow {
    description: Option<String>,
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

impl LearnerTopicDirectoryRepositoryPort for PostgresLearnerTopicDirectoryRepository<'_> {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerTopicDirectoryRequest,
    ) -> impl std::future::Future<
        Output = Result<LearnerTopicDirectory, LearnerTopicDirectoryReadError>,
    > + Send {
        async move {
            load(self.pool, principal, request).await.map_err(|error| {
                tracing::error!(%error, "could not load learner topic directory");
                LearnerTopicDirectoryReadError
            })
        }
    }
}

async fn load(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    request: &LearnerTopicDirectoryRequest,
) -> Result<LearnerTopicDirectory, sqlx::Error> {
    let areas = sqlx::query_as::<_, AreaRow>(
        "SELECT areas.description, areas.slug, areas.title FROM learning_topic_areas AS areas WHERE EXISTS (SELECT 1 FROM learning_topics AS topics WHERE topics.area_id = areas.id AND topics.parent_id IS NULL AND topics.published_at IS NOT NULL) ORDER BY areas.sort_order ASC, areas.title ASC",
    )
    .fetch_all(pool)
    .await?;
    let selected_area = request
        .area_slug
        .as_deref()
        .and_then(|slug| areas.iter().find(|area| area.slug == slug))
        .or_else(|| areas.first());
    let area_options = areas
        .iter()
        .map(|area| LearnerTopicAreaOption {
            slug: area.slug.clone(),
            title: area.title.clone(),
        })
        .collect();

    let Some(area) = selected_area else {
        return Ok(LearnerTopicDirectory {
            areas: area_options,
            pagination: LearnerTopicPagination {
                current_page: 1,
                last_page: 1,
                per_page: TOPICS_PER_PAGE,
                total: 0,
            },
            search: request.search.clone(),
            selected_area: None,
        });
    };
    let search = like_pattern(&request.search);
    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM learning_topics WHERE area_id = (SELECT id FROM learning_topic_areas WHERE slug = $1) AND parent_id IS NULL AND published_at IS NOT NULL AND (LOWER(title) LIKE LOWER($2) ESCAPE '\\' OR LOWER(COALESCE(description, '')) LIKE LOWER($2) ESCAPE '\\' OR LOWER(slug) LIKE LOWER($2) ESCAPE '\\')",
    )
    .bind(&area.slug)
    .bind(&search)
    .fetch_one(pool)
    .await?;
    let last_page = (total + TOPICS_PER_PAGE - 1)
        .div_euclid(TOPICS_PER_PAGE)
        .max(1);
    let page = request.page.min(last_page);
    let offset = (page - 1) * TOPICS_PER_PAGE;
    let topics = sqlx::query_as::<_, TopicRow>(
        "SELECT topics.description, COUNT(maps.id) AS map_count, topics.slug, topics.title FROM learning_topics AS topics LEFT JOIN learning_maps AS maps ON maps.topic_id = topics.id AND maps.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3))) WHERE topics.area_id = (SELECT id FROM learning_topic_areas WHERE slug = $1) AND topics.parent_id IS NULL AND topics.published_at IS NOT NULL AND (LOWER(topics.title) LIKE LOWER($2) ESCAPE '\\' OR LOWER(COALESCE(topics.description, '')) LIKE LOWER($2) ESCAPE '\\' OR LOWER(topics.slug) LIKE LOWER($2) ESCAPE '\\') GROUP BY topics.id ORDER BY topics.title ASC LIMIT $4 OFFSET $5",
    )
    .bind(&area.slug)
    .bind(&search)
    .bind(&principal.roles)
    .bind(TOPICS_PER_PAGE)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(LearnerTopicDirectory {
        areas: area_options,
        pagination: LearnerTopicPagination {
            current_page: page,
            last_page,
            per_page: TOPICS_PER_PAGE,
            total,
        },
        search: request.search.clone(),
        selected_area: Some(LearnerTopicArea {
            description: area.description.clone(),
            slug: area.slug.clone(),
            title: area.title.clone(),
            topics: topics
                .into_iter()
                .map(|topic| LearnerTopicSummary {
                    description: topic.description,
                    map_count: topic.map_count,
                    slug: topic.slug,
                    title: topic.title,
                })
                .collect(),
        }),
    })
}

fn like_pattern(search: &str) -> String {
    format!(
        "%{}%",
        search
            .replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_")
    )
}

#[cfg(test)]
mod tests {
    use super::like_pattern;

    #[test]
    fn directory_search_escapes_database_wildcards() {
        assert_eq!(like_pattern(r"map_100%\\"), r"%map\_100\%\\\\%");
    }
}
