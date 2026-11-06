use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_journal_export::{
    LearnerJournalExportError, LearnerJournalExportPage, LearnerJournalExportRepository,
    LearnerJournalExportStream,
};
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

const EXPORT_BATCH_SIZE: i64 = 128;

pub struct PostgresLearnerJournalExportRepository {
    pool: PgPool,
}

impl PostgresLearnerJournalExportRepository {
    pub fn new(pool: &PgPool) -> Self {
        Self { pool: pool.clone() }
    }
}

#[derive(FromRow)]
struct ExportPageRow {
    id: Uuid,
    markdown: String,
    subtopic: String,
    title: String,
    topic: String,
    updated_at: String,
}

impl LearnerJournalExportRepository for PostgresLearnerJournalExportRepository {
    fn has_principal(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl std::future::Future<Output = Result<bool, LearnerJournalExportError>> + Send {
        async move {
            sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS (SELECT 1 FROM application_principals WHERE identity_subject_id = $1)",
            )
            .bind(principal.subject_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not verify learner journal export principal");
                LearnerJournalExportError
            })
        }
    }

    fn stream_pages(&self, identity_subject_id: Uuid) -> LearnerJournalExportStream {
        let pool = self.pool.clone();
        Box::pin(async_stream::try_stream! {
            let mut cursor: Option<(String, Uuid)> = None;
            loop {
                let (cursor_updated_at, cursor_id) = cursor.clone().unzip();
                let pages = sqlx::query_as::<_, ExportPageRow>(
                    "SELECT pages.id, pages.title, pages.topic, pages.subtopic, pages.markdown, to_char(pages.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learner_journal_pages AS pages INNER JOIN application_principals AS principals ON principals.id = pages.principal_id WHERE principals.identity_subject_id = $1 AND ($2::timestamptz IS NULL OR (pages.updated_at, pages.id) < ($2::timestamptz, $3::uuid)) ORDER BY pages.updated_at DESC, pages.id DESC LIMIT $4",
                )
                .bind(identity_subject_id)
                .bind(cursor_updated_at)
                .bind(cursor_id)
                .bind(EXPORT_BATCH_SIZE)
                .fetch_all(&pool)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load learner journal export page batch");
                    LearnerJournalExportError
                })?;

                let page_count = pages.len();
                cursor = pages.last().map(|page| (page.updated_at.clone(), page.id));
                for page in pages {
                    yield LearnerJournalExportPage {
                        markdown: page.markdown,
                        subtopic: page.subtopic,
                        title: page.title,
                        topic: page.topic,
                    };
                }
                if page_count < EXPORT_BATCH_SIZE as usize {
                    break;
                }
            }
        })
    }
}
