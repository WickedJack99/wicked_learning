use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_activity_replay_run::{LearnerActivityReplayRunError, LearnerActivityReplayRunRepository};
use wicked_learning_domain::{identity_access::AuthorizedPrincipal, learner_state::LearnerActivityReplayRun};

pub struct PostgresLearnerActivityReplayRunRepository<'pool> { pool: &'pool PgPool }
impl<'pool> PostgresLearnerActivityReplayRunRepository<'pool> { pub fn new(pool: &'pool PgPool) -> Self { Self { pool } } }
#[derive(FromRow)] struct Row { activity_id: Uuid, activity_slug: String, node_slug: String, principal_id: Uuid }

impl LearnerActivityReplayRunRepository for PostgresLearnerActivityReplayRunRepository<'_> {
    fn open_or_resume(&self, principal: &AuthorizedPrincipal, activity_slug: &str) -> impl std::future::Future<Output = Result<Option<LearnerActivityReplayRun>, LearnerActivityReplayRunError>> + Send {
        async move {
            let row = sqlx::query_as::<_, Row>("SELECT activities.id AS activity_id, activities.slug AS activity_slug, nodes.slug AS node_slug, principals.id AS principal_id FROM application_principals principals JOIN learning_maps maps ON maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) role WHERE role.value = ANY($2)) JOIN learning_nodes nodes ON nodes.map_id = maps.id JOIN learning_map_assets assets ON assets.id = nodes.map_asset_id JOIN learning_routes routes ON routes.map_asset_id = assets.id JOIN learning_activities activities ON activities.route_id = routes.id WHERE principals.identity_subject_id = $1 AND activities.slug = $3 AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice','question','reflection','review') LIMIT 1")
                .bind(principal.subject_id).bind(&principal.roles).bind(activity_slug).fetch_optional(self.pool).await.map_err(|_| LearnerActivityReplayRunError)?;
            let Some(row) = row else { return Ok(None) };
            let id = sqlx::query_scalar::<_, Uuid>("INSERT INTO learner_activity_replay_runs (principal_id, activity_id) VALUES ($1,$2) ON CONFLICT (principal_id, activity_id) WHERE status = 'in_progress' DO UPDATE SET last_entered_at = NOW(), updated_at = NOW() RETURNING id").bind(row.principal_id).bind(row.activity_id).fetch_one(self.pool).await.map_err(|_| LearnerActivityReplayRunError)?;
            Ok(Some(LearnerActivityReplayRun { activity_slug: row.activity_slug, node_slug: row.node_slug, play_run_id: id.to_string(), status: "in_progress".into() }))
        }
    }
}
