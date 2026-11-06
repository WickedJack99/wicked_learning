use std::collections::{BTreeSet, HashMap};

use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::platform_feedback_review::{
    PlatformFeedbackReviewError, PlatformFeedbackReviewIdentity, PlatformFeedbackReviewItem,
    PlatformFeedbackReviewPage, PlatformFeedbackReviewPagination,
    PlatformFeedbackReviewRepository as Port,
};

const PAGE_SIZE: i64 = 8;

pub struct PostgresPlatformFeedbackReviewRepository<'pool> {
    application_pool: &'pool PgPool,
    identity_pool: &'pool PgPool,
}

impl<'pool> PostgresPlatformFeedbackReviewRepository<'pool> {
    pub fn new(application_pool: &'pool PgPool, identity_pool: &'pool PgPool) -> Self {
        Self {
            application_pool,
            identity_pool,
        }
    }
}

#[derive(FromRow)]
struct FeedbackRow {
    category: String,
    id: Uuid,
    message: String,
    reviewed_at: Option<String>,
    subject_id: Uuid,
    submitted_at: String,
}

#[derive(FromRow)]
struct IdentityRow {
    display_name: Option<String>,
    id: Uuid,
    normalized_email: String,
}

impl Port for PostgresPlatformFeedbackReviewRepository<'_> {
    fn list(
        &self,
        page: i64,
    ) -> impl std::future::Future<
        Output = Result<PlatformFeedbackReviewPage, PlatformFeedbackReviewError>,
    > + Send {
        async move {
            list(self.application_pool, self.identity_pool, page)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load platform feedback review queue");
                    PlatformFeedbackReviewError
                })
        }
    }

    fn mark_reviewed(
        &self,
        feedback_id: Uuid,
    ) -> impl std::future::Future<Output = Result<bool, PlatformFeedbackReviewError>> + Send {
        async move {
            sqlx::query(
                "UPDATE application_platform_feedback SET reviewed_at = NOW(), updated_at = NOW() WHERE id = $1",
            )
            .bind(feedback_id)
            .execute(self.application_pool)
            .await
            .map(|result| result.rows_affected() == 1)
            .map_err(|error| {
                tracing::error!(%error, "could not mark platform feedback reviewed");
                PlatformFeedbackReviewError
            })
        }
    }
}

async fn list(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    requested_page: i64,
) -> Result<PlatformFeedbackReviewPage, sqlx::Error> {
    let total =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*)::BIGINT FROM application_platform_feedback")
            .fetch_one(application_pool)
            .await?;
    let last_page = ((total + PAGE_SIZE - 1) / PAGE_SIZE).max(1);
    let page = requested_page.min(last_page);
    let rows = sqlx::query_as::<_, FeedbackRow>(
        "SELECT feedback.category, feedback.id, feedback.message, \
                CASE WHEN feedback.reviewed_at IS NULL THEN NULL ELSE to_char(feedback.reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') END AS reviewed_at, \
                principals.identity_subject_id AS subject_id, \
                to_char(feedback.submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS submitted_at \
         FROM application_platform_feedback AS feedback \
         INNER JOIN application_principals AS principals ON principals.id = feedback.principal_id \
         ORDER BY feedback.reviewed_at IS NULL DESC, feedback.submitted_at DESC, feedback.id DESC \
         LIMIT $1 OFFSET $2",
    )
    .bind(PAGE_SIZE)
    .bind((page - 1) * PAGE_SIZE)
    .fetch_all(application_pool)
    .await?;
    let identities = load_identities(
        identity_pool,
        &rows.iter().map(|row| row.subject_id).collect::<Vec<_>>(),
    )
    .await?;
    let items = rows
        .into_iter()
        .map(|row| {
            let user = identities
                .get(&row.subject_id)
                .map(|identity| PlatformFeedbackReviewIdentity {
                    email: Some(identity.normalized_email.clone()),
                    name: identity.display_name.clone(),
                    subject_id: Some(identity.id.to_string()),
                })
                .unwrap_or(PlatformFeedbackReviewIdentity {
                    email: None,
                    name: None,
                    subject_id: None,
                });
            PlatformFeedbackReviewItem {
                category: row.category,
                id: row.id.to_string(),
                message: row.message,
                reviewed_at: row.reviewed_at,
                submitted_at: row.submitted_at,
                user,
            }
        })
        .collect();

    Ok(PlatformFeedbackReviewPage {
        items,
        pagination: PlatformFeedbackReviewPagination {
            current_page: page,
            last_page,
            per_page: PAGE_SIZE,
            total,
        },
    })
}

async fn load_identities(
    identity_pool: &PgPool,
    subject_ids: &[Uuid],
) -> Result<HashMap<Uuid, IdentityRow>, sqlx::Error> {
    let subject_ids = subject_ids.iter().copied().collect::<BTreeSet<_>>();
    if subject_ids.is_empty() {
        return Ok(HashMap::new());
    }

    sqlx::query_as::<_, IdentityRow>(
        "SELECT subjects.id, subjects.normalized_email, profiles.display_name \
         FROM identity_subjects AS subjects \
         LEFT JOIN identity_profiles AS profiles ON profiles.subject_id = subjects.id \
         WHERE subjects.id = ANY($1)",
    )
    .bind(subject_ids.into_iter().collect::<Vec<_>>())
    .fetch_all(identity_pool)
    .await
    .map(|rows| rows.into_iter().map(|row| (row.id, row)).collect())
}
