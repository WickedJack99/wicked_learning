use sqlx::PgPool;
use uuid::Uuid;
use wicked_learning_application::{
    learner_node_playback::{LearnerNodePlaybackRepository, LearnerNodeReachRepository},
    learner_playback::{LearnerPlaybackReachError, LearnerPlaybackReadError},
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerNodePlaybackDocument, LearnerPlaybackActivityState},
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

impl LearnerNodeReachRepository for PostgresLearnerNodePlaybackRepository<'_> {
    async fn reach_activity(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Uuid,
    ) -> Result<Option<LearnerPlaybackActivityState>, LearnerPlaybackReachError> {
        reach(self.pool, principal, node_id, activity_id)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not mark a runless learner activity reached");
                LearnerPlaybackReachError
            })
    }
}

#[derive(sqlx::FromRow)]
struct PlayableActivity {
    node_state: String,
    node_visual_config: serde_json::Value,
    activity_type: String,
    activity_config: serde_json::Value,
}

async fn reach(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    activity_id: Uuid,
) -> Result<Option<LearnerPlaybackActivityState>, sqlx::Error> {
    let Some(availability) = PostgresLearnerNodeAvailability::load(pool, principal).await? else {
        return Ok(None);
    };
    let mut transaction = pool.begin().await?;
    let activity = sqlx::query_as::<_, PlayableActivity>(
        "SELECT nodes.state AS node_state,nodes.visual_config AS node_visual_config,activities.activity_type,activities.activity_config \
         FROM learning_nodes nodes JOIN learning_maps maps ON maps.id=nodes.map_id \
         JOIN learning_map_assets assets ON assets.id=nodes.map_asset_id AND assets.map_id=maps.id \
         JOIN learning_routes routes ON routes.map_asset_id=assets.id \
         JOIN learning_activities activities ON activities.route_id=routes.id \
         WHERE nodes.id=$1 AND activities.id=$2 AND nodes.published_at IS NOT NULL \
         AND maps.published_at IS NOT NULL AND assets.published_at IS NOT NULL \
         AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL \
         AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS \
           (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) role(value) WHERE role.value=ANY($3))) \
         FOR SHARE OF nodes,maps,assets,routes,activities",
    ).bind(node_id).bind(activity_id).bind(&principal.roles).fetch_optional(&mut *transaction).await?;
    let Some(activity) = activity else {
        return Ok(None);
    };
    if !availability
        .state_for_node(node_id, &activity.node_state, &activity.node_visual_config)
        .can_play()
        || crate::learner_playback::learner_safe_config(
            &activity.activity_type,
            activity.activity_config,
        )
        .is_none()
    {
        return Ok(None);
    }
    crate::learner_playback::mark_activity_reached(
        &mut transaction,
        availability.principal_id(),
        activity_id,
    )
    .await?;
    let state = crate::learner_playback_activity_state::load(
        &mut transaction,
        availability.principal_id(),
        activity_id,
    )
    .await?;
    transaction.commit().await?;
    Ok(Some(state))
}
