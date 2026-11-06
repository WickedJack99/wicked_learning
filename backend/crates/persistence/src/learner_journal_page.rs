use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_journal_page::{
    LearnerJournalPageDraft, LearnerJournalPageRepository as LearnerJournalPageRepositoryPort,
    LearnerJournalPageWriteError,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerJournalFeedbackRequest, LearnerJournalFeedbackRequestDomain,
        LearnerJournalLearningContext, LearnerJournalPage,
    },
};

pub struct PostgresLearnerJournalPageRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerJournalPageRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct PageRow {
    activity_title: Option<String>,
    id: Uuid,
    expert_access_requested: bool,
    feedback: Option<String>,
    feedback_domain_group_id: Option<Uuid>,
    feedback_domain_label: Option<String>,
    feedback_domain_type: Option<String>,
    feedback_request_id: Option<Uuid>,
    feedback_requested_at: Option<String>,
    feedback_responded_at: Option<String>,
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

impl LearnerJournalPageRepositoryPort for PostgresLearnerJournalPageRepository<'_> {
    fn create(
        &self,
        principal: &AuthorizedPrincipal,
        draft: &LearnerJournalPageDraft,
    ) -> impl std::future::Future<Output = Result<LearnerJournalPage, LearnerJournalPageWriteError>> + Send
    {
        async move {
            create(self.pool, principal, draft).await.map_err(|error| {
                tracing::error!(%error, "could not create learner journal page");
                LearnerJournalPageWriteError
            })
        }
    }

    fn update(
        &self,
        principal: &AuthorizedPrincipal,
        page_id: Uuid,
        draft: &LearnerJournalPageDraft,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerJournalPage>, LearnerJournalPageWriteError>,
    > + Send {
        async move {
            update(self.pool, principal, page_id, draft)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not update learner journal page");
                    LearnerJournalPageWriteError
                })
        }
    }

    fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        page_id: Uuid,
    ) -> impl std::future::Future<Output = Result<bool, LearnerJournalPageWriteError>> + Send {
        async move {
            delete(self.pool, principal, page_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not delete learner journal page");
                    LearnerJournalPageWriteError
                })
        }
    }
}

async fn application_principal_id(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(pool)
        .await
}

async fn create(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    draft: &LearnerJournalPageDraft,
) -> Result<LearnerJournalPage, sqlx::Error> {
    let principal_id = application_principal_id(pool, principal)
        .await?
        .ok_or(sqlx::Error::RowNotFound)?;
    let page_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO learner_journal_pages (principal_id, title, topic, subtopic, markdown, preferred_mode) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(principal_id)
    .bind(&draft.title)
    .bind(&draft.topic)
    .bind(&draft.subtopic)
    .bind(&draft.markdown)
    .bind(&draft.preferred_mode)
    .fetch_one(pool)
    .await?;

    load_owned_page(pool, principal_id, page_id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    page_id: Uuid,
    draft: &LearnerJournalPageDraft,
) -> Result<Option<LearnerJournalPage>, sqlx::Error> {
    let Some(principal_id) = application_principal_id(pool, principal).await? else {
        return Ok(None);
    };
    let page_id = sqlx::query_scalar::<_, Uuid>(
        "UPDATE learner_journal_pages SET title = $3, topic = $4, subtopic = $5, markdown = $6, preferred_mode = $7, updated_at = NOW() WHERE id = $1 AND principal_id = $2 RETURNING id",
    )
    .bind(page_id)
    .bind(principal_id)
    .bind(&draft.title)
    .bind(&draft.topic)
    .bind(&draft.subtopic)
    .bind(&draft.markdown)
    .bind(&draft.preferred_mode)
    .fetch_optional(pool)
    .await?;
    match page_id {
        Some(page_id) => load_owned_page(pool, principal_id, page_id).await,
        None => Ok(None),
    }
}

async fn delete(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    page_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let Some(principal_id) = application_principal_id(pool, principal).await? else {
        return Ok(false);
    };
    let deleted = sqlx::query_scalar::<_, Uuid>(
        "DELETE FROM learner_journal_pages WHERE id = $1 AND principal_id = $2 RETURNING id",
    )
    .bind(page_id)
    .bind(principal_id)
    .fetch_optional(pool)
    .await?;
    Ok(deleted.is_some())
}

pub async fn load_owned_page(
    pool: &PgPool,
    principal_id: Uuid,
    page_id: Uuid,
) -> Result<Option<LearnerJournalPage>, sqlx::Error> {
    let page = sqlx::query_as::<_, PageRow>(
        "SELECT pages.id, pages.title, pages.topic, pages.subtopic, pages.markdown, pages.preferred_mode, pages.expert_access_requested, to_char(pages.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at, COUNT(reflections.id) AS reflection_count, activities.title AS activity_title, maps.slug AS map_slug, maps.title AS map_title, nodes.slug AS node_slug, nodes.title AS node_title, feedback_requests.id AS feedback_request_id, feedback_requests.domain_type AS feedback_domain_type, feedback_requests.domain_group_id AS feedback_domain_group_id, feedback_requests.domain_label AS feedback_domain_label, feedback_requests.feedback, to_char(feedback_requests.requested_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS feedback_requested_at, to_char(feedback_requests.responded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS feedback_responded_at FROM learner_journal_pages AS pages LEFT JOIN learner_journal_feedback_requests AS feedback_requests ON feedback_requests.learner_journal_page_id = pages.id LEFT JOIN learner_reflections AS reflections ON reflections.learner_journal_page_id = pages.id LEFT JOIN LATERAL (SELECT activity_start_id, activity_id FROM learner_reflections WHERE learner_journal_page_id = pages.id ORDER BY created_at DESC, id DESC LIMIT 1) AS latest ON TRUE LEFT JOIN learning_activity_starts AS starts ON starts.id = latest.activity_start_id LEFT JOIN learning_nodes AS nodes ON nodes.id = starts.node_id LEFT JOIN learning_maps AS maps ON maps.id = nodes.map_id LEFT JOIN learning_activities AS activities ON activities.id = latest.activity_id WHERE pages.id = $1 AND pages.principal_id = $2 GROUP BY pages.id, feedback_requests.id, activities.title, maps.slug, maps.title, nodes.slug, nodes.title",
    )
    .bind(page_id)
    .bind(principal_id)
    .fetch_optional(pool)
    .await?;
    Ok(page.map(page_from_row))
}

fn page_from_row(page: PageRow) -> LearnerJournalPage {
    LearnerJournalPage {
        expert_access_requested: page.expert_access_requested,
        feedback_request: page
            .feedback_request_id
            .map(|_| LearnerJournalFeedbackRequest {
                domain: LearnerJournalFeedbackRequestDomain {
                    id: page.feedback_domain_group_id.map(|id| id.to_string()),
                    label: page.feedback_domain_label.unwrap_or_default(),
                    type_: page
                        .feedback_domain_type
                        .unwrap_or_else(|| "journal".to_owned()),
                },
                feedback: page.feedback,
                requested_at: page.feedback_requested_at.unwrap_or_default(),
                responded_at: page.feedback_responded_at.clone(),
                status: if page.feedback_responded_at.is_some() {
                    "responded".to_owned()
                } else {
                    "pending".to_owned()
                },
            }),
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
    }
}
