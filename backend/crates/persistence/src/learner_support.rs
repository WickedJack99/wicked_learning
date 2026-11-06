use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_support::{
    LearnerSupportError, LearnerSupportRepository as LearnerSupportRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerDeskSupportResponse, LearnerSupportReply, LearnerSupportRequest,
        LearnerSupportRequestState,
    },
};

pub struct PostgresLearnerSupportRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerSupportRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct SupportContextRow {
    principal_id: Uuid,
    topic_id: Uuid,
    topic_title: String,
}

#[derive(FromRow)]
struct SupportMessageRow {
    body: String,
    id: Uuid,
}

#[derive(FromRow)]
struct SupportReplyRow {
    body: String,
    created_at: String,
    id: Uuid,
}

#[derive(FromRow)]
struct DeskReplyRow {
    body: String,
    created_at: String,
    id: Uuid,
    map_slug: String,
    map_title: String,
    node_slug: String,
    node_title: String,
    topic_title: String,
}

impl LearnerSupportRepositoryPort for PostgresLearnerSupportRepository<'_> {
    fn load_current_request(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerSupportRequestState>, LearnerSupportError>,
    > + Send {
        async move {
            load_current_request(self.pool, principal, play_run_id, activity_slug)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load a private learning support request");
                    LearnerSupportError
                })
        }
    }

    fn submit_current_request(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        body: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerSupportRequestState>, LearnerSupportError>,
    > + Send {
        async move {
            submit_current_request(self.pool, principal, play_run_id, activity_slug, body)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not save a private learning support request");
                    LearnerSupportError
                })
        }
    }

    fn load_desk_responses(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl std::future::Future<
        Output = Result<Vec<LearnerDeskSupportResponse>, LearnerSupportError>,
    > + Send {
        async move {
            load_desk_responses(self.pool, principal)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load Learning Desk support replies");
                    LearnerSupportError
                })
        }
    }
}

async fn load_current_request(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<LearnerSupportRequestState>, sqlx::Error> {
    let context = load_support_context(pool, principal, play_run_id, activity_slug).await?;
    let Some(context) = context else {
        return Ok(None);
    };

    request_state(pool, context).await
}

async fn submit_current_request(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    body: &str,
) -> Result<Option<LearnerSupportRequestState>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let context =
        load_support_context_for_update(&mut transaction, principal, play_run_id, activity_slug)
            .await?;
    let Some(context) = context else {
        transaction.commit().await?;
        return Ok(None);
    };

    sqlx::query(
        "INSERT INTO learner_messages (topic_id, principal_id, audience, body) \
         VALUES ($1, $2, 'support', $3) \
         ON CONFLICT (topic_id, principal_id) DO NOTHING",
    )
    .bind(context.topic_id)
    .bind(context.principal_id)
    .bind(body)
    .execute(&mut *transaction)
    .await?;

    let state = request_state_transaction(&mut transaction, context).await?;
    transaction.commit().await?;
    Ok(Some(state))
}

async fn request_state(
    pool: &PgPool,
    context: SupportContextRow,
) -> Result<Option<LearnerSupportRequestState>, sqlx::Error> {
    let has_contributed = support_contribution_exists(pool, &context).await?;
    let message = load_support_message(pool, &context).await?;
    Ok(Some(
        state_from_message(pool, context, has_contributed, message).await?,
    ))
}

async fn request_state_transaction(
    transaction: &mut Transaction<'_, Postgres>,
    context: SupportContextRow,
) -> Result<LearnerSupportRequestState, sqlx::Error> {
    let has_contributed = support_contribution_exists(&mut **transaction, &context).await?;
    let message = load_support_message(&mut **transaction, &context).await?;
    state_from_message(&mut **transaction, context, has_contributed, message).await
}

async fn state_from_message<'executor, Executor>(
    executor: Executor,
    context: SupportContextRow,
    has_contributed: bool,
    message: Option<SupportMessageRow>,
) -> Result<LearnerSupportRequestState, sqlx::Error>
where
    Executor: sqlx::Executor<'executor, Database = Postgres>,
{
    let message = match message {
        Some(message) => {
            let replies = sqlx::query_as::<_, SupportReplyRow>(
                "SELECT body, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, id \
                 FROM (SELECT body, created_at, id FROM learner_message_responses \
                       WHERE message_id = $1 AND hidden_at IS NULL \
                       ORDER BY created_at DESC, id DESC LIMIT 3) AS recent \
                 ORDER BY created_at ASC, id ASC",
            )
            .bind(message.id)
            .fetch_all(executor)
            .await?
            .into_iter()
            .map(|reply| LearnerSupportReply {
                body: reply.body,
                created_at: reply.created_at,
                id: reply.id.to_string(),
            })
            .collect();
            Some(LearnerSupportRequest {
                body: message.body,
                id: message.id.to_string(),
                responses: replies,
            })
        }
        None => None,
    };

    Ok(LearnerSupportRequestState {
        has_contributed,
        message,
        topic_title: context.topic_title,
    })
}

/// A hidden request remains a consumed private-support contribution. This
/// preserves the source workflow's one-request boundary without exposing the
/// moderated body back to its author.
async fn support_contribution_exists<'executor, Executor>(
    executor: Executor,
    context: &SupportContextRow,
) -> Result<bool, sqlx::Error>
where
    Executor: sqlx::Executor<'executor, Database = Postgres>,
{
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_messages WHERE topic_id = $1 AND principal_id = $2 AND audience = 'support')",
    )
    .bind(context.topic_id)
    .bind(context.principal_id)
    .fetch_one(executor)
    .await
}

async fn load_support_message<'executor, Executor>(
    executor: Executor,
    context: &SupportContextRow,
) -> Result<Option<SupportMessageRow>, sqlx::Error>
where
    Executor: sqlx::Executor<'executor, Database = Postgres>,
{
    sqlx::query_as::<_, SupportMessageRow>(
        "SELECT body, id FROM learner_messages \
         WHERE topic_id = $1 AND principal_id = $2 AND audience = 'support' AND hidden_at IS NULL",
    )
    .bind(context.topic_id)
    .bind(context.principal_id)
    .fetch_optional(executor)
    .await
}

async fn load_support_context(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<SupportContextRow>, sqlx::Error> {
    if let Some(context) =
        load_route_support_context(pool, principal, play_run_id, activity_slug, false).await?
    {
        return Ok(Some(context));
    }

    load_replay_support_context(pool, principal, play_run_id, activity_slug, false).await
}

async fn load_support_context_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<SupportContextRow>, sqlx::Error> {
    if let Some(context) = load_route_support_context(
        &mut **transaction,
        principal,
        play_run_id,
        activity_slug,
        true,
    )
    .await?
    {
        return Ok(Some(context));
    }

    load_replay_support_context(
        &mut **transaction,
        principal,
        play_run_id,
        activity_slug,
        true,
    )
    .await
}

async fn load_route_support_context<'executor, Executor>(
    executor: Executor,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    lock: bool,
) -> Result<Option<SupportContextRow>, sqlx::Error>
where
    Executor: sqlx::Executor<'executor, Database = Postgres>,
{
    let lock_clause = if lock { " FOR UPDATE OF progress" } else { "" };
    let statement = format!(
        "SELECT progress.principal_id, topics.id AS topic_id, topics.title AS topic_title \
         FROM learner_route_progress AS progress \
         INNER JOIN application_principals AS principals ON principals.id = progress.principal_id \
         INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id \
         INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id \
         INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id \
         INNER JOIN learning_routes AS routes ON routes.id = activities.route_id \
         INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id \
         INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id \
         INNER JOIN learning_message_topics AS topics ON topics.id::text = activities.activity_config ->> 'messageTopicId' AND topics.map_asset_id = assets.id \
         WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' \
           AND activities.slug = $3 AND activities.activity_type = 'message_prompt' \
           AND activities.activity_config ->> 'messageAudience' = 'support' \
           AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL \
           AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL \
           AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))){lock_clause}"
    );
    sqlx::query_as::<_, SupportContextRow>(&statement)
        .bind(principal.subject_id)
        .bind(play_run_id)
        .bind(activity_slug)
        .bind(&principal.roles)
        .fetch_optional(executor)
        .await
}

async fn load_replay_support_context<'executor, Executor>(
    executor: Executor,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    lock: bool,
) -> Result<Option<SupportContextRow>, sqlx::Error>
where
    Executor: sqlx::Executor<'executor, Database = Postgres>,
{
    let lock_clause = if lock { " FOR UPDATE OF runs" } else { "" };
    let statement = format!(
        "SELECT runs.principal_id, topics.id AS topic_id, topics.title AS topic_title \
         FROM learner_activity_replay_runs AS runs \
         INNER JOIN application_principals AS principals ON principals.id = runs.principal_id \
         INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id \
         INNER JOIN learning_routes AS routes ON routes.id = activities.route_id \
         INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id \
         INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id \
         INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id \
         INNER JOIN learning_message_topics AS topics ON topics.id::text = activities.activity_config ->> 'messageTopicId' AND topics.map_asset_id = assets.id \
         WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' \
           AND activities.slug = $3 AND activities.activity_type = 'message_prompt' \
           AND activities.activity_config ->> 'messageAudience' = 'support' \
           AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL \
           AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL \
           AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))){lock_clause}"
    );
    sqlx::query_as::<_, SupportContextRow>(&statement)
        .bind(principal.subject_id)
        .bind(play_run_id)
        .bind(activity_slug)
        .bind(&principal.roles)
        .fetch_optional(executor)
        .await
}

async fn load_desk_responses(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Vec<LearnerDeskSupportResponse>, sqlx::Error> {
    sqlx::query_as::<_, DeskReplyRow>(
        "SELECT responses.body, to_char(responses.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, responses.id, maps.slug AS map_slug, maps.title AS map_title, nodes.slug AS node_slug, nodes.title AS node_title, topics.title AS topic_title \
         FROM learner_message_responses AS responses \
         INNER JOIN learner_messages AS messages ON messages.id = responses.message_id \
         INNER JOIN application_principals AS principals ON principals.id = messages.principal_id \
         INNER JOIN learning_message_topics AS topics ON topics.id = messages.topic_id \
         INNER JOIN learning_map_assets AS assets ON assets.id = topics.map_asset_id \
         INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id \
         INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id \
         WHERE principals.identity_subject_id = $1 AND messages.audience = 'support' \
           AND messages.hidden_at IS NULL AND responses.hidden_at IS NULL \
           AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL \
           AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) \
         ORDER BY responses.created_at DESC, responses.id DESC LIMIT 12",
    )
    .bind(principal.subject_id)
    .bind(&principal.roles)
    .fetch_all(pool)
    .await
    .map(|rows| {
        rows.into_iter()
            .map(|row| LearnerDeskSupportResponse {
                body: row.body,
                created_at: row.created_at,
                id: row.id.to_string(),
                map_slug: row.map_slug,
                map_title: row.map_title,
                node_slug: row.node_slug,
                node_title: row.node_title,
                topic_title: row.topic_title,
            })
            .collect()
    })
}
