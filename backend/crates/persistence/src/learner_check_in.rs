use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_check_in::{
    LearnerCheckInError, LearnerCheckInInput,
    LearnerCheckInRepository as LearnerCheckInRepositoryPort,
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
    activity_id: Uuid,
    principal_id: Uuid,
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
    let mut transaction = pool.begin().await?;
    let Some(activity) =
        load_completed_activity_for_update(&mut transaction, principal, play_run_id, activity_slug)
            .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };

    let check_in = sqlx::query_as::<_, CheckInRow>(
        "INSERT INTO learner_activity_check_ins (principal_id, activity_id, play_run_id, feeling, note, next_direction) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS recorded_at",
    )
    .bind(activity.principal_id)
    .bind(activity.activity_id)
    .bind(play_run_id)
    .bind(&input.feeling)
    .bind(&input.note)
    .bind(&input.next_direction)
    .fetch_one(&mut *transaction)
    .await?;

    // Laravel retains at most thirty observations for one learner/activity.
    // Keep the same bounded private history without placing it in JSON metadata.
    sqlx::query(
        "DELETE FROM learner_activity_check_ins WHERE id IN (SELECT id FROM learner_activity_check_ins WHERE principal_id = $1 AND activity_id = $2 ORDER BY recorded_at DESC, id DESC OFFSET 30)",
    )
    .bind(activity.principal_id)
    .bind(activity.activity_id)
    .execute(&mut *transaction)
    .await?;

    let schedules_revisit = input.next_direction.as_deref() == Some("revisit");
    sqlx::query(
        "UPDATE learner_activity_progress SET revisit_status = CASE WHEN $3 THEN 'pending' ELSE 'none' END, revisit_available_at = CASE WHEN $3 THEN NOW() + INTERVAL '3 days' ELSE NULL END, revisit_check_in_id = CASE WHEN $3 THEN $4 ELSE NULL END, updated_at = NOW() WHERE principal_id = $1 AND activity_id = $2",
    )
    .bind(activity.principal_id)
    .bind(activity.activity_id)
    .bind(schedules_revisit)
    .bind(check_in.id)
    .execute(&mut *transaction)
    .await?;

    transaction.commit().await?;

    Ok(Some(LearnerActivityCheckInResult {
        activity_slug: activity_slug.to_owned(),
        feeling: input.feeling.clone(),
        id: check_in.id.to_string(),
        next_direction: input.next_direction.clone(),
        note: input.note.clone(),
        recorded_at: check_in.recorded_at,
    }))
}

async fn load_completed_activity_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<CompletedActivityRow>, sqlx::Error> {
    sqlx::query_as::<_, CompletedActivityRow>(
        "SELECT activities.id AS activity_id, progress.principal_id FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.route_id = progress.route_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id INNER JOIN learner_activity_progress AS activity_progress ON activity_progress.principal_id = progress.principal_id AND activity_progress.activity_id = activities.id AND activity_progress.status = 'completed' WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND activities.slug = $3 AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF progress, activity_progress",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await
}
