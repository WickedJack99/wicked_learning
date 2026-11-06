use serde_json::Value;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_obstacle_tool::{
    LearnerObstacleToolError, LearnerObstacleToolRepository as LearnerObstacleToolRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerObstacleToolResult,
};

use crate::learner_item_grant::valid_public_slug;

pub struct PostgresLearnerObstacleToolRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerObstacleToolRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct CurrentObstacleRow {
    activity_config: Value,
    activity_id: Uuid,
    principal_id: Uuid,
}

#[derive(FromRow)]
struct OwnedToolRow {
    tool_id: Uuid,
}

impl LearnerObstacleToolRepositoryPort for PostgresLearnerObstacleToolRepository<'_> {
    fn use_current_tool(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        tool_slug: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerObstacleToolResult>, LearnerObstacleToolError>,
    > + Send {
        async move {
            use_current_tool(self.pool, principal, play_run_id, activity_slug, tool_slug)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not use a learner obstacle tool");
                    LearnerObstacleToolError
                })
        }
    }
}

async fn use_current_tool(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
    tool_slug: &str,
) -> Result<Option<LearnerObstacleToolResult>, sqlx::Error> {
    if !valid_public_slug(tool_slug) {
        return Ok(None);
    }

    let mut transaction = pool.begin().await?;
    let Some(current) =
        load_current_obstacle_for_update(&mut transaction, principal, play_run_id, activity_slug)
            .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let Some(tool) =
        owned_tool_for_update(&mut transaction, current.principal_id, tool_slug).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };

    let is_useful = configured_tool_slugs(&current.activity_config)
        .iter()
        .any(|configured| configured == tool_slug);
    if !is_useful {
        transaction.commit().await?;
        return Ok(Some(LearnerObstacleToolResult {
            is_resolved: false,
            is_useful: false,
        }));
    }

    sqlx::query(
        "INSERT INTO learner_obstacle_run_passes (principal_id, activity_id, play_run_id, used_tool_id) VALUES ($1, $2, $3, $4) ON CONFLICT (principal_id, activity_id, play_run_id) DO NOTHING",
    )
    .bind(current.principal_id)
    .bind(current.activity_id)
    .bind(play_run_id)
    .bind(tool.tool_id)
    .execute(&mut *transaction)
    .await?;

    let persists_after_solved = persists_after_solved(&current.activity_config);
    if persists_after_solved {
        sqlx::query(
            "INSERT INTO learner_obstacle_resolutions (principal_id, activity_id) VALUES ($1, $2) ON CONFLICT (principal_id, activity_id) DO NOTHING",
        )
        .bind(current.principal_id)
        .bind(current.activity_id)
        .execute(&mut *transaction)
        .await?;
    }

    transaction.commit().await?;
    Ok(Some(LearnerObstacleToolResult {
        is_resolved: true,
        is_useful: true,
    }))
}

async fn load_current_obstacle_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<CurrentObstacleRow>, sqlx::Error> {
    let route = sqlx::query_as::<_, CurrentObstacleRow>(
        "SELECT activities.activity_config, activities.id AS activity_id, progress.principal_id FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'obstacle' AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF progress",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await?;
    if route.is_some() {
        return Ok(route);
    }

    sqlx::query_as::<_, CurrentObstacleRow>(
        "SELECT activities.activity_config, activities.id AS activity_id, runs.principal_id FROM learner_activity_replay_runs AS runs INNER JOIN application_principals AS principals ON principals.id = runs.principal_id INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'obstacle' AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF runs",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await
}

async fn owned_tool_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    tool_slug: &str,
) -> Result<Option<OwnedToolRow>, sqlx::Error> {
    sqlx::query_as::<_, OwnedToolRow>(
        "SELECT tools.id AS tool_id FROM learner_tools AS holdings INNER JOIN learning_tools AS tools ON tools.id = holdings.tool_id WHERE holdings.principal_id = $1 AND tools.slug = $2 FOR UPDATE OF holdings",
    )
    .bind(principal_id)
    .bind(tool_slug)
    .fetch_optional(&mut **transaction)
    .await
}

/// Greenfield authored content refers to a tool by its stable public slug,
/// not the original Laravel numeric primary key. Invalid values are ignored
/// rather than becoming an accidental authorization grant.
pub(crate) fn configured_tool_slugs(config: &Value) -> Vec<String> {
    config
        .get("allowedToolIds")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .map(str::trim)
        .filter(|slug| valid_public_slug(slug))
        .take(100)
        .map(ToOwned::to_owned)
        .collect()
}

pub(crate) fn persists_after_solved(config: &Value) -> bool {
    config
        .get("persistAfterSolved")
        .and_then(Value::as_bool)
        .unwrap_or(true)
}

/// A persistent source obstacle may be completed in a later run after its
/// durable clear. A non-persistent obstacle must have a useful tool use on
/// the exact current opaque run.
pub(crate) async fn obstacle_passed_for_run(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
    play_run_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_obstacle_resolutions WHERE principal_id = $1 AND activity_id = $2) OR EXISTS (SELECT 1 FROM learner_obstacle_run_passes WHERE principal_id = $1 AND activity_id = $2 AND play_run_id = $3)",
    )
    .bind(principal_id)
    .bind(activity_id)
    .bind(play_run_id)
    .fetch_one(&mut **transaction)
    .await
}

/// Read-only playback enrichment must not create learner state.
pub(crate) async fn obstacle_is_persistently_resolved(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
    activity_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_obstacle_resolutions WHERE principal_id = $1 AND activity_id = $2)",
    )
    .bind(principal_id)
    .bind(activity_id)
    .fetch_one(&mut **transaction)
    .await
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{configured_tool_slugs, persists_after_solved};

    #[test]
    fn accepts_only_bounded_public_tool_references() {
        assert_eq!(
            configured_tool_slugs(&json!({
                "allowedToolIds": ["hammer", 4, "Not a slug", "magnifier"]
            })),
            ["hammer", "magnifier"]
        );
    }

    #[test]
    fn persistence_defaults_to_the_source_default() {
        assert!(persists_after_solved(&json!({})));
        assert!(!persists_after_solved(
            &json!({ "persistAfterSolved": false })
        ));
    }
}
