use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_peer_message::{
    LearnerPeerMessageError, LearnerPeerMessageRepository,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerPeerMessage, LearnerPeerMessagePromptState, LearnerPeerMessageResponse,
        LearnerPeerMessageWall, LearningSupportPagination,
    },
};

use crate::learner_node_availability::PostgresLearnerNodeAvailability;

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
    node_id: Uuid,
    node_state: String,
    node_visual_config: Value,
}
#[derive(FromRow)]
struct Message {
    id: Uuid,
    body: String,
    principal_id: Uuid,
    has_responded: bool,
}
#[derive(FromRow)]
struct Reply {
    id: Uuid,
    message_id: Uuid,
    body: String,
    response_type: Option<String>,
    helpful_at: Option<String>,
}

impl LearnerPeerMessageRepository for PostgresLearnerPeerMessageRepository<'_> {
    fn load_prompt(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerPeerMessagePromptState>, LearnerPeerMessageError>,
    > + Send {
        async move {
            prompt(self.pool, principal, play_run_id, activity_slug)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load peer message prompt");
                    LearnerPeerMessageError
                })
        }
    }
    fn load_wall(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        page: i64,
        per_page: i64,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerPeerMessageWall>, LearnerPeerMessageError>,
    > + Send {
        async move {
            wall(
                self.pool,
                principal,
                play_run_id,
                activity_slug,
                page,
                per_page,
            )
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
        Output = Result<Option<LearnerPeerMessagePromptState>, LearnerPeerMessageError>,
    > + Send {
        async move {
            let Some(context) = context(
                self.pool,
                principal,
                play_run_id,
                activity_slug,
                "message_prompt",
            )
            .await
            .map_err(|_| LearnerPeerMessageError)?
            else {
                return Ok(None);
            };
            sqlx::query("INSERT INTO learner_messages (topic_id, principal_id, audience, body) VALUES ($1, $2, 'peers', $3) ON CONFLICT (topic_id, principal_id) DO NOTHING").bind(context.topic_id).bind(context.principal_id).bind(body).execute(self.pool).await.map_err(|_| LearnerPeerMessageError)?;
            prompt(self.pool, principal, play_run_id, activity_slug)
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
            let Some(context) = context(
                self.pool,
                principal,
                play_run_id,
                activity_slug,
                "message_wall",
            )
            .await
            .map_err(|_| LearnerPeerMessageError)?
            else {
                return Ok(None);
            };
            if !context.allow_responses {
                return Ok(None);
            };
            let mut transaction = self
                .pool
                .begin()
                .await
                .map_err(|_| LearnerPeerMessageError)?;
            let target = sqlx::query_scalar::<_, Uuid>("SELECT id FROM learner_messages WHERE id = $1 AND topic_id = $2 AND audience = 'peers' AND hidden_at IS NULL AND principal_id <> $3 FOR UPDATE")
                .bind(message_id)
                .bind(context.topic_id)
                .bind(context.principal_id)
                .fetch_optional(&mut *transaction)
                .await
                .map_err(|_| LearnerPeerMessageError)?;
            if target.is_none() {
                return Ok(None);
            }
            sqlx::query("INSERT INTO learner_message_responses (message_id, responder_principal_id, body, response_type) VALUES ($1, $2, $3, $4) ON CONFLICT (message_id, responder_principal_id) DO NOTHING")
                .bind(message_id)
                .bind(context.principal_id)
                .bind(body)
                .bind(response_type)
                .execute(&mut *transaction)
                .await
                .map_err(|_| LearnerPeerMessageError)?;
            transaction
                .commit()
                .await
                .map_err(|_| LearnerPeerMessageError)?;
            wall(self.pool, principal, play_run_id, activity_slug, 1, 12)
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
            let Some(context) = context(
                self.pool,
                principal,
                play_run_id,
                activity_slug,
                "message_wall",
            )
            .await
            .map_err(|_| LearnerPeerMessageError)?
            else {
                return Ok(None);
            };
            if !context.allow_responses {
                return Ok(None);
            }
            let mut transaction = self
                .pool
                .begin()
                .await
                .map_err(|_| LearnerPeerMessageError)?;
            // The source locks the parent first so two different helpful
            // choices serialize instead of locking responses in opposite order.
            let owner = sqlx::query_scalar::<_, Uuid>("SELECT id FROM learner_messages WHERE id = $1 AND topic_id = $2 AND audience = 'peers' AND principal_id = $3 AND hidden_at IS NULL FOR UPDATE").bind(message_id).bind(context.topic_id).bind(context.principal_id).fetch_optional(&mut *transaction).await.map_err(|_| LearnerPeerMessageError)?;
            if owner.is_none() {
                return Ok(None);
            };
            let response_exists = sqlx::query_scalar::<_, Uuid>("SELECT id FROM learner_message_responses WHERE id = $1 AND message_id = $2 AND hidden_at IS NULL FOR UPDATE")
                .bind(response_id)
                .bind(message_id)
                .fetch_optional(&mut *transaction)
                .await
                .map_err(|_| LearnerPeerMessageError)?
                .is_some();
            if !response_exists {
                return Ok(None);
            }
            if helpful {
                sqlx::query(
                    "UPDATE learner_message_responses SET helpful_at = NULL WHERE message_id = $1",
                )
                .bind(message_id)
                .execute(&mut *transaction)
                .await
                .map_err(|_| LearnerPeerMessageError)?;
            }
            let updated = sqlx::query("UPDATE learner_message_responses SET helpful_at = CASE WHEN $3 THEN NOW() ELSE NULL END WHERE id = $1 AND message_id = $2")
                .bind(response_id)
                .bind(message_id)
                .bind(helpful)
                .execute(&mut *transaction)
                .await
                .map_err(|_| LearnerPeerMessageError)?;
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
    activity_type: &str,
) -> Result<Option<Context>, sqlx::Error> {
    let context = sqlx::query_as::<_, Context>("SELECT progress.principal_id, topics.id AS topic_id, topics.title AS topic_title, COALESCE((activities.activity_config ->> 'messageAllowResponses')::boolean, false) AS allow_responses, nodes.id AS node_id, nodes.state AS node_state, nodes.visual_config AS node_visual_config FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id AND nodes.id = progress.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id AND assets.id = nodes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id INNER JOIN learning_message_topics AS topics ON topics.id::text = activities.activity_config ->> 'messageTopicId' AND topics.map_asset_id = assets.id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND ($3 = 'id:' || activities.id::text OR (left($3, 3) <> 'id:' AND activities.slug = $3)) AND activities.activity_type = $4 AND activities.activity_config ->> 'messageAudience' = 'peers' AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($5)))")
        .bind(principal.subject_id)
        .bind(run)
        .bind(slug)
        .bind(activity_type)
        .bind(&principal.roles)
        .fetch_optional(pool)
        .await?;
    let Some(context) = context else {
        return Ok(None);
    };
    let Some(availability) = PostgresLearnerNodeAvailability::load(pool, principal).await? else {
        return Ok(None);
    };
    Ok(availability
        .state_for_node(
            context.node_id,
            &context.node_state,
            &context.node_visual_config,
        )
        .can_play()
        .then_some(context))
}

async fn prompt(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    run: Uuid,
    slug: &str,
) -> Result<Option<LearnerPeerMessagePromptState>, sqlx::Error> {
    let Some(context) = context(pool, principal, run, slug, "message_prompt").await? else {
        return Ok(None);
    };
    let has_contributed = sqlx::query_scalar::<_, bool>("SELECT EXISTS (SELECT 1 FROM learner_messages WHERE topic_id = $1 AND principal_id = $2 AND audience = 'peers')")
        .bind(context.topic_id)
        .bind(context.principal_id)
        .fetch_one(pool)
        .await?;
    Ok(Some(LearnerPeerMessagePromptState {
        has_contributed,
        topic_title: context.topic_title,
    }))
}

async fn wall(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    run: Uuid,
    slug: &str,
    page: i64,
    per_page: i64,
) -> Result<Option<LearnerPeerMessageWall>, sqlx::Error> {
    let Some(context) = context(pool, principal, run, slug, "message_wall").await? else {
        return Ok(None);
    };
    let total = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM learner_messages WHERE topic_id = $1 AND audience = 'peers' AND hidden_at IS NULL").bind(context.topic_id).fetch_one(pool).await?;
    let per_page = per_page.clamp(1, 12);
    let page = page.max(1);
    let rows = sqlx::query_as::<_, Message>("WITH newest_messages AS (SELECT id, body, principal_id FROM learner_messages WHERE topic_id = $1 AND audience = 'peers' AND hidden_at IS NULL ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $2) SELECT id, body, principal_id, EXISTS (SELECT 1 FROM learner_message_responses AS responses WHERE responses.message_id = newest_messages.id AND responses.responder_principal_id = $4) AS has_responded FROM newest_messages ORDER BY RANDOM()")
        .bind(context.topic_id)
        .bind((page - 1) * per_page)
        .bind(per_page)
        .bind(context.principal_id)
        .fetch_all(pool)
        .await?;
    let ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
    let replies = if context.allow_responses && !ids.is_empty() {
        sqlx::query_as::<_, Reply>("WITH ranked_responses AS (SELECT id, message_id, body, response_type, to_char(helpful_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS helpful_at, created_at, ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY created_at DESC, id DESC) AS response_rank, ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY CASE WHEN helpful_at IS NOT NULL THEN 0 ELSE 1 END, helpful_at DESC, created_at DESC, id DESC) AS helpful_rank FROM learner_message_responses WHERE message_id = ANY($1) AND hidden_at IS NULL) SELECT id, message_id, body, response_type, helpful_at FROM ranked_responses WHERE response_rank <= 3 OR (helpful_at IS NOT NULL AND helpful_rank = 1) ORDER BY message_id, created_at ASC, id ASC")
        .bind(&ids)
        .fetch_all(pool)
        .await?
    } else {
        Vec::new()
    };
    let messages = rows
        .into_iter()
        .map(|message| LearnerPeerMessage {
            body: message.body,
            can_respond: context.allow_responses && message.principal_id != context.principal_id,
            has_responded: context.allow_responses && message.has_responded,
            id: message.id.to_string(),
            responses: replies
                .iter()
                .filter(|reply| reply.message_id == message.id)
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
            last_page: ((total + per_page - 1) / per_page).max(1),
            per_page,
            total,
        },
        topic_title: context.topic_title,
    }))
}
