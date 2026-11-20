use serde::Deserialize;
use serde_json::Value;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_shared_task::{
    LearnerSharedTaskError, LearnerSharedTaskRepository as LearnerSharedTaskRepositoryPort,
    SharedTaskResponseType,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerPlaybackGraph, LearnerSharedTaskChecklist, LearnerSharedTaskState},
};

#[path = "learner_shared_task_state.rs"]
mod state;

pub struct PostgresLearnerSharedTaskRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerSharedTaskRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct CurrentSharedTaskRow {
    activity_config: Value,
    activity_id: Uuid,
    principal_id: Uuid,
}

#[derive(FromRow)]
struct SubmissionRow {
    id: Uuid,
    revised_body: Option<String>,
    share_with_peers: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SharedTaskConfig {
    #[serde(default)]
    instructions: String,
    #[serde(default = "default_input_label")]
    input_label: String,
    #[serde(default = "default_minimum_length")]
    minimum_length: i64,
    #[serde(default = "default_peer_review_prompt")]
    peer_review_prompt: String,
    #[serde(default)]
    peer_review_enabled: bool,
    #[serde(default)]
    project_deliverable: String,
    #[serde(default)]
    project_goal: String,
    #[serde(default)]
    project_steps: Vec<String>,
    #[serde(default = "default_prompt")]
    prompt: String,
    #[serde(default = "default_repeat_policy")]
    repeat_policy: String,
    #[serde(default)]
    show_contributions: bool,
    #[serde(default = "default_task_kind")]
    task_kind: String,
    #[serde(default = "default_threshold")]
    threshold: i64,
    #[serde(default = "default_validation_mode")]
    validation_mode: String,
}

fn default_input_label() -> String {
    "Your contribution".to_owned()
}
fn default_prompt() -> String {
    "Add a useful contribution.".to_owned()
}
fn default_minimum_length() -> i64 {
    20
}
fn default_peer_review_prompt() -> String {
    "What does this contribution help you notice, question, or extend?".to_owned()
}
fn default_repeat_policy() -> String {
    "once_per_user".to_owned()
}
fn default_task_kind() -> String {
    "text".to_owned()
}
fn default_threshold() -> i64 {
    3
}
fn default_validation_mode() -> String {
    "minimum_length".to_owned()
}

impl SharedTaskConfig {
    fn parse(value: &Value) -> Option<Self> {
        let mut config = serde_json::from_value::<Self>(value.clone()).ok()?;
        if !matches!(
            config.task_kind.as_str(),
            "text" | "question" | "reflection"
        ) || !matches!(config.repeat_policy.as_str(), "once_per_user" | "unlimited")
            || !matches!(config.validation_mode.as_str(), "minimum_length" | "none")
            || !(1..=1_000).contains(&config.threshold)
            || !(0..=10_000).contains(&config.minimum_length)
            || config.input_label.trim().is_empty()
            || config.input_label.chars().count() > 160
            || config.prompt.trim().is_empty()
            || config.prompt.chars().count() > 2_000
            || config.instructions.chars().count() > 4_000
            || config.project_goal.chars().count() > 2_000
            || config.project_deliverable.chars().count() > 2_000
            || config.peer_review_prompt.trim().is_empty()
            || config.peer_review_prompt.chars().count() > 1_000
        {
            return None;
        }
        config.project_steps = config
            .project_steps
            .into_iter()
            .map(|step| step.trim().to_owned())
            .filter(|step| !step.is_empty() && step.chars().count() <= 240)
            .take(6)
            .collect();
        Some(config)
    }

    fn peer_review_enabled(&self) -> bool {
        self.show_contributions && self.peer_review_enabled
    }

    fn project_step(&self, index: Option<i16>) -> Option<String> {
        index.and_then(|index| self.project_steps.get(index as usize).cloned())
    }

    fn supports_project_step(&self, index: Option<i16>) -> bool {
        index.is_none_or(|index| self.project_steps.get(index as usize).is_some())
    }
}

impl LearnerSharedTaskRepositoryPort for PostgresLearnerSharedTaskRepository<'_> {
    fn submit_contribution(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        body: &str,
        share_with_peers: bool,
        project_step_index: Option<i16>,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerSharedTaskState>, LearnerSharedTaskError>,
    > + Send {
        async move {
            submit_contribution(
                self.pool,
                principal,
                play_run_id,
                activity_slug,
                body,
                share_with_peers,
                project_step_index,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not submit learner shared-task contribution");
                LearnerSharedTaskError
            })
        }
    }

    fn revise_contribution(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        submission_id: Uuid,
        body: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerSharedTaskState>, LearnerSharedTaskError>,
    > + Send {
        async move {
            revise_contribution(
                self.pool,
                principal,
                play_run_id,
                activity_slug,
                submission_id,
                body,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not revise learner shared-task contribution");
                LearnerSharedTaskError
            })
        }
    }

    fn submit_review(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        submission_id: Uuid,
        body: &str,
        response_type: Option<SharedTaskResponseType>,
        project_step_index: Option<i16>,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerSharedTaskState>, LearnerSharedTaskError>,
    > + Send {
        async move {
            submit_review(
                self.pool,
                principal,
                play_run_id,
                activity_slug,
                submission_id,
                body,
                response_type,
                project_step_index,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not submit learner shared-task review");
                LearnerSharedTaskError
            })
        }
    }

    fn mark_review_helpful(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        review_id: Uuid,
        helpful: bool,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerSharedTaskState>, LearnerSharedTaskError>,
    > + Send {
        async move {
            mark_review_helpful(
                self.pool,
                principal,
                play_run_id,
                activity_slug,
                review_id,
                helpful,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not mark learner shared-task review helpful");
                LearnerSharedTaskError
            })
        }
    }

    fn save_review_follow_up(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        review_id: Uuid,
        body: Option<&str>,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerSharedTaskState>, LearnerSharedTaskError>,
    > + Send {
        async move {
            save_review_follow_up(
                self.pool,
                principal,
                play_run_id,
                activity_slug,
                review_id,
                body,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not save learner shared-task review follow-up");
                LearnerSharedTaskError
            })
        }
    }

    fn save_checklist(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        completed_step_indexes: &[i16],
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerSharedTaskChecklist>, LearnerSharedTaskError>,
    > + Send {
        async move {
            save_checklist(
                self.pool,
                principal,
                play_run_id,
                activity_slug,
                completed_step_indexes,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not save learner shared-task checklist");
                LearnerSharedTaskError
            })
        }
    }
}

async fn submit_contribution(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    body: &str,
    share_with_peers: bool,
    project_step_index: Option<i16>,
) -> Result<Option<LearnerSharedTaskState>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(current) =
        current_for_update(&mut transaction, principal, play_run_id, activity_slug).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let Some(config) = SharedTaskConfig::parse(&current.activity_config) else {
        transaction.commit().await?;
        return Ok(None);
    };
    if (config.validation_mode == "minimum_length"
        && body.chars().count() < config.minimum_length as usize)
        || !config.supports_project_step(project_step_index)
    {
        transaction.commit().await?;
        return Ok(None);
    }
    // Lock the authored activity even when the learner has no prior
    // contribution, so the source one-contribution policy cannot race.
    sqlx::query("SELECT id FROM learning_activities WHERE id = $1 FOR UPDATE")
        .bind(current.activity_id)
        .execute(&mut *transaction)
        .await?;
    if config.repeat_policy == "once_per_user" {
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (SELECT 1 FROM learner_shared_task_submissions WHERE activity_id = $1 AND principal_id = $2 AND status = 'accepted')",
        )
        .bind(current.activity_id)
        .bind(current.principal_id)
        .fetch_one(&mut *transaction)
        .await?;
        if exists {
            transaction.commit().await?;
            return Ok(None);
        }
    }
    sqlx::query("INSERT INTO learner_shared_task_submissions (activity_id, principal_id, play_run_id, body, share_with_peers, task_kind, project_step_index, validation_mode) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)")
        .bind(current.activity_id)
        .bind(current.principal_id)
        .bind(play_run_id)
        .bind(body)
        .bind(config.show_contributions && share_with_peers)
        .bind(&config.task_kind)
        .bind(project_step_index)
        .bind(&config.validation_mode)
        .execute(&mut *transaction)
        .await?;
    let state = state_for(&mut transaction, &current, play_run_id, &config).await?;
    transaction.commit().await?;
    Ok(Some(state))
}

async fn revise_contribution(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    submission_id: Uuid,
    body: &str,
) -> Result<Option<LearnerSharedTaskState>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(current) =
        current_for_update(&mut transaction, principal, play_run_id, activity_slug).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let Some(config) = SharedTaskConfig::parse(&current.activity_config) else {
        transaction.commit().await?;
        return Ok(None);
    };
    if !config.peer_review_enabled()
        || (config.validation_mode == "minimum_length"
            && body.chars().count() < config.minimum_length as usize)
    {
        transaction.commit().await?;
        return Ok(None);
    }
    let submission = sqlx::query_as::<_, SubmissionRow>(
        "SELECT to_char(accepted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS accepted_at, body, id, project_step_index, CASE WHEN revised_at IS NULL THEN NULL ELSE to_char(revised_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') END AS revised_at, revised_body, share_with_peers, task_kind FROM learner_shared_task_submissions WHERE id = $1 AND activity_id = $2 AND principal_id = $3 AND status = 'accepted' FOR UPDATE",
    )
    .bind(submission_id)
    .bind(current.activity_id)
    .bind(current.principal_id)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(submission) = submission else {
        transaction.commit().await?;
        return Ok(None);
    };
    let has_review = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_shared_task_reviews WHERE submission_id = $1)",
    )
    .bind(submission.id)
    .fetch_one(&mut *transaction)
    .await?;
    if !submission.share_with_peers || submission.revised_body.is_some() || !has_review {
        transaction.commit().await?;
        return Ok(None);
    }
    sqlx::query("UPDATE learner_shared_task_submissions SET revised_body = $1, revised_at = NOW(), updated_at = NOW() WHERE id = $2")
        .bind(body)
        .bind(submission.id)
        .execute(&mut *transaction)
        .await?;
    let state = state_for(&mut transaction, &current, play_run_id, &config).await?;
    transaction.commit().await?;
    Ok(Some(state))
}

async fn submit_review(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    submission_id: Uuid,
    body: &str,
    response_type: Option<SharedTaskResponseType>,
    project_step_index: Option<i16>,
) -> Result<Option<LearnerSharedTaskState>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(current) =
        current_for_update(&mut transaction, principal, play_run_id, activity_slug).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let Some(config) = SharedTaskConfig::parse(&current.activity_config) else {
        transaction.commit().await?;
        return Ok(None);
    };
    if !config.peer_review_enabled() || !config.supports_project_step(project_step_index) {
        transaction.commit().await?;
        return Ok(None);
    }
    sqlx::query("SELECT id FROM learning_activities WHERE id = $1 FOR UPDATE")
        .bind(current.activity_id)
        .execute(&mut *transaction)
        .await?;
    let has_contributed = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_shared_task_submissions WHERE activity_id = $1 AND principal_id = $2 AND status = 'accepted')",
    )
    .bind(current.activity_id)
    .bind(current.principal_id)
    .fetch_one(&mut *transaction)
    .await?;
    let has_reviewed = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_shared_task_reviews WHERE activity_id = $1 AND reviewer_principal_id = $2)",
    )
    .bind(current.activity_id)
    .bind(current.principal_id)
    .fetch_one(&mut *transaction)
    .await?;
    let target_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_shared_task_submissions WHERE id = $1 AND activity_id = $2 AND principal_id <> $3 AND status = 'accepted' AND share_with_peers)",
    )
    .bind(submission_id)
    .bind(current.activity_id)
    .bind(current.principal_id)
    .fetch_one(&mut *transaction)
    .await?;
    if !has_contributed || has_reviewed || !target_exists {
        transaction.commit().await?;
        return Ok(None);
    }
    sqlx::query("INSERT INTO learner_shared_task_reviews (activity_id, submission_id, reviewer_principal_id, body, response_type, project_step_index) VALUES ($1, $2, $3, $4, $5, $6)")
        .bind(current.activity_id)
        .bind(submission_id)
        .bind(current.principal_id)
        .bind(body)
        .bind(response_type.map(SharedTaskResponseType::as_str))
        .bind(project_step_index)
        .execute(&mut *transaction)
        .await?;
    let state = state_for(&mut transaction, &current, play_run_id, &config).await?;
    transaction.commit().await?;
    Ok(Some(state))
}

async fn mark_review_helpful(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    review_id: Uuid,
    helpful: bool,
) -> Result<Option<LearnerSharedTaskState>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(current) =
        current_for_update(&mut transaction, principal, play_run_id, activity_slug).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let Some(config) = SharedTaskConfig::parse(&current.activity_config) else {
        transaction.commit().await?;
        return Ok(None);
    };
    if !config.peer_review_enabled() {
        transaction.commit().await?;
        return Ok(None);
    }
    let owns_review_target = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_shared_task_reviews AS reviews INNER JOIN learner_shared_task_submissions AS submissions ON submissions.id = reviews.submission_id WHERE reviews.id = $1 AND reviews.activity_id = $2 AND submissions.principal_id = $3 AND submissions.status = 'accepted' AND submissions.share_with_peers)",
    )
    .bind(review_id)
    .bind(current.activity_id)
    .bind(current.principal_id)
    .fetch_one(&mut *transaction)
    .await?;
    if !owns_review_target {
        transaction.commit().await?;
        return Ok(None);
    }
    if helpful {
        sqlx::query("UPDATE learner_shared_task_reviews AS reviews SET helpful_at = NULL, updated_at = NOW() FROM learner_shared_task_submissions AS submissions WHERE reviews.submission_id = submissions.id AND reviews.activity_id = $1 AND submissions.principal_id = $2 AND submissions.status = 'accepted' AND submissions.share_with_peers")
            .bind(current.activity_id)
            .bind(current.principal_id)
            .execute(&mut *transaction)
            .await?;
    }
    sqlx::query("UPDATE learner_shared_task_reviews SET helpful_at = CASE WHEN $2 THEN NOW() ELSE NULL END, updated_at = NOW() WHERE id = $1")
        .bind(review_id)
        .bind(helpful)
        .execute(&mut *transaction)
        .await?;
    let state = state_for(&mut transaction, &current, play_run_id, &config).await?;
    transaction.commit().await?;
    Ok(Some(state))
}

async fn save_review_follow_up(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    review_id: Uuid,
    body: Option<&str>,
) -> Result<Option<LearnerSharedTaskState>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(current) =
        current_for_update(&mut transaction, principal, play_run_id, activity_slug).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let Some(config) = SharedTaskConfig::parse(&current.activity_config) else {
        transaction.commit().await?;
        return Ok(None);
    };
    if !config.peer_review_enabled() {
        transaction.commit().await?;
        return Ok(None);
    }
    let eligible = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_shared_task_reviews AS reviews INNER JOIN learner_shared_task_submissions AS submissions ON submissions.id = reviews.submission_id WHERE reviews.id = $1 AND reviews.activity_id = $2 AND reviews.reviewer_principal_id <> $3 AND submissions.principal_id = $3 AND submissions.status = 'accepted' AND submissions.share_with_peers)",
    )
    .bind(review_id)
    .bind(current.activity_id)
    .bind(current.principal_id)
    .fetch_one(&mut *transaction)
    .await?;
    if !eligible {
        transaction.commit().await?;
        return Ok(None);
    }
    match body {
        Some(body) => {
            sqlx::query("INSERT INTO learner_shared_task_review_follow_ups (activity_id, review_id, contributor_principal_id, body) VALUES ($1, $2, $3, $4) ON CONFLICT (review_id, contributor_principal_id) DO UPDATE SET body = EXCLUDED.body, updated_at = NOW()")
                .bind(current.activity_id)
                .bind(review_id)
                .bind(current.principal_id)
                .bind(body)
                .execute(&mut *transaction)
                .await?;
        }
        None => {
            sqlx::query("DELETE FROM learner_shared_task_review_follow_ups WHERE review_id = $1 AND contributor_principal_id = $2")
                .bind(review_id)
                .bind(current.principal_id)
                .execute(&mut *transaction)
                .await?;
        }
    }
    let state = state_for(&mut transaction, &current, play_run_id, &config).await?;
    transaction.commit().await?;
    Ok(Some(state))
}

async fn save_checklist(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    completed_step_indexes: &[i16],
) -> Result<Option<LearnerSharedTaskChecklist>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(current) =
        current_for_update(&mut transaction, principal, play_run_id, activity_slug).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let Some(config) = SharedTaskConfig::parse(&current.activity_config) else {
        transaction.commit().await?;
        return Ok(None);
    };
    if completed_step_indexes
        .iter()
        .any(|index| !config.supports_project_step(Some(*index)))
    {
        transaction.commit().await?;
        return Ok(None);
    }
    let mut completed_step_indexes = completed_step_indexes.to_vec();
    completed_step_indexes.sort_unstable();
    completed_step_indexes.dedup();
    sqlx::query("INSERT INTO learner_shared_task_checklists (principal_id, play_run_id, activity_id, completed_step_indexes) VALUES ($1, $2, $3, $4) ON CONFLICT (principal_id, play_run_id, activity_id) DO UPDATE SET completed_step_indexes = EXCLUDED.completed_step_indexes, updated_at = NOW()")
        .bind(current.principal_id)
        .bind(play_run_id)
        .bind(current.activity_id)
        .bind(&completed_step_indexes)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(Some(LearnerSharedTaskChecklist {
        completed_step_indexes,
    }))
}

async fn current_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<CurrentSharedTaskRow>, sqlx::Error> {
    sqlx::query_as::<_, CurrentSharedTaskRow>(
        "SELECT activities.activity_config, activities.id AS activity_id, progress.principal_id FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND ($3 = 'id:' || activities.id::text OR (left($3, 3) <> 'id:' AND activities.slug = $3)) AND activities.activity_type = 'shared_task' AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF progress",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await
}

async fn state_for(
    transaction: &mut Transaction<'_, Postgres>,
    current: &CurrentSharedTaskRow,
    play_run_id: Uuid,
    config: &SharedTaskConfig,
) -> Result<LearnerSharedTaskState, sqlx::Error> {
    state::load(
        transaction,
        current.principal_id,
        play_run_id,
        &std::collections::HashMap::from([(current.activity_id, config.clone())]),
    )
    .await?
    .remove(&current.activity_id)
    .ok_or_else(|| sqlx::Error::Protocol("missing shared task state".into()))
}

/// The playback reader has already authorized this run and bounded published
/// graph. This projection grants no command authority to inactive activities.
pub(crate) async fn enrich_graph(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    play_run_id: Uuid,
    graph: &mut LearnerPlaybackGraph,
) -> Result<(), sqlx::Error> {
    let configs = graph
        .activities
        .iter()
        .filter(|activity| activity.activity_type == "shared_task")
        .map(|activity| {
            SharedTaskConfig::parse(&activity.config)
                .map(|config| (activity.id, config))
                .ok_or_else(|| sqlx::Error::Protocol("invalid shared task configuration".into()))
        })
        .collect::<Result<std::collections::HashMap<_, _>, _>>()?;
    let mut states = state::load(transaction, principal_id, play_run_id, &configs).await?;
    for activity in &mut graph.activities {
        activity.shared_task_state = states.remove(&activity.id);
    }
    Ok(())
}

/// Completion is a shared threshold, not a client-side affordance. The caller
/// has already locked the active normal route run; this function only admits a
/// shared-task completion when the authored configuration remains valid and
/// the activity has enough accepted contributions.
pub(crate) async fn shared_task_complete_for_run(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
    activity_config: &Value,
) -> Result<bool, sqlx::Error> {
    let Some(config) = SharedTaskConfig::parse(activity_config) else {
        return Ok(false);
    };
    let accepted_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*)::BIGINT FROM learner_shared_task_submissions WHERE activity_id = $1 AND status = 'accepted'",
    )
    .bind(activity_id)
    .fetch_one(&mut **transaction)
    .await?;
    Ok(accepted_count >= config.threshold)
}

pub(crate) fn safe_playback_config(value: Value) -> Option<Value> {
    let config = SharedTaskConfig::parse(&value)?;
    Some(serde_json::json!({
        "instructions": config.instructions,
        "inputLabel": config.input_label,
        "minimumLength": config.minimum_length,
        "peerReviewEnabled": config.peer_review_enabled(),
        "peerReviewPrompt": config.peer_review_prompt,
        "projectDeliverable": config.project_deliverable,
        "projectGoal": config.project_goal,
        "projectSteps": config.project_steps,
        "prompt": config.prompt,
        "repeatPolicy": config.repeat_policy,
        "showContributions": config.show_contributions,
        "taskKind": config.task_kind,
        "threshold": config.threshold,
        "validationMode": config.validation_mode,
    }))
}
