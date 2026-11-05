use serde_json::Value;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_route_run::{
    LearnerRouteRunCommandError, LearnerRouteRunRepository as LearnerRouteRunRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerRouteRun,
};

use crate::learner_node_availability::PostgresLearnerNodeAvailability;

pub struct PostgresLearnerRouteRunRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerRouteRunRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl LearnerRouteRunRepositoryPort for PostgresLearnerRouteRunRepository<'_> {
    fn start_or_resume(
        &self,
        principal: &AuthorizedPrincipal,
        start_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerRouteRun>, LearnerRouteRunCommandError>,
    > + Send {
        async move {
            start_or_resume(self.pool, principal, start_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not start or resume learner route run");
                    LearnerRouteRunCommandError
                })
        }
    }

    fn reset(
        &self,
        principal: &AuthorizedPrincipal,
        start_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerRouteRun>, LearnerRouteRunCommandError>,
    > + Send {
        async move {
            reset(self.pool, principal, start_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not reset learner route run");
                    LearnerRouteRunCommandError
                })
        }
    }
}

#[derive(FromRow)]
struct StartRow {
    activity_id: Uuid,
    activity_slug: String,
    node_id: Uuid,
    node_slug: String,
    node_state: String,
    node_visual_config: Value,
    route_id: Uuid,
    route_slug: String,
    start_id: Uuid,
}

#[derive(FromRow)]
struct ProgressRow {
    completion_count: i32,
    current_play_run_id: Option<Uuid>,
    reset_count: i32,
    status: String,
}

async fn start_or_resume(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    start_id: Uuid,
) -> Result<Option<LearnerRouteRun>, sqlx::Error> {
    let Some(availability) = PostgresLearnerNodeAvailability::load(pool, principal).await? else {
        return Ok(None);
    };
    let mut transaction = pool.begin().await?;
    let Some((principal_id, start)) =
        resolve_visible_start(&mut transaction, principal, &availability, start_id).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let existing = load_progress_for_update(&mut transaction, principal_id, start.start_id).await?;
    let run_id = match existing
        .as_ref()
        .and_then(|progress| progress.current_play_run_id)
    {
        Some(run_id)
            if existing
                .as_ref()
                .is_some_and(|progress| progress.status != "completed") =>
        {
            run_id
        }
        _ => Uuid::new_v4(),
    };
    let starts_new_run = existing
        .as_ref()
        .is_none_or(|progress| progress.current_play_run_id != Some(run_id));

    let (completion_count, reset_count) = if let Some(progress) = existing {
        if starts_new_run {
            sqlx::query(
                "UPDATE learner_route_progress SET current_activity_id = $3, current_play_run_id = $4, status = 'in_progress', started_at = NOW(), last_entered_at = NOW(), last_exited_at = NULL, last_completed_at = NULL, metadata = '{}'::jsonb, updated_at = NOW() WHERE principal_id = $1 AND activity_start_id = $2",
            )
            .bind(principal_id)
            .bind(start.start_id)
            .bind(start.activity_id)
            .bind(run_id)
            .execute(&mut *transaction)
            .await?;
        } else {
            sqlx::query(
                "UPDATE learner_route_progress SET status = 'in_progress', last_entered_at = NOW(), last_exited_at = NULL, updated_at = NOW() WHERE principal_id = $1 AND activity_start_id = $2",
            )
            .bind(principal_id)
            .bind(start.start_id)
            .execute(&mut *transaction)
            .await?;
        }

        (progress.completion_count, progress.reset_count)
    } else {
        sqlx::query(
            "INSERT INTO learner_route_progress (principal_id, node_id, route_id, activity_start_id, current_activity_id, current_play_run_id, status, started_at, last_entered_at) VALUES ($1, $2, $3, $4, $5, $6, 'in_progress', NOW(), NOW())",
        )
        .bind(principal_id)
        .bind(start.node_id)
        .bind(start.route_id)
        .bind(start.start_id)
        .bind(start.activity_id)
        .bind(run_id)
        .execute(&mut *transaction)
        .await?;

        (0, 0)
    };
    transaction.commit().await?;

    Ok(Some(LearnerRouteRun {
        start_id: start.start_id.to_string(),
        node_slug: start.node_slug,
        route_slug: start.route_slug,
        activity_slug: start.activity_slug,
        play_run_id: run_id.to_string(),
        status: "in_progress".to_owned(),
        completion_count,
        reset_count,
    }))
}

async fn reset(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    start_id: Uuid,
) -> Result<Option<LearnerRouteRun>, sqlx::Error> {
    let Some(availability) = PostgresLearnerNodeAvailability::load(pool, principal).await? else {
        return Ok(None);
    };
    let mut transaction = pool.begin().await?;
    let Some((principal_id, start)) =
        resolve_visible_start(&mut transaction, principal, &availability, start_id).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let existing = load_progress_for_update(&mut transaction, principal_id, start.start_id).await?;
    let run_id = Uuid::new_v4();
    let (completion_count, reset_count) = if let Some(progress) = existing {
        let reset_count = progress.reset_count + 1;
        sqlx::query(
            "UPDATE learner_route_progress SET current_activity_id = $3, current_play_run_id = $4, status = 'in_progress', started_at = NOW(), last_entered_at = NOW(), last_exited_at = NULL, last_completed_at = NULL, reset_count = $5, metadata = '{}'::jsonb, updated_at = NOW() WHERE principal_id = $1 AND activity_start_id = $2",
        )
        .bind(principal_id)
        .bind(start.start_id)
        .bind(start.activity_id)
        .bind(run_id)
        .bind(reset_count)
        .execute(&mut *transaction)
        .await?;

        (progress.completion_count, reset_count)
    } else {
        sqlx::query(
            "INSERT INTO learner_route_progress (principal_id, node_id, route_id, activity_start_id, current_activity_id, current_play_run_id, status, started_at, last_entered_at, reset_count) VALUES ($1, $2, $3, $4, $5, $6, 'in_progress', NOW(), NOW(), 1)",
        )
        .bind(principal_id)
        .bind(start.node_id)
        .bind(start.route_id)
        .bind(start.start_id)
        .bind(start.activity_id)
        .bind(run_id)
        .execute(&mut *transaction)
        .await?;

        (0, 1)
    };
    transaction.commit().await?;

    Ok(Some(LearnerRouteRun {
        start_id: start.start_id.to_string(),
        node_slug: start.node_slug,
        route_slug: start.route_slug,
        activity_slug: start.activity_slug,
        play_run_id: run_id.to_string(),
        status: "in_progress".to_owned(),
        completion_count,
        reset_count,
    }))
}

async fn resolve_visible_start(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    availability: &PostgresLearnerNodeAvailability,
    start_id: Uuid,
) -> Result<Option<(Uuid, StartRow)>, sqlx::Error> {
    let principal_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut **transaction)
    .await?;
    let Some(principal_id) = principal_id else {
        return Ok(None);
    };
    let start = sqlx::query_as::<_, StartRow>(
        "SELECT activities.id AS activity_id, activities.slug AS activity_slug, nodes.id AS node_id, nodes.slug AS node_slug, nodes.state AS node_state, nodes.visual_config AS node_visual_config, routes.id AS route_id, routes.slug AS route_slug, starts.id AS start_id FROM learning_activity_starts AS starts INNER JOIN learning_activities AS activities ON activities.id = starts.activity_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE starts.id = $1 AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice', 'question', 'reflection') AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2)))",
    )
    .bind(start_id)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await?;

    Ok(start
        .filter(|start| {
            availability
                .state_for_node(start.node_id, &start.node_state, &start.node_visual_config)
                .can_play()
        })
        .map(|start| (principal_id, start)))
}

async fn load_progress_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    start_id: Uuid,
) -> Result<Option<ProgressRow>, sqlx::Error> {
    sqlx::query_as::<_, ProgressRow>(
        "SELECT completion_count, current_play_run_id, reset_count, status FROM learner_route_progress WHERE principal_id = $1 AND activity_start_id = $2 FOR UPDATE",
    )
    .bind(principal_id)
    .bind(start_id)
    .fetch_optional(&mut **transaction)
    .await
}
