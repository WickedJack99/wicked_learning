use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_portal::{
    LearnerPortalRepository as LearnerPortalRepositoryPort, LearnerPortalTravelError,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerPortalTravelResult,
};

use crate::{
    learner_evidence::{CompletionEvidence, record_completion_evidence},
    learner_node_availability::PostgresLearnerNodeAvailability,
};

pub struct PostgresLearnerPortalRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerPortalRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct PortalTravelSourceRow {
    activity_config: serde_json::Value,
    activity_id: Uuid,
    principal_id: Uuid,
    target_activity_id: Uuid,
    target_node_id: Uuid,
    target_node_slug: String,
    target_node_state: String,
    target_node_visual_config: serde_json::Value,
}

#[derive(FromRow)]
struct ExistingPortalArrivalRow {
    arrival_id: Uuid,
    target_node_id: Uuid,
    target_node_slug: String,
    target_node_state: String,
    target_node_visual_config: serde_json::Value,
}

impl LearnerPortalRepositoryPort for PostgresLearnerPortalRepository<'_> {
    fn travel(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerPortalTravelResult>, LearnerPortalTravelError>,
    > + Send {
        async move {
            travel(self.pool, principal, play_run_id, activity_slug)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not traverse learner portal");
                    LearnerPortalTravelError
                })
        }
    }
}

async fn travel(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<LearnerPortalTravelResult>, sqlx::Error> {
    // This is deliberately loaded before the write transaction. The source UI
    // also determines whether an already-rendered destination is playable
    // before it completes the departure portal. The command repeats that
    // policy on the server rather than trusting the rendered state.
    let Some(availability) = PostgresLearnerNodeAvailability::load(pool, principal).await? else {
        return Ok(None);
    };
    if let Some(arrival) =
        load_existing_arrival(pool, principal, play_run_id, activity_slug).await?
    {
        if availability
            .state_for_node(
                arrival.target_node_id,
                &arrival.target_node_state,
                &arrival.target_node_visual_config,
            )
            .can_play()
        {
            return Ok(Some(LearnerPortalTravelResult {
                node_slug: arrival.target_node_slug,
                play_run_id: arrival.arrival_id.to_string(),
            }));
        }

        return Ok(None);
    }
    let mut transaction = pool.begin().await?;
    let source = sqlx::query_as::<_, PortalTravelSourceRow>(
        "SELECT activities.activity_config, activities.id AS activity_id, progress.principal_id, links.target_activity_id, target_nodes.id AS target_node_id, target_nodes.slug AS target_node_slug, target_nodes.state AS target_node_state, target_nodes.visual_config AS target_node_visual_config \
         FROM learner_route_progress AS progress \
         INNER JOIN application_principals AS principals ON principals.id = progress.principal_id \
         INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id \
         INNER JOIN learning_nodes AS source_nodes ON source_nodes.id = starts.node_id \
         INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id \
         INNER JOIN learning_routes AS source_routes ON source_routes.id = activities.route_id \
         INNER JOIN learning_map_assets AS source_assets ON source_assets.id = source_routes.map_asset_id \
         INNER JOIN learning_maps AS source_maps ON source_maps.id = source_nodes.map_id \
         INNER JOIN learning_portal_links AS links ON links.source_activity_id = activities.id AND links.source_node_id = source_nodes.id \
         INNER JOIN learning_activities AS target_activities ON target_activities.id = links.target_activity_id \
         INNER JOIN learning_routes AS target_routes ON target_routes.id = target_activities.route_id \
         INNER JOIN learning_map_assets AS target_assets ON target_assets.id = target_routes.map_asset_id \
         INNER JOIN learning_nodes AS target_nodes ON target_nodes.id = links.target_node_id AND target_nodes.map_asset_id = target_assets.id \
         INNER JOIN learning_maps AS target_maps ON target_maps.id = target_nodes.map_id \
         WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' \
           AND activities.slug = $3 AND activities.activity_type = 'portal' \
           AND COALESCE(activities.activity_config ->> 'portalMode', 'output') = 'output' \
           AND target_activities.activity_type = 'portal' \
           AND COALESCE(target_activities.activity_config ->> 'portalMode', 'output') = 'input' \
           AND source_nodes.map_asset_id = source_assets.id \
           AND source_maps.published_at IS NOT NULL AND source_nodes.published_at IS NOT NULL \
           AND source_assets.published_at IS NOT NULL AND source_routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL \
           AND target_maps.published_at IS NOT NULL AND target_nodes.published_at IS NOT NULL \
           AND target_assets.published_at IS NOT NULL AND target_routes.published_at IS NOT NULL AND target_activities.published_at IS NOT NULL \
           AND (source_maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(source_maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) \
           AND (target_maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(target_maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) \
           AND NOT EXISTS (SELECT 1 FROM learning_activity_transitions AS transitions WHERE transitions.from_activity_id = activities.id AND transitions.from_connector = 'completed' AND transitions.trigger = 'completed') \
         FOR UPDATE OF progress",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(source) = source else {
        transaction.commit().await?;
        return Ok(None);
    };
    if source.principal_id != availability.principal_id()
        || !availability
            .state_for_node(
                source.target_node_id,
                &source.target_node_state,
                &source.target_node_visual_config,
            )
            .can_play()
    {
        transaction.commit().await?;
        return Ok(None);
    }

    mark_activity_completed(&mut transaction, source.principal_id, source.activity_id).await?;
    record_completion_evidence(
        &mut transaction,
        CompletionEvidence {
            activity_config: &source.activity_config,
            activity_id: source.activity_id,
            activity_type: "portal",
            assistance_level: "untracked",
            attempt_number: 1,
            calibration: None,
            confidence: None,
            confidence_after_feedback: None,
            learner_reflection_id: None,
            reflection_is_independent_check: false,
            reflection_observed_cues: None,
            outcome: "completed",
            play_run_id,
            principal_id: source.principal_id,
            reflection_response_type: None,
        },
    )
    .await?;
    let completed = sqlx::query(
        "UPDATE learner_route_progress SET status = 'completed', completion_count = completion_count + 1, last_completed_at = NOW(), last_exited_at = NOW(), updated_at = NOW() WHERE principal_id = $1 AND current_play_run_id = $2 AND current_activity_id = $3 AND status = 'in_progress'",
    )
    .bind(source.principal_id)
    .bind(play_run_id)
    .bind(source.activity_id)
    .execute(&mut *transaction)
    .await?
    .rows_affected();
    if completed != 1 {
        transaction.commit().await?;
        return Ok(None);
    }

    let arrival_id = Uuid::new_v4();
    let existing_arrival = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learner_portal_arrival_runs WHERE principal_id = $1 AND source_play_run_id = $2 AND source_activity_id = $3 FOR UPDATE",
    )
    .bind(source.principal_id)
    .bind(play_run_id)
    .bind(source.activity_id)
    .fetch_optional(&mut *transaction)
    .await?;
    let arrival_id = match existing_arrival {
        Some(existing_arrival) => existing_arrival,
        None => {
            sqlx::query(
                "INSERT INTO learner_portal_arrival_runs (id, principal_id, source_play_run_id, source_activity_id, target_activity_id) VALUES ($1, $2, $3, $4, $5)",
            )
            .bind(arrival_id)
            .bind(source.principal_id)
            .bind(play_run_id)
            .bind(source.activity_id)
            .bind(source.target_activity_id)
            .execute(&mut *transaction)
            .await?;
            arrival_id
        }
    };

    transaction.commit().await?;
    Ok(Some(LearnerPortalTravelResult {
        node_slug: source.target_node_slug,
        play_run_id: arrival_id.to_string(),
    }))
}

async fn load_existing_arrival(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    source_play_run_id: Uuid,
    source_activity_slug: &str,
) -> Result<Option<ExistingPortalArrivalRow>, sqlx::Error> {
    sqlx::query_as::<_, ExistingPortalArrivalRow>(
        "SELECT arrivals.id AS arrival_id, target_nodes.id AS target_node_id, target_nodes.slug AS target_node_slug, target_nodes.state AS target_node_state, target_nodes.visual_config AS target_node_visual_config \
         FROM learner_portal_arrival_runs AS arrivals \
         INNER JOIN application_principals AS principals ON principals.id = arrivals.principal_id \
         INNER JOIN learning_activities AS source_activities ON source_activities.id = arrivals.source_activity_id \
         INNER JOIN learning_portal_links AS links ON links.source_activity_id = source_activities.id AND links.target_activity_id = arrivals.target_activity_id \
         INNER JOIN learning_activities AS target_activities ON target_activities.id = arrivals.target_activity_id \
         INNER JOIN learning_routes AS target_routes ON target_routes.id = target_activities.route_id \
         INNER JOIN learning_map_assets AS target_assets ON target_assets.id = target_routes.map_asset_id \
         INNER JOIN learning_nodes AS target_nodes ON target_nodes.id = links.target_node_id AND target_nodes.map_asset_id = target_assets.id \
         INNER JOIN learning_maps AS target_maps ON target_maps.id = target_nodes.map_id \
         WHERE principals.identity_subject_id = $1 AND arrivals.source_play_run_id = $2 AND source_activities.slug = $3 \
           AND arrivals.status = 'in_progress' AND target_activities.activity_type = 'portal' \
           AND COALESCE(target_activities.activity_config ->> 'portalMode', 'output') = 'input' \
           AND target_maps.published_at IS NOT NULL AND target_nodes.published_at IS NOT NULL \
           AND target_assets.published_at IS NOT NULL AND target_routes.published_at IS NOT NULL AND target_activities.published_at IS NOT NULL \
           AND (target_maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(target_maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4)))",
    )
    .bind(principal.subject_id)
    .bind(source_play_run_id)
    .bind(source_activity_slug)
    .bind(&principal.roles)
    .fetch_optional(pool)
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
