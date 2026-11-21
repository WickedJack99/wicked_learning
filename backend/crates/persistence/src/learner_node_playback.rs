use sqlx::PgPool;
use uuid::Uuid;
use wicked_learning_application::{
    learner_node_playback::LearnerNodePlaybackRepository,
    learner_playback::LearnerPlaybackReadError,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerNodePlaybackDocument,
};

use crate::learner_node_availability::PostgresLearnerNodeAvailability;

pub struct PostgresLearnerNodePlaybackRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerNodePlaybackRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl LearnerNodePlaybackRepository for PostgresLearnerNodePlaybackRepository<'_> {
    async fn load_node(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        requested_activity_id: Option<Uuid>,
    ) -> Result<Option<LearnerNodePlaybackDocument>, LearnerPlaybackReadError> {
        load(self.pool, principal, node_id, requested_activity_id)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not read the learner's playable node");
                LearnerPlaybackReadError
            })
    }
}

async fn load(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    requested_activity_id: Option<Uuid>,
) -> Result<Option<LearnerNodePlaybackDocument>, sqlx::Error> {
    let Some(availability) = PostgresLearnerNodeAvailability::load(pool, principal).await? else {
        return Ok(None);
    };
    let mut transaction = pool.begin().await?;
    let map_id = sqlx::query_scalar::<_, Uuid>("SELECT map_id FROM learning_nodes WHERE id=$1")
        .bind(node_id)
        .fetch_optional(&mut *transaction)
        .await?;
    let Some(map_id) = map_id else {
        return Ok(None);
    };
    let Some((mut graph, node)) = crate::learner_playback_graph::load(
        &mut transaction,
        principal,
        &availability,
        node_id,
        map_id,
        None,
    )
    .await?
    else {
        return Ok(None);
    };
    crate::learner_shared_task::enrich_graph(
        &mut transaction,
        availability.principal_id(),
        None,
        &mut graph,
    )
    .await?;
    let private_state = crate::learner_playback_private_state::load(
        &mut transaction,
        availability.principal_id(),
        None,
        &graph,
    )
    .await?;
    let selected_activity_id = requested_activity_id
        .filter(|id| graph.activities.iter().any(|activity| activity.id == *id));
    transaction.commit().await?;
    Ok(Some(LearnerNodePlaybackDocument {
        selected_activity_id,
        graph,
        node,
        private_state,
    }))
}
