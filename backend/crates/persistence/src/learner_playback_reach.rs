use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_playback::{
    LearnerPlaybackReachError, LearnerPlaybackReachRepository,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerPlaybackActivityState,
};

use crate::{
    learner_node_availability::PostgresLearnerNodeAvailability,
    learner_playback::learner_safe_config,
};

pub struct PostgresLearnerPlaybackReachRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerPlaybackReachRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl LearnerPlaybackReachRepository for PostgresLearnerPlaybackReachRepository<'_> {
    async fn reach_current_activity(
        &self,
        principal: &AuthorizedPrincipal,
        run: Uuid,
        reference: &str,
    ) -> Result<Option<LearnerPlaybackActivityState>, LearnerPlaybackReachError> {
        reach(self.pool, principal, run, reference)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not record the reached player activity");
                LearnerPlaybackReachError
            })
    }
}

#[derive(FromRow)]
struct Active {
    activity_id: Uuid,
    activity_type: String,
    activity_config: Value,
    node_id: Uuid,
    node_state: String,
    node_visual_config: Value,
}

async fn reach(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    run: Uuid,
    reference: &str,
) -> Result<Option<LearnerPlaybackActivityState>, sqlx::Error> {
    if let Some(completed) =
        crate::learner_playback::completed_route_receipt(pool, principal, run, reference).await?
    {
        return Ok(Some(completed.activity_state));
    }
    let Some(availability) = PostgresLearnerNodeAvailability::load(pool, principal).await? else {
        return Ok(None);
    };
    let mut transaction = pool.begin().await?;
    // These are static SQL fragments, never browser-selected table/column names.
    // Each run kind has the same ownership/publication check and locks the row
    // that its existing completion command locks before touching progress.
    for (table, run_column, activity_column, extra_join, predicate, recall) in [
        (
            "learner_route_progress",
            "current_play_run_id",
            "current_activity_id",
            "JOIN learning_activity_starts starts ON starts.id=runs.activity_start_id AND starts.node_id=nodes.id",
            "activities.activity_type IN ('open_practice','question','reflection','review','tool_grant','item_grant','item_obstacle','obstacle','markdown','npc_dialogue','shared_task','portal','message_prompt','message_wall') AND (activities.activity_type NOT IN ('message_prompt','message_wall') OR EXISTS (SELECT 1 FROM learning_message_topics topics WHERE topics.id::text=activities.activity_config->>'messageTopicId' AND topics.map_asset_id=assets.id AND (activities.activity_config->>'messageAudience'='peers' OR (activities.activity_type='message_prompt' AND activities.activity_config->>'messageAudience'='support'))))",
            false,
        ),
        (
            "learner_portal_arrival_runs",
            "id",
            "target_activity_id",
            "",
            "activities.activity_type='portal' AND activities.activity_config->>'portalMode'='input'",
            false,
        ),
        (
            "learner_revisit_runs",
            "id",
            "activity_id",
            "JOIN learner_activity_check_ins check_in ON check_in.id=runs.check_in_id AND check_in.principal_id=runs.principal_id AND check_in.activity_id=activities.id",
            "activities.activity_type IN ('open_practice','question','reflection','review')",
            false,
        ),
        (
            "learner_recall_runs",
            "id",
            "activity_id",
            "",
            "activities.activity_type='question'",
            true,
        ),
        (
            "learner_activity_replay_runs",
            "id",
            "activity_id",
            "",
            "activities.activity_type IN ('open_practice','question','reflection','review','tool_grant','item_grant','item_obstacle','obstacle','markdown','npc_dialogue')",
            false,
        ),
    ] {
        let query = format!(
            "SELECT activities.id AS activity_id,activities.activity_type,activities.activity_config, \
             nodes.id AS node_id,nodes.state AS node_state,nodes.visual_config AS node_visual_config \
             FROM {table} runs \
             JOIN learning_activities activities ON activities.id=runs.{activity_column} \
             JOIN learning_routes routes ON routes.id=activities.route_id \
             JOIN learning_map_assets assets ON assets.id=routes.map_asset_id \
             JOIN learning_nodes nodes ON nodes.map_asset_id=assets.id \
             JOIN learning_maps maps ON maps.id=nodes.map_id {extra_join} \
             WHERE runs.principal_id=$1 AND runs.{run_column}=$2 AND runs.status='in_progress' \
             AND ($3='id:' || activities.id::text OR (left($3,3)<>'id:' AND activities.slug=$3)) \
             AND ({predicate}) AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL \
             AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL \
             AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS \
                 (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) r(role) WHERE r.role=ANY($4))) \
             FOR UPDATE OF runs"
        );
        let current = sqlx::query_as::<_, Active>(&query)
            .bind(availability.principal_id())
            .bind(run)
            .bind(reference)
            .bind(&principal.roles)
            .fetch_optional(&mut *transaction)
            .await?;
        let Some(current) = current else { continue };
        if !availability
            .state_for_node(
                current.node_id,
                &current.node_state,
                &current.node_visual_config,
            )
            .can_play()
            || learner_safe_config(&current.activity_type, current.activity_config.clone())
                .is_none()
        {
            return Ok(None);
        }
        if !recall {
            sqlx::query("INSERT INTO learner_activity_progress (principal_id,activity_id,status) VALUES ($1,$2,'reached') ON CONFLICT (principal_id,activity_id) DO UPDATE SET updated_at=NOW()")
                .bind(availability.principal_id()).bind(current.activity_id).execute(&mut *transaction).await?;
            crate::learner_evidence::record_topic_visit(
                &mut transaction,
                availability.principal_id(),
                &current.activity_config,
                &current.activity_type,
            )
            .await?;
            if table == "learner_route_progress" {
                sqlx::query("UPDATE learner_route_progress SET last_entered_at=NOW(),updated_at=NOW() WHERE principal_id=$1 AND current_play_run_id=$2")
                    .bind(availability.principal_id()).bind(run).execute(&mut *transaction).await?;
            }
        }
        let state = crate::learner_playback_activity_state::load(
            &mut transaction,
            availability.principal_id(),
            current.activity_id,
        )
        .await?;
        transaction.commit().await?;
        return Ok(Some(state));
    }
    Ok(None)
}
