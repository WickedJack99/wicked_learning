use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_journal_feedback::{
    LearnerJournalFeedbackError, LearnerJournalFeedbackRepository as Port,
    RequestJournalFeedbackResult,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerJournalPage,
};

use crate::learner_journal_page::load_owned_page;

pub struct PostgresLearnerJournalFeedbackRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerJournalFeedbackRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresLearnerJournalFeedbackRepository<'_> {
    fn request(
        &self,
        principal: &AuthorizedPrincipal,
        page_id: Uuid,
        domain_key: &str,
    ) -> impl std::future::Future<
        Output = Result<
            (RequestJournalFeedbackResult, Option<LearnerJournalPage>),
            LearnerJournalFeedbackError,
        >,
    > + Send {
        async move {
            request(self.pool, principal, page_id, domain_key)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not request journal feedback");
                    LearnerJournalFeedbackError
                })
        }
    }
}

async fn request(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    page_id: Uuid,
    domain_key: &str,
) -> Result<(RequestJournalFeedbackResult, Option<LearnerJournalPage>), sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) =
        application_principal_id(&mut transaction, principal.subject_id).await?
    else {
        return Ok((RequestJournalFeedbackResult::NotFound, None));
    };
    let allowed = sqlx::query_scalar::<_, bool>(
        "SELECT allow_review_requests FROM application_journal_feedback_policy WHERE singleton = TRUE FOR SHARE",
    )
    .fetch_optional(&mut *transaction)
    .await?
    .unwrap_or(false);
    if !allowed {
        return Ok((RequestJournalFeedbackResult::Disabled, None));
    }
    let owns_page = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learner_journal_pages WHERE id = $1 AND principal_id = $2 FOR UPDATE",
    )
    .bind(page_id)
    .bind(principal_id)
    .fetch_optional(&mut *transaction)
    .await?
    .is_some();
    if !owns_page {
        return Ok((RequestJournalFeedbackResult::NotFound, None));
    }
    let Some(domain) = resolve_domain(&mut transaction, principal_id, domain_key).await? else {
        return Ok((RequestJournalFeedbackResult::InvalidDomain, None));
    };
    let existing_responded = sqlx::query_scalar::<_, Option<String>>(
        "SELECT CASE WHEN responded_at IS NULL THEN NULL ELSE 'responded' END FROM learner_journal_feedback_requests WHERE learner_journal_page_id = $1 FOR UPDATE",
    )
    .bind(page_id)
    .fetch_optional(&mut *transaction)
    .await?;
    if existing_responded
        .as_ref()
        .is_some_and(|response| response.is_some())
    {
        return Ok((RequestJournalFeedbackResult::AlreadyResponded, None));
    }
    sqlx::query("UPDATE learner_journal_pages SET expert_access_requested = TRUE, updated_at = NOW() WHERE id = $1")
        .bind(page_id)
        .execute(&mut *transaction)
        .await?;
    if existing_responded.is_none() {
        sqlx::query(
            "INSERT INTO learner_journal_feedback_requests (learner_journal_page_id, requester_principal_id, domain_type, domain_group_id, domain_label) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(page_id)
        .bind(principal_id)
        .bind(&domain.type_)
        .bind(domain.group_id)
        .bind(&domain.label)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;
    let page = load_owned_page(pool, principal_id, page_id).await?;
    Ok((RequestJournalFeedbackResult::Requested, page))
}

struct FeedbackDomain {
    group_id: Option<Uuid>,
    label: String,
    type_: String,
}

async fn resolve_domain(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    key: &str,
) -> Result<Option<FeedbackDomain>, sqlx::Error> {
    if key == "journal" {
        return Ok(Some(FeedbackDomain {
            group_id: None,
            label: "Journal".to_owned(),
            type_: "journal".to_owned(),
        }));
    }
    let Some(group_id) = key
        .strip_prefix("group:")
        .and_then(|id| Uuid::parse_str(id).ok())
    else {
        return Ok(None);
    };
    let name = sqlx::query_scalar::<_, String>(
        "SELECT groups.name FROM learning_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.id WHERE groups.id = $1 AND memberships.principal_id = $2",
    )
    .bind(group_id)
    .bind(principal_id)
    .fetch_optional(&mut **transaction)
    .await?;
    Ok(name.map(|name| FeedbackDomain {
        group_id: Some(group_id),
        label: format!("Group: {name}"),
        type_: "group".to_owned(),
    }))
}

async fn application_principal_id(
    transaction: &mut Transaction<'_, Postgres>,
    subject_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(subject_id)
        .fetch_optional(&mut **transaction)
        .await
}
