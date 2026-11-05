use std::collections::{BTreeSet, HashSet};

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
/// Discovery, tool/item and support-override records are read when present;
/// answer-event facts remain false until their source-defined writer and data
/// model are added. Callers must not treat this as full dynamic availability
/// parity: absent facts fail closed.
pub struct PostgresLearnerNodeAvailability {
    completed_node_references: BTreeSet<String>,
    discovered_node_ids: HashSet<Uuid>,
    manually_unlocked_node_ids: HashSet<Uuid>,
    owned_item_references: BTreeSet<String>,
    principal_id: Uuid,
    role_slugs: BTreeSet<String>,
    tool_unlocked_node_ids: HashSet<Uuid>,
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
        let discovered_node_ids = load_node_ids(
            pool,
            "SELECT node_id FROM learner_node_discoveries WHERE principal_id = $1",
            principal_id,
        )
        .await?;
        let manually_unlocked_node_ids = load_node_ids(
            pool,
            "SELECT node_id FROM learner_node_manual_unlocks WHERE principal_id = $1 AND revoked_at IS NULL",
            principal_id,
        )
        .await?;
        let tool_unlocked_node_ids = load_node_ids(
            pool,
            "SELECT node_id FROM learner_node_tool_uses WHERE principal_id = $1",
            principal_id,
        )
        .await?;
        let owned_item_references = sqlx::query_scalar::<_, String>(
            "SELECT items.slug FROM learner_item_holdings AS holdings INNER JOIN learning_items AS items ON items.id = holdings.item_id WHERE holdings.principal_id = $1 AND holdings.quantity > 0",
        )
        .bind(principal_id)
        .fetch_all(pool)
        .await?
        .into_iter()
        .collect();

        Ok(Some(Self {
            completed_node_references,
            discovered_node_ids,
            manually_unlocked_node_ids,
            owned_item_references,
            principal_id,
            role_slugs: principal.roles.iter().cloned().collect(),
            tool_unlocked_node_ids,
        }))
    }

    pub fn principal_id(&self) -> Uuid {
        self.principal_id
    }

    pub fn state_for_node(
        &self,
        node_id: Uuid,
        state: &str,
        visual_config: &Value,
    ) -> LearnerNodeState {
        let mut facts = schedule_facts(visual_config, OffsetDateTime::now_utc());
        facts.completed_node_references = self.completed_node_references.clone();
        facts.has_discovery = self.discovered_node_ids.contains(&node_id);
        facts.has_manual_unlock = self.manually_unlocked_node_ids.contains(&node_id);
        facts.has_tool_unlock = self.tool_unlocked_node_ids.contains(&node_id);
        facts.owned_item_references = self.owned_item_references.clone();
        facts.role_slugs = self.role_slugs.clone();

        learner_node_state(
            authored_state(state),
            &LearnerNodeAvailabilityConfig::from_visual_config(visual_config),
            &facts,
        )
    }
}

async fn load_node_ids(
    pool: &PgPool,
    query: &str,
    principal_id: Uuid,
) -> Result<HashSet<Uuid>, sqlx::Error> {
    Ok(sqlx::query_scalar::<_, Uuid>(query)
        .bind(principal_id)
        .fetch_all(pool)
        .await?
        .into_iter()
        .collect())
}

fn authored_state(state: &str) -> LearnerNodeState {
    match state {
        "available" => LearnerNodeState::Available,
        "locked" => LearnerNodeState::Locked,
        "hidden" => LearnerNodeState::Hidden,
        _ => LearnerNodeState::Hidden,
    }
}
