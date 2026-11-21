use sqlx::PgPool;
use uuid::Uuid;
use wicked_learning_application::learner_playback::{
    LearnerNodeResumeRepository, LearnerPlaybackReadError, LearnerPlaybackRepository,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerPlaybackDocument,
};

use crate::learner_playback::PostgresLearnerPlaybackRepository;

pub struct PostgresLearnerNodeResumeRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerNodeResumeRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl LearnerNodeResumeRepository for PostgresLearnerNodeResumeRepository<'_> {
    async fn load_node_resume(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
    ) -> Result<Option<LearnerPlaybackDocument>, LearnerPlaybackReadError> {
        // Match source progressForNode: unfinished by entry/creation first,
        // otherwise the latest updated current route. Never fall back from an
        // inaccessible selected run to a different, older route.
        let run = sqlx::query_scalar::<_, Uuid>(
            "SELECT progress.current_play_run_id FROM learner_route_progress AS progress \
             JOIN application_principals AS principals ON principals.id = progress.principal_id \
             WHERE principals.identity_subject_id = $1 AND progress.node_id = $2 AND progress.current_play_run_id IS NOT NULL \
             ORDER BY (progress.status = 'in_progress') DESC, \
               CASE WHEN progress.status = 'in_progress' THEN progress.last_entered_at ELSE progress.updated_at END DESC NULLS LAST, \
               CASE WHEN progress.status = 'in_progress' THEN progress.created_at ELSE progress.updated_at END DESC, \
               progress.activity_start_id ASC LIMIT 1",
        )
        .bind(principal.subject_id)
        .bind(node_id)
        .fetch_optional(self.pool)
        .await
        .map_err(|error| {
            tracing::error!(%error, "could not resolve the learner's current node run");
            LearnerPlaybackReadError
        })?;
        let Some(run) = run else { return Ok(None) };
        let document = PostgresLearnerPlaybackRepository::new(self.pool)
            .load_active_run(principal, run)
            .await?;
        Ok(document.filter(|document| document.node.id == node_id))
    }
}
