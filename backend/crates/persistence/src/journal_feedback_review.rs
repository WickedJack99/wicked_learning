use std::collections::{BTreeSet, HashMap};

use sqlx::{FromRow, PgPool, Postgres, Transaction, types::Json};
use uuid::Uuid;
use wicked_learning_application::journal_feedback_review::{
    AdminJournalFeedbackDomain, AdminJournalFeedbackIdentity, AdminJournalFeedbackItem,
    AdminJournalFeedbackPage, AdminJournalFeedbackPageContent, AdminJournalFeedbackPagination,
    JournalFeedbackPolicy, JournalFeedbackReviewError, JournalFeedbackReviewRepository as Port,
    RespondJournalFeedbackResult,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerJournalTheme, default_learner_journal_theme},
};

const PAGE_SIZE: i64 = 6;
const JOURNAL_PRESENTATION_MEDIA_OWNER_KIND: &str = "journal_presentation";
const JOURNAL_PRESENTATION_MEDIA_OWNER_ID: Uuid =
    Uuid::from_u128(0x7ec22d8d_a2b8_4ae7_9fed_a3d7c0776df5);
const ADMIN_MEDIA_CONTENT_PREFIX: &str = "/api/v1/admin/media-assets/";

pub struct PostgresJournalFeedbackReviewRepository<'pool> {
    application_pool: &'pool PgPool,
    identity_pool: &'pool PgPool,
}

impl<'pool> PostgresJournalFeedbackReviewRepository<'pool> {
    pub fn new(application_pool: &'pool PgPool, identity_pool: &'pool PgPool) -> Self {
        Self {
            application_pool,
            identity_pool,
        }
    }
}

#[derive(FromRow)]
struct Row {
    domain_group_id: Option<Uuid>,
    domain_label: String,
    domain_type: String,
    feedback: Option<String>,
    id: Uuid,
    page_id: Uuid,
    page_markdown: String,
    page_subtopic: String,
    page_title: String,
    page_topic: String,
    requested_at: String,
    requester_subject_id: Uuid,
    responded_at: Option<String>,
}

#[derive(FromRow)]
struct IdentityRow {
    display_name: Option<String>,
    id: Uuid,
    normalized_email: String,
}

impl Port for PostgresJournalFeedbackReviewRepository<'_> {
    fn policy(
        &self,
    ) -> impl std::future::Future<Output = Result<JournalFeedbackPolicy, JournalFeedbackReviewError>>
    + Send {
        async move {
            policy(self.application_pool)
                .await
                .map_err(log_error("could not load journal feedback policy"))
        }
    }
    fn update_policy(
        &self,
        policy: JournalFeedbackPolicy,
    ) -> impl std::future::Future<Output = Result<JournalFeedbackPolicy, JournalFeedbackReviewError>>
    + Send {
        async move {
            update_policy(self.application_pool, policy)
                .await
                .map_err(log_error("could not update journal feedback policy"))
        }
    }
    fn list(
        &self,
        page: i64,
    ) -> impl std::future::Future<
        Output = Result<AdminJournalFeedbackPage, JournalFeedbackReviewError>,
    > + Send {
        async move {
            list(self.application_pool, self.identity_pool, page)
                .await
                .map_err(log_error("could not load journal feedback review queue"))
        }
    }
    fn respond(
        &self,
        principal: &AuthorizedPrincipal,
        request_id: Uuid,
        feedback: &str,
    ) -> impl std::future::Future<
        Output = Result<RespondJournalFeedbackResult, JournalFeedbackReviewError>,
    > + Send {
        async move {
            respond(self.application_pool, principal, request_id, feedback)
                .await
                .map_err(log_error("could not respond to journal feedback"))
        }
    }
}

fn log_error(message: &'static str) -> impl FnOnce(sqlx::Error) -> JournalFeedbackReviewError {
    move |error| {
        tracing::error!(%error, "{message}");
        JournalFeedbackReviewError
    }
}

async fn policy(pool: &PgPool) -> Result<JournalFeedbackPolicy, sqlx::Error> {
    let policy = sqlx::query_as::<_, PolicyRow>(
        "SELECT allow_review_requests, theme FROM application_journal_feedback_policy WHERE singleton = TRUE",
    )
    .fetch_optional(pool)
    .await?;
    Ok(JournalFeedbackPolicy {
        allow_review_requests: policy
            .as_ref()
            .is_some_and(|policy| policy.allow_review_requests),
        theme: policy
            .and_then(|policy| policy.theme.map(|theme| theme.0))
            .unwrap_or_else(default_learner_journal_theme),
    })
}

async fn update_policy(
    pool: &PgPool,
    policy: JournalFeedbackPolicy,
) -> Result<JournalFeedbackPolicy, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let allow_review_requests = sqlx::query_scalar(
        "INSERT INTO application_journal_feedback_policy (singleton, allow_review_requests, theme, updated_at) VALUES (TRUE, $1, $2, NOW()) ON CONFLICT (singleton) DO UPDATE SET allow_review_requests = EXCLUDED.allow_review_requests, theme = EXCLUDED.theme, updated_at = NOW() RETURNING allow_review_requests",
    )
    .bind(policy.allow_review_requests)
    .bind(Json(&policy.theme))
    .fetch_one(&mut *transaction)
    .await?;
    sync_presentation_media_references(&mut transaction, &policy.theme).await?;
    transaction.commit().await?;
    Ok(JournalFeedbackPolicy {
        allow_review_requests,
        theme: policy.theme,
    })
}

#[derive(FromRow)]
struct PolicyRow {
    allow_review_requests: bool,
    theme: Option<Json<LearnerJournalTheme>>,
}

async fn sync_presentation_media_references(
    transaction: &mut Transaction<'_, Postgres>,
    theme: &LearnerJournalTheme,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM reusable_media_asset_references WHERE owner_kind = $1 AND owner_id = $2",
    )
    .bind(JOURNAL_PRESENTATION_MEDIA_OWNER_KIND)
    .bind(JOURNAL_PRESENTATION_MEDIA_OWNER_ID)
    .execute(&mut **transaction)
    .await?;

    for (mode_name, mode) in [("dark", &theme.dark), ("light", &theme.light)] {
        let mut references = vec![("background_image".to_owned(), &mode.background_image)];
        references.extend(
            mode.background_assets
                .iter()
                .enumerate()
                .map(|(index, asset)| (format!("background_assets.{index}.image"), &asset.image)),
        );
        for (field_key, value) in references {
            let Some(asset_id) = reusable_media_asset_id(value) else {
                continue;
            };
            sqlx::query(
                "INSERT INTO reusable_media_asset_references (asset_id, owner_kind, owner_id, field_key) VALUES ($1, $2, $3, $4)",
            )
            .bind(asset_id)
            .bind(JOURNAL_PRESENTATION_MEDIA_OWNER_KIND)
            .bind(JOURNAL_PRESENTATION_MEDIA_OWNER_ID)
            .bind(format!("{mode_name}.{field_key}"))
            .execute(&mut **transaction)
            .await?;
        }
    }
    Ok(())
}

fn reusable_media_asset_id(value: &str) -> Option<Uuid> {
    let path = value.strip_prefix(ADMIN_MEDIA_CONTENT_PREFIX)?;
    let (id, suffix) = path.split_once('/')?;
    (suffix == "content")
        .then(|| Uuid::parse_str(id).ok())
        .flatten()
}

async fn list(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    requested_page: i64,
) -> Result<AdminJournalFeedbackPage, sqlx::Error> {
    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*)::BIGINT FROM learner_journal_feedback_requests",
    )
    .fetch_one(application_pool)
    .await?;
    let last_page = ((total + PAGE_SIZE - 1) / PAGE_SIZE).max(1);
    let page = requested_page.min(last_page);
    let rows = sqlx::query_as::<_, Row>(
        "SELECT requests.id, requests.domain_type, requests.domain_group_id, requests.domain_label, requests.feedback, to_char(requests.requested_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS requested_at, CASE WHEN requests.responded_at IS NULL THEN NULL ELSE to_char(requests.responded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') END AS responded_at, pages.id AS page_id, pages.markdown AS page_markdown, pages.subtopic AS page_subtopic, pages.title AS page_title, pages.topic AS page_topic, principals.identity_subject_id AS requester_subject_id FROM learner_journal_feedback_requests AS requests INNER JOIN learner_journal_pages AS pages ON pages.id = requests.learner_journal_page_id INNER JOIN application_principals AS principals ON principals.id = requests.requester_principal_id ORDER BY requests.requested_at DESC, requests.id DESC LIMIT $1 OFFSET $2",
    ).bind(PAGE_SIZE).bind((page - 1) * PAGE_SIZE).fetch_all(application_pool).await?;
    let identities = load_identities(
        identity_pool,
        &rows
            .iter()
            .map(|row| row.requester_subject_id)
            .collect::<Vec<_>>(),
    )
    .await?;
    let items = rows
        .into_iter()
        .map(|row| {
            let requester = identities
                .get(&row.requester_subject_id)
                .map(|identity| AdminJournalFeedbackIdentity {
                    email: Some(identity.normalized_email.clone()),
                    name: identity.display_name.clone(),
                    subject_id: Some(identity.id.to_string()),
                })
                .unwrap_or(AdminJournalFeedbackIdentity {
                    email: None,
                    name: None,
                    subject_id: None,
                });
            AdminJournalFeedbackItem {
                domain: AdminJournalFeedbackDomain {
                    id: row.domain_group_id.map(|id| id.to_string()),
                    label: row.domain_label,
                    type_: row.domain_type,
                },
                feedback: row.feedback,
                id: row.id.to_string(),
                page: AdminJournalFeedbackPageContent {
                    id: Some(row.page_id.to_string()),
                    markdown: row.page_markdown,
                    subtopic: (!row.page_subtopic.is_empty()).then_some(row.page_subtopic),
                    title: row.page_title,
                    topic: row.page_topic,
                },
                requested_at: row.requested_at,
                requester,
                status: if row.responded_at.is_some() {
                    "responded".to_owned()
                } else {
                    "pending".to_owned()
                },
                responded_at: row.responded_at,
            }
        })
        .collect();
    Ok(AdminJournalFeedbackPage {
        items,
        pagination: AdminJournalFeedbackPagination {
            current_page: page,
            last_page,
            per_page: PAGE_SIZE,
            total,
        },
    })
}

async fn load_identities(
    pool: &PgPool,
    subject_ids: &[Uuid],
) -> Result<HashMap<Uuid, IdentityRow>, sqlx::Error> {
    let ids = subject_ids
        .iter()
        .copied()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    if ids.is_empty() {
        return Ok(HashMap::new());
    }
    sqlx::query_as::<_, IdentityRow>("SELECT subjects.id, subjects.normalized_email, profiles.display_name FROM identity_subjects AS subjects LEFT JOIN identity_profiles AS profiles ON profiles.subject_id = subjects.id WHERE subjects.id = ANY($1)")
        .bind(ids).fetch_all(pool).await.map(|rows| rows.into_iter().map(|row| (row.id, row)).collect())
}

async fn respond(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    request_id: Uuid,
    feedback: &str,
) -> Result<RespondJournalFeedbackResult, sqlx::Error> {
    let Some(reviewer_principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(RespondJournalFeedbackResult::NotFound);
    };
    let result = sqlx::query("UPDATE learner_journal_feedback_requests SET feedback = $3, reviewer_principal_id = $2, responded_at = NOW(), updated_at = NOW() WHERE id = $1 AND responded_at IS NULL")
        .bind(request_id).bind(reviewer_principal_id).bind(feedback).execute(pool).await?;
    if result.rows_affected() == 1 {
        return Ok(RespondJournalFeedbackResult::Responded);
    }
    let exists = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learner_journal_feedback_requests WHERE id = $1",
    )
    .bind(request_id)
    .fetch_optional(pool)
    .await?
    .is_some();
    Ok(if exists {
        RespondJournalFeedbackResult::AlreadyResponded
    } else {
        RespondJournalFeedbackResult::NotFound
    })
}

#[cfg(test)]
mod tests {
    use super::reusable_media_asset_id;
    use uuid::Uuid;

    #[test]
    fn journal_presentation_references_only_canonical_reusable_media_content_urls() {
        let asset = Uuid::new_v4();
        assert_eq!(
            reusable_media_asset_id(&format!("/api/v1/admin/media-assets/{asset}/content")),
            Some(asset)
        );
        assert_eq!(
            reusable_media_asset_id(&format!("/api/v1/admin/media-assets/{asset}/thumbnail")),
            None
        );
        assert_eq!(reusable_media_asset_id("/images/journal.png"), None);
    }
}
