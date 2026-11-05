use std::collections::BTreeSet;

use serde_json::Value;
use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_availability::{
        LearnerNodeAvailabilityConfig, LearnerNodeState, learner_node_state, schedule_facts,
    },
};

/// The source availability facts currently represented in the Rust schema.
/// Discovery, answer-event, tool/item and support-override facts remain false
/// until their source-defined writers and data models are added; callers must
/// not treat this as full dynamic availability parity.
pub struct PostgresLearnerNodeAvailability {
    completed_node_references: BTreeSet<String>,
    principal_id: Uuid,
    role_slugs: BTreeSet<String>,
}

impl PostgresLearnerNodeAvailability {
    pub async fn load(
        pool: &PgPool,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<Self>, sqlx::Error> {
        let principal_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM application_principals WHERE identity_subject_id = $1",
        )
        .bind(principal.subject_id)
        .fetch_optional(pool)
        .await?;
        let Some(principal_id) = principal_id else {
            return Ok(None);
        };
        let completed_node_references = sqlx::query_scalar::<_, Uuid>(
            "SELECT DISTINCT nodes.id FROM learner_activity_progress AS progress INNER JOIN learning_activities AS activities ON activities.id = progress.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id WHERE progress.principal_id = $1 AND progress.status = 'completed'",
        )
        .bind(principal_id)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|node_id| node_id.to_string())
        .collect();

        Ok(Some(Self {
            completed_node_references,
            principal_id,
            role_slugs: principal.roles.iter().cloned().collect(),
        }))
    }

    pub fn principal_id(&self) -> Uuid {
        self.principal_id
    }

    pub fn state_for_node(&self, state: &str, visual_config: &Value) -> LearnerNodeState {
        let mut facts = schedule_facts(visual_config, OffsetDateTime::now_utc());
        facts.completed_node_references = self.completed_node_references.clone();
        facts.role_slugs = self.role_slugs.clone();

        learner_node_state(
            authored_state(state),
            &LearnerNodeAvailabilityConfig::from_visual_config(visual_config),
            &facts,
        )
    }
}

fn authored_state(state: &str) -> LearnerNodeState {
    match state {
        "available" => LearnerNodeState::Available,
        "locked" => LearnerNodeState::Locked,
        "hidden" => LearnerNodeState::Hidden,
        _ => LearnerNodeState::Hidden,
    }
}
