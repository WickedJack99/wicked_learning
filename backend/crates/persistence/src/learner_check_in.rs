use crate::learner_node_availability::PostgresLearnerNodeAvailability;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_check_in::{
    LearnerCheckInError, LearnerCheckInInput,
    LearnerCheckInRepository as LearnerCheckInRepositoryPort, LearnerNodeCheckInRepository,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerActivityCheckInResult,
};

pub struct PostgresLearnerCheckInRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerCheckInRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl LearnerCheckInRepositoryPort for PostgresLearnerCheckInRepository<'_> {
    fn record_completed_activity_check_in(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        input: &LearnerCheckInInput,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerActivityCheckInResult>, LearnerCheckInError>,
    > + Send {
        async move {
            record_completed_activity_check_in(
                self.pool,
                principal,
                play_run_id,
                activity_slug,
                input,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not record learner activity check-in");
                LearnerCheckInError
            })
        }
    }
}

#[derive(FromRow)]
struct CompletedActivityRow {
    activity_slug: String,
    activity_id: Uuid,
    principal_id: Uuid,
    node_id: Uuid,
    node_state: String,
    node_visual_config: serde_json::Value,
}

#[derive(FromRow)]
struct CheckInRow {
    id: Uuid,
    recorded_at: String,
}

async fn record_completed_activity_check_in(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    input: &LearnerCheckInInput,
) -> Result<Option<LearnerActivityCheckInResult>, sqlx::Error> {
    let Some(availability) = PostgresLearnerNodeAvailability::load(pool, principal).await? else {
        return Ok(None);
    };
    let mut transaction = pool.begin().await?;
    let Some(activity) =
        load_completed_activity_for_update(&mut transaction, principal, play_run_id, activity_slug)
            .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    if !availability
        .state_for_node(
            activity.node_id,
            &activity.node_state,
            &activity.node_visual_config,
        )
        .can_play()
    {
        transaction.rollback().await?;
        return Ok(None);
    }

    let result = save_check_in(
        &mut transaction,
        activity.principal_id,
        activity.activity_id,
        activity.activity_slug,
        Some(play_run_id),
        input,
    )
    .await?;
    transaction.commit().await?;
    Ok(Some(result))
}

async fn save_check_in(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
    activity_slug: String,
    play_run_id: Option<Uuid>,
    input: &LearnerCheckInInput,
) -> Result<LearnerActivityCheckInResult, sqlx::Error> {
    let check_in = sqlx::query_as::<_, CheckInRow>(
        "INSERT INTO learner_activity_check_ins (principal_id, activity_id, play_run_id, feeling, note, next_direction) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS recorded_at",
    )
    .bind(principal_id)
    .bind(activity_id)
    .bind(play_run_id)
    .bind(&input.feeling)
    .bind(&input.note)
    .bind(&input.next_direction)
    .fetch_one(&mut **transaction)
    .await?;

    // Laravel retains at most thirty observations for one learner/activity.
    // Keep the same bounded private history without placing it in JSON metadata.
    sqlx::query(
        "DELETE FROM learner_activity_check_ins WHERE id IN (SELECT id FROM learner_activity_check_ins WHERE principal_id = $1 AND activity_id = $2 ORDER BY recorded_at DESC, id DESC OFFSET 30)",
    )
    .bind(principal_id)
    .bind(activity_id)
    .execute(&mut **transaction)
    .await?;

    let schedules_revisit = input.next_direction.as_deref() == Some("revisit");
    sqlx::query(
        "UPDATE learner_activity_progress SET revisit_status = CASE WHEN $3 THEN 'pending' ELSE 'none' END, revisit_available_at = CASE WHEN $3 THEN NOW() + INTERVAL '3 days' ELSE NULL END, revisit_check_in_id = CASE WHEN $3 THEN $4 ELSE NULL END, updated_at = NOW() WHERE principal_id = $1 AND activity_id = $2",
    )
    .bind(principal_id)
    .bind(activity_id)
    .bind(schedules_revisit)
    .bind(check_in.id)
    .execute(&mut **transaction)
    .await?;

    let activity_state =
        crate::learner_playback_activity_state::load(transaction, principal_id, activity_id)
            .await?;

    Ok(LearnerActivityCheckInResult {
        activity_slug,
        feeling: input.feeling.clone(),
        id: check_in.id.to_string(),
        next_direction: input.next_direction.clone(),
        note: input.note.clone(),
        recorded_at: check_in.recorded_at,
        activity_state,
    })
}

async fn load_completed_activity_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<CompletedActivityRow>, sqlx::Error> {
    // Authored connections can cross route groups within a MapAsset. Explicit
    // identities follow that boundary; legacy slugs retain the original group
    // because two groups can contain activities with the same slug.
    let ordinary = sqlx::query_as::<_, CompletedActivityRow>(
        "SELECT nodes.id AS node_id, nodes.state AS node_state, nodes.visual_config AS node_visual_config, activities.id AS activity_id, activities.slug AS activity_slug, progress.principal_id FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_routes AS routes ON routes.map_asset_id = nodes.map_asset_id INNER JOIN learning_activities AS activities ON activities.route_id = routes.id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id INNER JOIN learner_activity_progress AS activity_progress ON activity_progress.principal_id = progress.principal_id AND activity_progress.activity_id = activities.id AND activity_progress.status = 'completed' WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND ($3 = 'id:' || activities.id::text OR (left($3, 3) <> 'id:' AND activities.slug = $3 AND activities.route_id = progress.route_id)) AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF progress, activity_progress",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await?;
    if ordinary.is_some() {
        return Ok(ordinary);
    }

    // Completed one-activity runs remain valid for the source's optional
    // check-in after their active playback document has closed. These are fixed
    // storage identifiers, never request input. Lock both the owned run and
    // progress so history/scheduling writes keep the same transaction boundary.
    // Recall is intentionally absent (ADR-037).
    for (table, activity_column) in [
        ("learner_activity_replay_runs", "activity_id"),
        ("learner_revisit_runs", "activity_id"),
        ("learner_portal_arrival_runs", "target_activity_id"),
    ] {
        let query = format!(
            r#"
            SELECT activities.id AS activity_id, activities.slug AS activity_slug,
                   runs.principal_id, nodes.id AS node_id, nodes.state AS node_state,
                   nodes.visual_config AS node_visual_config
            FROM {table} AS runs
            INNER JOIN application_principals AS principals ON principals.id = runs.principal_id
            INNER JOIN learning_activities AS activities ON activities.id = runs.{activity_column}
            INNER JOIN learning_routes AS routes ON routes.id = activities.route_id
            INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id
            INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id
            INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id
            INNER JOIN learner_activity_progress AS activity_progress
                ON activity_progress.principal_id = runs.principal_id
                AND activity_progress.activity_id = activities.id
                AND activity_progress.status = 'completed'
            WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'completed'
                AND ($3 = 'id:' || activities.id::text OR (left($3, 3) <> 'id:' AND activities.slug = $3))
                AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL
                AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL
                AND activities.published_at IS NOT NULL
                AND (maps.access_roles @> '["public"]'::jsonb OR EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role)
                    WHERE access_role.role = ANY($4)))
            FOR UPDATE OF runs, activity_progress
        "#
        );
        let completed = sqlx::query_as::<_, CompletedActivityRow>(&query)
            .bind(principal.subject_id)
            .bind(play_run_id)
            .bind(activity_slug)
            .bind(&principal.roles)
            .fetch_optional(&mut **transaction)
            .await?;
        if completed.is_some() {
            return Ok(completed);
        }
    }
    Ok(None)
}

impl LearnerNodeCheckInRepository for PostgresLearnerCheckInRepository<'_> {
    async fn record_node_check_in(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Uuid,
        input: &LearnerCheckInInput,
    ) -> Result<Option<LearnerActivityCheckInResult>, LearnerCheckInError> {
        record_node_check_in(self.pool, principal, node_id, activity_id, input)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not record a runless learner check-in");
                LearnerCheckInError
            })
    }
}

async fn record_node_check_in(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    activity_id: Uuid,
    input: &LearnerCheckInInput,
) -> Result<Option<LearnerActivityCheckInResult>, sqlx::Error> {
    let Some(availability) = PostgresLearnerNodeAvailability::load(pool, principal).await? else {
        return Ok(None);
    };
    let mut transaction = pool.begin().await?;
    let Some(activity_slug) = crate::learner_node_playback::playable_activity_slug(
        &mut transaction,
        principal,
        &availability,
        node_id,
        activity_id,
    )
    .await?
    else {
        return Ok(None);
    };
    let completed = sqlx::query_scalar::<_, Uuid>("SELECT activity_id FROM learner_activity_progress WHERE principal_id=$1 AND activity_id=$2 AND status='completed' FOR UPDATE")
        .bind(availability.principal_id()).bind(activity_id).fetch_optional(&mut *transaction).await?;
    if completed.is_none() {
        return Ok(None);
    }
    let result = save_check_in(
        &mut transaction,
        availability.principal_id(),
        activity_id,
        activity_slug,
        None,
        input,
    )
    .await?;
    transaction.commit().await?;
    Ok(Some(result))
}
