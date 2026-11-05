use serde::Deserialize;
use serde_json::json;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_playback::{
    LearnerPlaybackCompletionError,
    LearnerPlaybackCompletionRepository as LearnerPlaybackCompletionRepositoryPort,
    LearnerPlaybackReadError, LearnerPlaybackRepository as LearnerPlaybackRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerPlaybackActivity, LearnerPlaybackCompletion, LearnerPlaybackCompletionResult,
        LearnerPlaybackContext, LearnerPlaybackDocument,
    },
};

pub struct PostgresLearnerPlaybackRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerPlaybackRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct PlaybackRow {
    activity_config: serde_json::Value,
    activity_slug: String,
    activity_type: String,
    description: String,
    map_slug: String,
    map_title: String,
    next_activity_slug: Option<String>,
    node_slug: String,
    node_title: String,
    route_label: String,
    start_id: Uuid,
    title: String,
    transition_label: Option<String>,
}

#[derive(FromRow)]
struct CurrentActivityRow {
    activity_id: Uuid,
    principal_id: Uuid,
    route_id: Uuid,
}

#[derive(FromRow)]
struct CompletionTransitionRow {
    to_activity_id: Option<Uuid>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuestionPlaybackConfig {
    allow_multiple: bool,
    options: Vec<QuestionPlaybackOption>,
    prompt: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct QuestionPlaybackOption {
    body: String,
    key: String,
    label: String,
}

fn learner_safe_config(
    activity_type: &str,
    config: serde_json::Value,
) -> Option<serde_json::Value> {
    match activity_type {
        "open_practice" => Some(config),
        "question" => {
            let config = serde_json::from_value::<QuestionPlaybackConfig>(config).ok()?;
            if config.prompt.trim().is_empty()
                || config.options.is_empty()
                || config.options.iter().any(|option| {
                    option.key.trim().is_empty()
                        || option.label.trim().is_empty()
                        || option.body.trim().is_empty()
                })
            {
                return None;
            }
            Some(json!({
                "allowMultiple": config.allow_multiple,
                "prompt": config.prompt,
                "options": config.options.into_iter().map(|option| json!({
                    "key": option.key,
                    "label": option.label,
                    "body": option.body,
                })).collect::<Vec<_>>(),
            }))
        }
        _ => None,
    }
}

impl LearnerPlaybackRepositoryPort for PostgresLearnerPlaybackRepository<'_> {
    fn load_active_run(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerPlaybackDocument>, LearnerPlaybackReadError>,
    > + Send {
        async move {
            let row = sqlx::query_as::<_, PlaybackRow>(
                "SELECT progress.activity_start_id AS start_id, activities.slug AS activity_slug, activities.title, activities.description, activities.activity_type, activities.activity_config, maps.slug AS map_slug, maps.title AS map_title, nodes.slug AS node_slug, nodes.title AS node_title, COALESCE(starts.label, routes.title) AS route_label, transition.label AS transition_label, next_activity.slug AS next_activity_slug FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id LEFT JOIN LATERAL (SELECT transitions.label, transitions.to_activity_id FROM learning_activity_transitions AS transitions WHERE transitions.from_activity_id = activities.id AND transitions.from_connector = 'completed' AND transitions.trigger = 'completed' ORDER BY transitions.created_at ASC, transitions.id ASC LIMIT 1) AS transition ON TRUE LEFT JOIN learning_activities AS next_activity ON next_activity.id = transition.to_activity_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice', 'question') AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3)))",
            )
            .bind(principal.subject_id)
            .bind(play_run_id)
            .bind(&principal.roles)
            .fetch_optional(self.pool)
            .await
            .map_err(|_| LearnerPlaybackReadError)?;

            Ok(row.and_then(|row| {
                learner_safe_config(&row.activity_type, row.activity_config).map(|config| {
                    LearnerPlaybackDocument {
                        start_id: row.start_id.to_string(),
                        play_run_id: play_run_id.to_string(),
                        context: LearnerPlaybackContext {
                            node_slug: row.node_slug,
                            node_title: row.node_title,
                            map_slug: row.map_slug,
                            map_title: row.map_title,
                            route_label: row.route_label,
                        },
                        activity: LearnerPlaybackActivity {
                            slug: row.activity_slug,
                            title: row.title,
                            description: row.description,
                            activity_type: row.activity_type,
                            config,
                            completion: LearnerPlaybackCompletion {
                                label: row.transition_label,
                                next_activity_slug: row.next_activity_slug,
                            },
                        },
                    }
                })
            }))
        }
    }
}

impl LearnerPlaybackCompletionRepositoryPort for PostgresLearnerPlaybackRepository<'_> {
    fn complete_current_open_practice(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerPlaybackCompletionResult>, LearnerPlaybackCompletionError>,
    > + Send {
        async move {
            complete_current_open_practice(self.pool, principal, play_run_id, activity_slug)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not complete learner playback activity");
                    LearnerPlaybackCompletionError
                })
        }
    }
}

async fn complete_current_open_practice(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<LearnerPlaybackCompletionResult>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(current) =
        load_current_activity_for_update(&mut transaction, principal, play_run_id, activity_slug)
            .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };

    let transition = sqlx::query_as::<_, CompletionTransitionRow>(
        "SELECT to_activity_id FROM learning_activity_transitions WHERE from_activity_id = $1 AND from_connector = 'completed' AND trigger = 'completed' ORDER BY created_at ASC, id ASC LIMIT 1",
    )
    .bind(current.activity_id)
    .fetch_optional(&mut *transaction)
    .await?;

    let next_activity_id = match transition.and_then(|transition| transition.to_activity_id) {
        Some(next_activity_id) => {
            let next_activity_id = sqlx::query_scalar::<_, Uuid>(
                "SELECT activities.id FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id WHERE activities.id = $1 AND routes.id = $2 AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice', 'question')",
            )
            .bind(next_activity_id)
            .bind(current.route_id)
            .fetch_optional(&mut *transaction)
            .await?;

            let Some(next_activity_id) = next_activity_id else {
                transaction.commit().await?;
                return Ok(None);
            };

            Some(next_activity_id)
        }
        None => None,
    };

    mark_activity_completed(&mut transaction, current.principal_id, current.activity_id).await?;

    let status = if let Some(next_activity_id) = next_activity_id {
        mark_activity_reached(&mut transaction, current.principal_id, next_activity_id).await?;
        sqlx::query(
            "UPDATE learner_route_progress SET current_activity_id = $3, status = 'in_progress', last_entered_at = NOW(), last_exited_at = NOW(), updated_at = NOW() WHERE principal_id = $1 AND current_play_run_id = $2",
        )
        .bind(current.principal_id)
        .bind(play_run_id)
        .bind(next_activity_id)
        .execute(&mut *transaction)
        .await?;

        "in_progress"
    } else {
        sqlx::query(
            "UPDATE learner_route_progress SET status = 'completed', completion_count = completion_count + 1, last_completed_at = NOW(), last_exited_at = NOW(), updated_at = NOW() WHERE principal_id = $1 AND current_play_run_id = $2",
        )
        .bind(current.principal_id)
        .bind(play_run_id)
        .execute(&mut *transaction)
        .await?;

        "completed"
    };

    transaction.commit().await?;

    Ok(Some(LearnerPlaybackCompletionResult {
        play_run_id: play_run_id.to_string(),
        status: status.to_owned(),
    }))
}

async fn load_current_activity_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<CurrentActivityRow>, sqlx::Error> {
    sqlx::query_as::<_, CurrentActivityRow>(
        "SELECT progress.current_activity_id AS activity_id, progress.principal_id, routes.id AS route_id FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type = 'open_practice' AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF progress",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await
}

async fn mark_activity_completed(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO learner_activity_progress (principal_id, activity_id, status, completed_at) VALUES ($1, $2, 'completed', NOW()) ON CONFLICT (principal_id, activity_id) DO UPDATE SET status = 'completed', completed_at = COALESCE(learner_activity_progress.completed_at, EXCLUDED.completed_at), updated_at = NOW()",
    )
    .bind(principal_id)
    .bind(activity_id)
    .execute(&mut **transaction)
    .await?;

    Ok(())
}

async fn mark_activity_reached(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO learner_activity_progress (principal_id, activity_id, status) VALUES ($1, $2, 'reached') ON CONFLICT (principal_id, activity_id) DO UPDATE SET updated_at = NOW()",
    )
    .bind(principal_id)
    .bind(activity_id)
    .execute(&mut **transaction)
    .await?;

    Ok(())
}
