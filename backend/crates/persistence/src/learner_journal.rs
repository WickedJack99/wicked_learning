use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_journal::{
    LearnerJournalReadError, LearnerJournalRepository as LearnerJournalRepositoryPort,
    LearnerJournalRequest,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerJournalDocument, LearnerJournalLearningContext, LearnerJournalPage,
        LearnerJournalPagination,
    },
};

pub struct PostgresLearnerJournalRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerJournalRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl LearnerJournalRepositoryPort for PostgresLearnerJournalRepository<'_> {
    fn load_page(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerJournalRequest,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerJournalDocument>, LearnerJournalReadError>,
    > + Send {
        async move {
            load_page(self.pool, principal, request)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load learner journal");
                    LearnerJournalReadError
                })
        }
    }
}

#[derive(FromRow)]
struct PageRow {
    activity_title: Option<String>,
    id: Uuid,
    map_slug: Option<String>,
    map_title: Option<String>,
    markdown: String,
    node_slug: Option<String>,
    node_title: Option<String>,
    preferred_mode: String,
    reflection_count: i64,
    subtopic: String,
    title: String,
    topic: String,
    updated_at: String,
}

fn escape_like(query: &str) -> String {
    query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

async fn load_page(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    request: &LearnerJournalRequest,
) -> Result<Option<LearnerJournalDocument>, sqlx::Error> {
    let principal_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await?;
    let Some(principal_id) = principal_id else {
        return Ok(None);
    };
    let search = request.search.as_deref().map(escape_like);
    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM learner_journal_pages WHERE principal_id = $1 AND ($2::text IS NULL OR title ILIKE '%' || $2 || '%' ESCAPE E'\\\\' OR topic ILIKE '%' || $2 || '%' ESCAPE E'\\\\' OR subtopic ILIKE '%' || $2 || '%' ESCAPE E'\\\\' OR markdown ILIKE '%' || $2 || '%' ESCAPE E'\\\\')",
    )
    .bind(principal_id)
    .bind(&search)
    .fetch_one(pool)
    .await?;
    let offset = (request.page - 1) * request.per_page;
    let pages = sqlx::query_as::<_, PageRow>(
        "SELECT pages.id, pages.title, pages.topic, pages.subtopic, pages.markdown, pages.preferred_mode, to_char(pages.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at, COUNT(reflections.id) AS reflection_count, activities.title AS activity_title, maps.slug AS map_slug, maps.title AS map_title, nodes.slug AS node_slug, nodes.title AS node_title FROM learner_journal_pages AS pages LEFT JOIN learner_reflections AS reflections ON reflections.learner_journal_page_id = pages.id LEFT JOIN LATERAL (SELECT activity_start_id, activity_id FROM learner_reflections WHERE learner_journal_page_id = pages.id ORDER BY created_at DESC, id DESC LIMIT 1) AS latest ON TRUE LEFT JOIN learning_activity_starts AS starts ON starts.id = latest.activity_start_id LEFT JOIN learning_nodes AS nodes ON nodes.id = starts.node_id LEFT JOIN learning_maps AS maps ON maps.id = nodes.map_id LEFT JOIN learning_activities AS activities ON activities.id = latest.activity_id WHERE pages.principal_id = $1 AND ($2::text IS NULL OR pages.title ILIKE '%' || $2 || '%' ESCAPE E'\\\\' OR pages.topic ILIKE '%' || $2 || '%' ESCAPE E'\\\\' OR pages.subtopic ILIKE '%' || $2 || '%' ESCAPE E'\\\\' OR pages.markdown ILIKE '%' || $2 || '%' ESCAPE E'\\\\') GROUP BY pages.id, activities.title, maps.slug, maps.title, nodes.slug, nodes.title ORDER BY pages.updated_at DESC, pages.id DESC LIMIT $3 OFFSET $4",
    )
    .bind(principal_id)
    .bind(&search)
    .bind(request.per_page)
    .bind(offset)
    .fetch_all(pool)
    .await?;
    let last_page = std::cmp::max(1, (total + request.per_page - 1) / request.per_page);

    Ok(Some(LearnerJournalDocument {
        pages: pages
            .into_iter()
            .map(|page| LearnerJournalPage {
                id: page.id.to_string(),
                title: page.title,
                topic: page.topic,
                subtopic: (!page.subtopic.is_empty()).then_some(page.subtopic),
                markdown: page.markdown,
                preferred_mode: page.preferred_mode,
                reflection_count: page.reflection_count,
                learning_context: match (
                    page.map_slug,
                    page.map_title,
                    page.node_slug,
                    page.node_title,
                ) {
                    (Some(map_slug), Some(map_title), Some(node_slug), Some(node_title)) => {
                        Some(LearnerJournalLearningContext {
                            activity_title: page.activity_title,
                            map_slug,
                            map_title,
                            node_slug,
                            node_title,
                        })
                    }
                    _ => None,
                },
                updated_at: page.updated_at,
            })
            .collect(),
        pagination: LearnerJournalPagination {
            current_page: request.page,
            last_page,
            per_page: request.per_page,
            total,
        },
    }))
}

#[cfg(test)]
mod tests {
    use super::escape_like;

    #[test]
    fn private_journal_search_escapes_database_wildcards() {
        assert_eq!(escape_like("note%_\\"), "note\\%\\_\\\\");
    }
}
