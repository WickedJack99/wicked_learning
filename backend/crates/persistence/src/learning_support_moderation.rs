use std::collections::HashMap;

use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learning_support_moderation::{
    LearningSupportModerationError,
    LearningSupportModerationRepository as LearningSupportModerationRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearningSupportIdentity, LearningSupportModerationReply, LearningSupportModerationRequest,
        LearningSupportPagination, LearningSupportRequestPage, LearningSupportTopic,
    },
};

const REQUEST_PAGE_SIZE: i64 = 6;
const RESPONSES_PER_REQUEST: i64 = 3;

pub struct PostgresLearningSupportModerationRepository<'pool> {
    application_pool: &'pool PgPool,
    identity_pool: &'pool PgPool,
}

impl<'pool> PostgresLearningSupportModerationRepository<'pool> {
    pub fn new(application_pool: &'pool PgPool, identity_pool: &'pool PgPool) -> Self {
        Self {
            application_pool,
            identity_pool,
        }
    }
}

#[derive(FromRow)]
struct TopicRow {
    id: Uuid,
    map_asset_title: String,
    map_title: String,
    request_count: i64,
    title: String,
}

#[derive(FromRow)]
struct RequestRow {
    author_subject_id: Uuid,
    body: String,
    created_at: String,
    hidden_at: Option<String>,
    id: Uuid,
}

#[derive(FromRow)]
struct ReplyRow {
    author_subject_id: Uuid,
    body: String,
    created_at: String,
    hidden_at: Option<String>,
    id: Uuid,
    message_id: Uuid,
}

#[derive(FromRow)]
struct IdentityRow {
    id: Uuid,
    normalized_email: String,
}

#[derive(FromRow)]
struct SavedReplyRow {
    author_subject_id: Uuid,
    body: String,
    created_at: String,
    hidden_at: Option<String>,
    id: Uuid,
}

impl LearningSupportModerationRepositoryPort for PostgresLearningSupportModerationRepository<'_> {
    fn list_topics(
        &self,
    ) -> impl std::future::Future<
        Output = Result<Vec<LearningSupportTopic>, LearningSupportModerationError>,
    > + Send {
        async move {
            list_topics(self.application_pool).await.map_err(|error| {
                tracing::error!(%error, "could not load Learning Support topics");
                LearningSupportModerationError
            })
        }
    }

    fn list_requests(
        &self,
        topic_id: Uuid,
        page: i64,
    ) -> impl std::future::Future<
        Output = Result<Option<LearningSupportRequestPage>, LearningSupportModerationError>,
    > + Send {
        async move {
            list_requests(self.application_pool, self.identity_pool, topic_id, page)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load private Learning Support requests");
                    LearningSupportModerationError
                })
        }
    }

    fn save_reply(
        &self,
        principal: &AuthorizedPrincipal,
        message_id: Uuid,
        body: &str,
    ) -> impl std::future::Future<
        Output = Result<
            Option<(LearningSupportModerationReply, bool)>,
            LearningSupportModerationError,
        >,
    > + Send {
        async move {
            save_reply(
                self.application_pool,
                self.identity_pool,
                principal,
                message_id,
                body,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not save private Learning Support reply");
                LearningSupportModerationError
            })
        }
    }
}

async fn list_topics(pool: &PgPool) -> Result<Vec<LearningSupportTopic>, sqlx::Error> {
    sqlx::query_as::<_, TopicRow>(
        "SELECT topics.id, assets.title AS map_asset_title, maps.title AS map_title, COUNT(messages.id)::BIGINT AS request_count, topics.title \
         FROM learning_message_topics AS topics \
         INNER JOIN learner_messages AS messages ON messages.topic_id = topics.id AND messages.audience = 'support' \
         INNER JOIN learning_map_assets AS assets ON assets.id = topics.map_asset_id \
         INNER JOIN learning_maps AS maps ON maps.id = assets.map_id \
         GROUP BY topics.id, assets.title, maps.title, topics.title \
         ORDER BY maps.title ASC, assets.title ASC, topics.title ASC, topics.id ASC",
    )
    .fetch_all(pool)
    .await
    .map(|rows| {
        rows
            .into_iter()
            .map(|row| LearningSupportTopic {
                id: row.id.to_string(),
                map_asset_title: row.map_asset_title,
                map_title: row.map_title,
                request_count: row.request_count,
                title: row.title,
            })
            .collect()
    })
}

async fn list_requests(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    topic_id: Uuid,
    page: i64,
) -> Result<Option<LearningSupportRequestPage>, sqlx::Error> {
    let topic = sqlx::query_as::<_, TopicRow>(
        "SELECT topics.id, assets.title AS map_asset_title, maps.title AS map_title, COUNT(messages.id)::BIGINT AS request_count, topics.title \
         FROM learning_message_topics AS topics \
         INNER JOIN learning_map_assets AS assets ON assets.id = topics.map_asset_id \
         INNER JOIN learning_maps AS maps ON maps.id = assets.map_id \
         LEFT JOIN learner_messages AS messages ON messages.topic_id = topics.id AND messages.audience = 'support' \
         WHERE topics.id = $1 \
         GROUP BY topics.id, assets.title, maps.title, topics.title",
    )
    .bind(topic_id)
    .fetch_optional(application_pool)
    .await?;
    let Some(topic) = topic else {
        return Ok(None);
    };
    if topic.request_count == 0 {
        return Ok(None);
    }

    let offset = (page - 1) * REQUEST_PAGE_SIZE;
    let request_rows = sqlx::query_as::<_, RequestRow>(
        "SELECT identities.identity_subject_id AS author_subject_id, messages.body, \
            to_char(messages.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, \
            CASE WHEN messages.hidden_at IS NULL THEN NULL ELSE to_char(messages.hidden_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') END AS hidden_at, messages.id \
         FROM learner_messages AS messages \
         INNER JOIN application_principals AS identities ON identities.id = messages.principal_id \
         WHERE messages.topic_id = $1 AND messages.audience = 'support' \
         ORDER BY messages.created_at DESC, messages.id DESC LIMIT $2 OFFSET $3",
    )
    .bind(topic_id)
    .bind(REQUEST_PAGE_SIZE)
    .bind(offset)
    .fetch_all(application_pool)
    .await?;
    let message_ids = request_rows.iter().map(|row| row.id).collect::<Vec<_>>();
    let reply_rows = if message_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, ReplyRow>(
            "SELECT author_subject_id, body, created_at, hidden_at, id, message_id FROM ( \
                SELECT responders.identity_subject_id AS author_subject_id, responses.body, \
                    to_char(responses.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, \
                    CASE WHEN responses.hidden_at IS NULL THEN NULL ELSE to_char(responses.hidden_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') END AS hidden_at, \
                    responses.id, responses.message_id, ROW_NUMBER() OVER (PARTITION BY responses.message_id ORDER BY responses.created_at DESC, responses.id DESC) AS row_number \
                FROM learner_message_responses AS responses \
                INNER JOIN application_principals AS responders ON responders.id = responses.responder_principal_id \
                WHERE responses.message_id = ANY($1) \
            ) AS bounded WHERE row_number <= $2 ORDER BY message_id ASC, created_at ASC, id ASC",
        )
        .bind(&message_ids)
        .bind(RESPONSES_PER_REQUEST)
        .fetch_all(application_pool)
        .await?
    };
    let subject_ids = request_rows
        .iter()
        .map(|row| row.author_subject_id)
        .chain(reply_rows.iter().map(|row| row.author_subject_id))
        .collect::<Vec<_>>();
    let identities = load_identities(identity_pool, &subject_ids).await?;
    let mut replies_by_message = HashMap::<Uuid, Vec<LearningSupportModerationReply>>::new();
    for reply in reply_rows {
        replies_by_message
            .entry(reply.message_id)
            .or_default()
            .push(LearningSupportModerationReply {
                author: identity_for(&identities, reply.author_subject_id)?,
                body: reply.body,
                created_at: reply.created_at,
                hidden_at: reply.hidden_at,
                id: reply.id.to_string(),
            });
    }
    let requests = request_rows
        .into_iter()
        .map(|request| {
            Ok(LearningSupportModerationRequest {
                author: identity_for(&identities, request.author_subject_id)?,
                body: request.body,
                created_at: request.created_at,
                hidden_at: request.hidden_at,
                id: request.id.to_string(),
                responses: replies_by_message.remove(&request.id).unwrap_or_default(),
            })
        })
        .collect::<Result<Vec<_>, sqlx::Error>>()?;
    let last_page = ((topic.request_count + REQUEST_PAGE_SIZE - 1) / REQUEST_PAGE_SIZE).max(1);

    Ok(Some(LearningSupportRequestPage {
        pagination: LearningSupportPagination {
            current_page: page.min(last_page),
            last_page,
            per_page: REQUEST_PAGE_SIZE,
            total: topic.request_count,
        },
        requests,
        topic: LearningSupportTopic {
            id: topic.id.to_string(),
            map_asset_title: topic.map_asset_title,
            map_title: topic.map_title,
            request_count: topic.request_count,
            title: topic.title,
        },
    }))
}

async fn save_reply(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    principal: &AuthorizedPrincipal,
    message_id: Uuid,
    body: &str,
) -> Result<Option<(LearningSupportModerationReply, bool)>, sqlx::Error> {
    let mut transaction = application_pool.begin().await?;
    let existing = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_message_responses AS responses INNER JOIN application_principals AS responders ON responders.id = responses.responder_principal_id WHERE responses.message_id = $1 AND responders.identity_subject_id = $2)",
    )
    .bind(message_id)
    .bind(principal.subject_id)
    .fetch_one(&mut *transaction)
    .await?;
    let saved = sqlx::query_as::<_, SavedReplyRow>(
        "INSERT INTO learner_message_responses (message_id, responder_principal_id, body) \
         SELECT messages.id, responders.id, $3 FROM learner_messages AS messages \
         INNER JOIN application_principals AS responders ON responders.identity_subject_id = $2 \
         WHERE messages.id = $1 AND messages.audience = 'support' \
         ON CONFLICT (message_id, responder_principal_id) DO UPDATE SET body = EXCLUDED.body, updated_at = NOW() \
         RETURNING body, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, \
             CASE WHEN hidden_at IS NULL THEN NULL ELSE to_char(hidden_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') END AS hidden_at, id, $2 AS author_subject_id",
    )
    .bind(message_id)
    .bind(principal.subject_id)
    .bind(body)
    .fetch_optional(&mut *transaction)
    .await?;
    transaction.commit().await?;
    let Some(saved) = saved else {
        return Ok(None);
    };
    let identities = load_identities(identity_pool, &[saved.author_subject_id]).await?;
    let response = LearningSupportModerationReply {
        author: identity_for(&identities, saved.author_subject_id)?,
        body: saved.body,
        created_at: saved.created_at,
        hidden_at: saved.hidden_at,
        id: saved.id.to_string(),
    };
    Ok(Some((response, !existing)))
}

async fn load_identities(
    identity_pool: &PgPool,
    subject_ids: &[Uuid],
) -> Result<HashMap<Uuid, String>, sqlx::Error> {
    let unique_subject_ids = subject_ids
        .iter()
        .copied()
        .collect::<std::collections::BTreeSet<_>>();
    if unique_subject_ids.is_empty() {
        return Ok(HashMap::new());
    }
    sqlx::query_as::<_, IdentityRow>(
        "SELECT id, normalized_email FROM identity_subjects WHERE id = ANY($1)",
    )
    .bind(unique_subject_ids.into_iter().collect::<Vec<_>>())
    .fetch_all(identity_pool)
    .await
    .map(|rows| {
        rows.into_iter()
            .map(|row| (row.id, row.normalized_email))
            .collect()
    })
}

fn identity_for(
    identities: &HashMap<Uuid, String>,
    subject_id: Uuid,
) -> Result<LearningSupportIdentity, sqlx::Error> {
    let Some(email) = identities.get(&subject_id) else {
        return Err(sqlx::Error::RowNotFound);
    };
    Ok(LearningSupportIdentity {
        email: email.clone(),
        subject_id: subject_id.to_string(),
    })
}
