use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_activity_replay_run::{
    LearnerActivityReplayRunError, LearnerActivityReplayRunRepository,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerActivityReplayRun,
};

pub struct PostgresLearnerActivityReplayRunRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerActivityReplayRunRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct ActivityRow {
    activity_id: Uuid,
    activity_slug: String,
    node_slug: String,
    principal_id: Uuid,
}

impl LearnerActivityReplayRunRepository for PostgresLearnerActivityReplayRunRepository<'_> {
    fn open_or_resume(
        &self,
        principal: &AuthorizedPrincipal,
        activity_slug: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerActivityReplayRun>, LearnerActivityReplayRunError>,
    > + Send {
        async move {
            let mut transaction = self
                .pool
                .begin()
                .await
                .map_err(|_| LearnerActivityReplayRunError)?;
            let activity = sqlx::query_as::<_, ActivityRow>(
                "SELECT activities.id AS activity_id, activities.slug AS activity_slug, nodes.slug AS node_slug, principals.id AS principal_id FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id INNER JOIN application_principals AS principals ON principals.identity_subject_id = $1 WHERE activities.slug = $2 AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice', 'question', 'reflection', 'review') AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3))) LIMIT 1 FOR UPDATE OF activities",
            )
            .bind(principal.subject_id)
            .bind(activity_slug)
            .bind(&principal.roles)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|_| LearnerActivityReplayRunError)?;
            let Some(activity) = activity else {
                transaction
                    .commit()
                    .await
                    .map_err(|_| LearnerActivityReplayRunError)?;
                return Ok(None);
            };
            let id = sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO learner_activity_replay_runs (principal_id, activity_id) VALUES ($1, $2) ON CONFLICT (principal_id, activity_id) WHERE status = 'in_progress' DO UPDATE SET last_entered_at = NOW(), updated_at = NOW() RETURNING id",
            )
            .bind(activity.principal_id)
            .bind(activity.activity_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|_| LearnerActivityReplayRunError)?;
            transaction
                .commit()
                .await
                .map_err(|_| LearnerActivityReplayRunError)?;

            Ok(Some(LearnerActivityReplayRun {
                activity_slug: activity.activity_slug,
                node_slug: activity.node_slug,
                play_run_id: id.to_string(),
                status: "in_progress".to_owned(),
            }))
        }
    }
}
