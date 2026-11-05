use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_node_tool::{
    LearnerNodeToolError, LearnerNodeToolRepository as LearnerNodeToolRepositoryPort,
    LearnerNodeToolTarget,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_availability::{LearnerNodeAvailabilityConfig, LearnerNodeToolAction},
    learner_state::LearnerNodeToolResult,
};

use crate::learner_node_availability::{PostgresLearnerNodeAvailability, authored_node_state};

pub struct PostgresLearnerNodeToolRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerNodeToolRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct NodeRow {
    id: Uuid,
    state: String,
    visual_config: Value,
}

impl LearnerNodeToolRepositoryPort for PostgresLearnerNodeToolRepository<'_> {
    fn use_tool(
        &self,
        principal: &AuthorizedPrincipal,
        target: &LearnerNodeToolTarget,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerNodeToolResult>, LearnerNodeToolError>,
    > + Send {
        async move {
            use_tool(self.pool, principal, target)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not use learner node tool");
                    LearnerNodeToolError
                })
        }
    }
}

async fn use_tool(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    target: &LearnerNodeToolTarget,
) -> Result<Option<LearnerNodeToolResult>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let principal_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(principal_id) = principal_id else {
        return Ok(None);
    };
    let node = sqlx::query_as::<_, NodeRow>(
        "SELECT nodes.id, nodes.state, nodes.visual_config FROM learning_nodes AS nodes INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE maps.slug = $1 AND nodes.slug = $2 AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3))) FOR UPDATE",
    )
    .bind(&target.map_slug)
    .bind(&target.node_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(node) = node else {
        return Ok(None);
    };
    let tool_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT tools.id FROM learner_tools AS holdings INNER JOIN learning_tools AS tools ON tools.id = holdings.tool_id WHERE holdings.principal_id = $1 AND tools.slug = $2",
    )
    .bind(principal_id)
    .bind(&target.tool_slug)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(tool_id) = tool_id else {
        return Ok(None);
    };

    let action = LearnerNodeAvailabilityConfig::from_visual_config(&node.visual_config)
        .tool_action(authored_node_state(&node.state));
    let is_useful = action.as_ref().is_some_and(|action| match action {
        LearnerNodeToolAction::Reveal { tool_reference }
        | LearnerNodeToolAction::Unlock { tool_reference } => tool_reference == &target.tool_slug,
    });
    let discovered = matches!(action, Some(LearnerNodeToolAction::Reveal { .. })) && is_useful;

    if is_useful {
        match action.expect("a useful action was present") {
            LearnerNodeToolAction::Reveal { .. } => {
                sqlx::query(
                    "INSERT INTO learner_node_discoveries (principal_id, node_id, tool_id) VALUES ($1, $2, $3) ON CONFLICT (principal_id, node_id) DO NOTHING",
                )
                .bind(principal_id)
                .bind(node.id)
                .bind(tool_id)
                .execute(&mut *transaction)
                .await?;
            }
            LearnerNodeToolAction::Unlock { .. } => {
                sqlx::query(
                    "INSERT INTO learner_node_discoveries (principal_id, node_id, tool_id) VALUES ($1, $2, $3) ON CONFLICT (principal_id, node_id) DO NOTHING",
                )
                .bind(principal_id)
                .bind(node.id)
                .bind(tool_id)
                .execute(&mut *transaction)
                .await?;
                sqlx::query(
                    "INSERT INTO learner_node_tool_uses (principal_id, node_id, tool_id) VALUES ($1, $2, $3) ON CONFLICT (principal_id, node_id, tool_id) DO NOTHING",
                )
                .bind(principal_id)
                .bind(node.id)
                .bind(tool_id)
                .execute(&mut *transaction)
                .await?;
            }
        }
    }
    transaction.commit().await?;

    let Some(availability) = PostgresLearnerNodeAvailability::load(pool, principal).await? else {
        return Ok(None);
    };
    let is_unlocked = availability
        .state_for_node(node.id, &node.state, &node.visual_config)
        .can_play();

    Ok(Some(LearnerNodeToolResult {
        discovered,
        is_unlocked,
        is_useful,
    }))
}
