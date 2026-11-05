use serde_json::Value;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_tool_grant::{
    LearnerToolGrantError, LearnerToolGrantRepository as LearnerToolGrantRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerTool, LearnerToolGrantResult},
};

pub struct PostgresLearnerToolGrantRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerToolGrantRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct CurrentToolGrantRow {
    activity_config: Value,
    principal_id: Uuid,
}

#[derive(FromRow)]
struct ToolRow {
    animation_dark: Option<String>,
    animation_light: Option<String>,
    config: Value,
    description: Option<String>,
    id: Uuid,
    image_dark: Option<String>,
    image_light: Option<String>,
    slug: String,
    title: String,
}

impl LearnerToolGrantRepositoryPort for PostgresLearnerToolGrantRepository<'_> {
    fn grant_current_tool(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerToolGrantResult>, LearnerToolGrantError>,
    > + Send {
        async move {
            grant_current_tool(self.pool, principal, play_run_id, activity_slug)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not grant the current learner tool");
                    LearnerToolGrantError
                })
        }
    }
}

async fn grant_current_tool(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<LearnerToolGrantResult>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(current) =
        load_current_tool_grant_for_update(&mut transaction, principal, play_run_id, activity_slug)
            .await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    let Some(tool_slug) = configured_tool_slug(&current.activity_config) else {
        transaction.commit().await?;
        return Ok(None);
    };
    let tool = sqlx::query_as::<_, ToolRow>(
        "SELECT id, slug, title, description, image_dark, image_light, animation_dark, animation_light, config FROM learning_tools WHERE slug = $1",
    )
    .bind(tool_slug)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(tool) = tool else {
        transaction.commit().await?;
        return Ok(None);
    };
    let inserted = sqlx::query(
        "INSERT INTO learner_tools (principal_id, tool_id) VALUES ($1, $2) ON CONFLICT (principal_id, tool_id) DO NOTHING",
    )
    .bind(current.principal_id)
    .bind(tool.id)
    .execute(&mut *transaction)
    .await?
    .rows_affected()
        == 1;
    transaction.commit().await?;

    Ok(Some(LearnerToolGrantResult {
        already_owned: !inserted,
        tool: LearnerTool {
            animation_dark: tool.animation_dark,
            animation_light: tool.animation_light,
            config: tool.config,
            description: tool.description,
            image_dark: tool.image_dark,
            image_light: tool.image_light,
            slug: tool.slug,
            title: tool.title,
        },
    }))
}

async fn load_current_tool_grant_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<CurrentToolGrantRow>, sqlx::Error> {
    sqlx::query_as::<_, CurrentToolGrantRow>(
        "SELECT activities.activity_config, progress.principal_id FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'tool_grant' AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) FOR UPDATE OF progress",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await
}

pub(crate) fn configured_tool_slug(config: &Value) -> Option<&str> {
    let value = config.get("toolId")?.as_str()?.trim();
    let is_valid = !value.is_empty()
        && value.len() <= 80
        && value.bytes().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == b'-'
        });
    is_valid.then_some(value)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::configured_tool_slug;

    #[test]
    fn accepts_only_the_greenfield_public_tool_reference() {
        assert_eq!(
            configured_tool_slug(&json!({ "toolId": "magnifier" })),
            Some("magnifier")
        );
        assert_eq!(configured_tool_slug(&json!({ "toolId": 12 })), None);
        assert_eq!(
            configured_tool_slug(&json!({ "toolId": "Magnifier" })),
            None
        );
    }
}
