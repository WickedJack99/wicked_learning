use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_peer_message::{
    LearnerPeerMessageError, LearnerPeerMessageRepository,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerPeerMessage, LearnerPeerMessageResponse, LearnerPeerMessageWall,
        LearningSupportPagination,
    },
};

pub struct PostgresLearnerPeerMessageRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerPeerMessageRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct Context {
    principal_id: Uuid,
    topic_id: Uuid,
    topic_title: String,
    allow_responses: bool,
}
#[derive(FromRow)]
struct Message {
    id: Uuid,
    body: String,
    principal_id: Uuid,
}
#[derive(FromRow)]
struct Reply {
    id: Uuid,
    message_id: Uuid,
    body: String,
    response_type: Option<String>,
    helpful_at: Option<String>,
    responder_principal_id: Uuid,
}

impl LearnerPeerMessageRepository for PostgresLearnerPeerMessageRepository<'_> {
    fn load_wall(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        page: i64,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerPeerMessageWall>, LearnerPeerMessageError>,
    > + Send {
        async move {
            wall(self.pool, principal, play_run_id, activity_slug, page)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load peer message wall");
                    LearnerPeerMessageError
                })
        }
    }
    fn contribute(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        body: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerPeerMessageWall>, LearnerPeerMessageError>,
    > + Send {
        async move {
            let Some(context) = context(self.pool, principal, play_run_id, activity_slug)
                .await
                .map_err(|_| LearnerPeerMessageError)?
            else {
                return Ok(None);
            };
            sqlx::query("INSERT INTO learner_messages (topic_id, principal_id, audience, body) VALUES ($1, $2, 'peers', $3) ON CONFLICT (topic_id, principal_id) DO NOTHING").bind(context.topic_id).bind(context.principal_id).bind(body).execute(self.pool).await.map_err(|_| LearnerPeerMessageError)?;
            wall(self.pool, principal, play_run_id, activity_slug, 1)
                .await
                .map_err(|_| LearnerPeerMessageError)
        }
    }
    fn respond(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        message_id: Uuid,
        body: &str,
        response_type: Option<&str>,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerPeerMessageWall>, LearnerPeerMessageError>,
    > + Send {
        async move {
            let Some(context) = context(self.pool, principal, play_run_id, activity_slug)
                .await
                .map_err(|_| LearnerPeerMessageError)?
            else {
                return Ok(None);
            };
            if !context.allow_responses {
                return Ok(None);
            };
            let inserted = sqlx::query("INSERT INTO learner_message_responses (message_id, responder_principal_id, body, response_type) SELECT id, $2, $3, $4 FROM learner_messages WHERE id = $1 AND topic_id = $5 AND audience = 'peers' AND hidden_at IS NULL AND principal_id <> $2 ON CONFLICT (message_id, responder_principal_id) DO NOTHING").bind(message_id).bind(context.principal_id).bind(body).bind(response_type).bind(context.topic_id).execute(self.pool).await.map_err(|_| LearnerPeerMessageError)?;
            if inserted.rows_affected() == 0 {
                return Ok(None);
            };
            wall(self.pool, principal, play_run_id, activity_slug, 1)
                .await
                .map_err(|_| LearnerPeerMessageError)
        }
    }
    fn mark_helpful(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        message_id: Uuid,
        response_id: Uuid,
        helpful: bool,
    ) -> impl std::future::Future<Output = Result<Option<bool>, LearnerPeerMessageError>> + Send
    {
        async move {
            let Some(context) = context(self.pool, principal, play_run_id, activity_slug)
                .await
                .map_err(|_| LearnerPeerMessageError)?
            else {
                return Ok(None);
            };
            let mut transaction = self
                .pool
                .begin()
                .await
                .map_err(|_| LearnerPeerMessageError)?;
            let owner = sqlx::query_scalar::<_, bool>("SELECT EXISTS (SELECT 1 FROM learner_messages WHERE id = $1 AND topic_id = $2 AND audience = 'peers' AND principal_id = $3 AND hidden_at IS NULL)").bind(message_id).bind(context.topic_id).bind(context.principal_id).fetch_one(&mut *transaction).await.map_err(|_| LearnerPeerMessageError)?;
            if !owner {
                transaction
                    .commit()
                    .await
                    .map_err(|_| LearnerPeerMessageError)?;
                return Ok(None);
            };
            if helpful {
                sqlx::query(
                    "UPDATE learner_message_responses SET helpful_at = NULL WHERE message_id = $1",
                )
                .bind(message_id)
                .execute(&mut *transaction)
                .await
                .map_err(|_| LearnerPeerMessageError)?;
            }
            let updated = sqlx::query("UPDATE learner_message_responses SET helpful_at = CASE WHEN $3 THEN NOW() ELSE NULL END WHERE id = $1 AND message_id = $2 AND hidden_at IS NULL").bind(response_id).bind(message_id).bind(helpful).execute(&mut *transaction).await.map_err(|_| LearnerPeerMessageError)?;
            transaction
                .commit()
                .await
                .map_err(|_| LearnerPeerMessageError)?;
            (updated.rows_affected() == 1)
                .then_some(helpful)
                .ok_or(LearnerPeerMessageError)
                .map(Some)
        }
    }
}

async fn context(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    run: Uuid,
    slug: &str,
) -> Result<Option<Context>, sqlx::Error> {
    sqlx::query_as::<_, Context>("SELECT progress.principal_id, topics.id AS topic_id, topics.title AS topic_title, COALESCE((activities.activity_config ->> 'messageAllowResponses')::boolean, false) AS allow_responses FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_message_topics AS topics ON topics.id::text = activities.activity_config ->> 'messageTopicId' AND topics.map_asset_id = assets.id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'message_wall' AND activities.activity_config ->> 'messageAudience' = 'peers'").bind(principal.subject_id).bind(run).bind(slug).fetch_optional(pool).await
}

async fn wall(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    run: Uuid,
    slug: &str,
    page: i64,
) -> Result<Option<LearnerPeerMessageWall>, sqlx::Error> {
    let Some(context) = context(pool, principal, run, slug).await? else {
        return Ok(None);
    };
    let total = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM learner_messages WHERE topic_id = $1 AND audience = 'peers' AND hidden_at IS NULL").bind(context.topic_id).fetch_one(pool).await?;
    let page = page.clamp(1, ((total + 9) / 10).max(1));
    let rows = sqlx::query_as::<_, Message>("SELECT id, body, principal_id FROM learner_messages WHERE topic_id = $1 AND audience = 'peers' AND hidden_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 10 OFFSET $2").bind(context.topic_id).bind((page - 1) * 10).fetch_all(pool).await?;
    let ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
    let replies = sqlx::query_as::<_, Reply>("SELECT id, message_id, body, response_type, to_char(helpful_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS helpful_at, responder_principal_id FROM learner_message_responses WHERE message_id = ANY($1) AND hidden_at IS NULL ORDER BY created_at DESC, id DESC").bind(&ids).fetch_all(pool).await?;
    let messages = rows
        .into_iter()
        .map(|message| LearnerPeerMessage {
            body: message.body,
            can_respond: context.allow_responses && message.principal_id != context.principal_id,
            has_responded: replies.iter().any(|reply| {
                reply.message_id == message.id
                    && reply.responder_principal_id == context.principal_id
            }),
            id: message.id.to_string(),
            responses: replies
                .iter()
                .filter(|reply| reply.message_id == message.id)
                .take(3)
                .map(|reply| LearnerPeerMessageResponse {
                    body: reply.body.clone(),
                    can_mark_helpful: message.principal_id == context.principal_id,
                    id: reply.id.to_string(),
                    is_helpful: reply.helpful_at.is_some(),
                    response_type: reply.response_type.clone(),
                })
                .collect(),
        })
        .collect();
    let contributed = sqlx::query_scalar::<_, bool>("SELECT EXISTS (SELECT 1 FROM learner_messages WHERE topic_id = $1 AND principal_id = $2 AND audience = 'peers')").bind(context.topic_id).bind(context.principal_id).fetch_one(pool).await?;
    Ok(Some(LearnerPeerMessageWall {
        has_contributed: contributed,
        messages,
        pagination: LearningSupportPagination {
            current_page: page,
            last_page: ((total + 9) / 10).max(1),
            per_page: 10,
            total,
        },
        topic_title: context.topic_title,
    }))
}
