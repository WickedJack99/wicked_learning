use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::content_api_activity::{
    ContentApiActivity, ContentApiActivityReadError, ContentApiActivityRepository,
    ContentApiMapAssetActivities, ContentApiMapAssetTransitions,
};
use wicked_learning_domain::{
    identity_access::{AuthorizedPrincipal, permission_scope_allows},
    world_content::AdminActivityTransition,
};

pub struct PostgresContentApiActivityRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresContentApiActivityRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl ContentApiActivityRepository for PostgresContentApiActivityRepository<'_> {
    fn load_activities(
        &self,
        principal: &AuthorizedPrincipal,
        map_asset_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<ContentApiMapAssetActivities>, ContentApiActivityReadError>,
    > + Send {
        async move {
            load_activities(self.pool, principal, map_asset_id)
                .await
                .map_err(unavailable)
        }
    }

    fn load_node_id(
        &self,
        principal: &AuthorizedPrincipal,
        map_asset_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, ContentApiActivityReadError>> + Send
    {
        async move {
            load_context(self.pool, principal, map_asset_id)
                .await
                .map(|context| context.map(|context| context.node_id))
                .map_err(unavailable)
        }
    }

    fn load_activity_id(
        &self,
        principal: &AuthorizedPrincipal,
        map_asset_id: Uuid,
        activity_id: Uuid,
        activity_type: &str,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, ContentApiActivityReadError>> + Send
    {
        async move {
            load_activity_id(
                self.pool,
                principal,
                map_asset_id,
                activity_id,
                activity_type,
            )
            .await
            .map_err(unavailable)
        }
    }

    fn load_any_activity_id(
        &self,
        principal: &AuthorizedPrincipal,
        map_asset_id: Uuid,
        activity_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, ContentApiActivityReadError>> + Send
    {
        async move {
            load_any_activity_id(self.pool, principal, map_asset_id, activity_id)
                .await
                .map_err(unavailable)
        }
    }

    fn load_transitions(
        &self,
        principal: &AuthorizedPrincipal,
        map_asset_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<ContentApiMapAssetTransitions>, ContentApiActivityReadError>,
    > + Send {
        async move {
            load_transitions(self.pool, principal, map_asset_id)
                .await
                .map_err(unavailable)
        }
    }

    fn load_transition_id(
        &self,
        principal: &AuthorizedPrincipal,
        map_asset_id: Uuid,
        transition_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, ContentApiActivityReadError>> + Send
    {
        async move {
            load_transition_id(self.pool, principal, map_asset_id, transition_id)
                .await
                .map_err(unavailable)
        }
    }
}

fn unavailable(error: sqlx::Error) -> ContentApiActivityReadError {
    tracing::error!(%error, "could not load scoped Content API activities");
    ContentApiActivityReadError
}

#[derive(FromRow)]
struct MapAssetContext {
    node_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
}

#[derive(FromRow)]
struct ActivityRow {
    id: Uuid,
    slug: String,
    activity_type: String,
    title: String,
    introduction: Option<String>,
    config: Value,
    position_x: Option<f64>,
    position_y: Option<f64>,
    updated_at: String,
}

#[derive(FromRow)]
struct TransitionRow {
    id: Uuid,
    from_activity_id: Uuid,
    to_activity_id: Option<Uuid>,
    from_connector: String,
    to_connector: Option<String>,
    trigger: String,
    trigger_value: Option<String>,
    label: Option<String>,
}

async fn load_activities(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_asset_id: Uuid,
) -> Result<Option<ContentApiMapAssetActivities>, sqlx::Error> {
    let Some(context) = load_context(pool, principal, map_asset_id).await? else {
        return Ok(None);
    };
    let rows = sqlx::query_as::<_, ActivityRow>(
        "SELECT activities.id, activities.slug, activities.activity_type, activities.title, \
         activities.introduction, activities.activity_config AS config, \
         activities.graph_position_x AS position_x, activities.graph_position_y AS position_y, \
         to_char(activities.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at \
         FROM learning_activities AS activities \
         INNER JOIN learning_routes AS routes ON routes.id = activities.route_id \
         WHERE routes.map_asset_id = $1 \
         ORDER BY routes.position ASC, activities.position ASC, activities.slug ASC",
    )
    .bind(map_asset_id)
    .fetch_all(pool)
    .await?;

    Ok(Some(ContentApiMapAssetActivities {
        node_id: context.node_id,
        activities: rows
            .into_iter()
            .map(|row| ContentApiActivity {
                id: row.id,
                slug: row.slug,
                activity_type: row.activity_type,
                title: row.title,
                introduction: row.introduction,
                config: row.config,
                position_x: row.position_x,
                position_y: row.position_y,
                updated_at: row.updated_at,
            })
            .collect(),
    }))
}

async fn load_transitions(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_asset_id: Uuid,
) -> Result<Option<ContentApiMapAssetTransitions>, sqlx::Error> {
    if load_context(pool, principal, map_asset_id).await?.is_none() {
        return Ok(None);
    }
    let rows = sqlx::query_as::<_, TransitionRow>(
        "SELECT transitions.id, transitions.from_activity_id, transitions.to_activity_id, \
         transitions.from_connector, transitions.to_connector, transitions.trigger, \
         transitions.trigger_value, transitions.label \
         FROM learning_activity_transitions AS transitions \
         INNER JOIN learning_activities AS activities ON activities.id = transitions.from_activity_id \
         INNER JOIN learning_routes AS routes ON routes.id = activities.route_id \
         WHERE routes.map_asset_id = $1 \
         ORDER BY transitions.created_at ASC, transitions.id ASC",
    )
    .bind(map_asset_id)
    .fetch_all(pool)
    .await?;

    Ok(Some(ContentApiMapAssetTransitions {
        transitions: rows
            .into_iter()
            .map(|row| AdminActivityTransition {
                id: row.id,
                from_activity_id: row.from_activity_id,
                to_activity_id: row.to_activity_id,
                from_connector: row.from_connector,
                to_connector: row.to_connector.unwrap_or_else(|| "in".to_owned()),
                trigger: row.trigger,
                trigger_value: row.trigger_value,
                label: row.label,
            })
            .collect(),
    }))
}

async fn load_transition_id(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_asset_id: Uuid,
    transition_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    if load_context(pool, principal, map_asset_id).await?.is_none() {
        return Ok(None);
    }

    sqlx::query_scalar::<_, Uuid>(
        "SELECT transitions.id \
         FROM learning_activity_transitions AS transitions \
         INNER JOIN learning_activities AS activities ON activities.id = transitions.from_activity_id \
         INNER JOIN learning_routes AS routes ON routes.id = activities.route_id \
         WHERE routes.map_asset_id = $1 AND transitions.id = $2",
    )
    .bind(map_asset_id)
    .bind(transition_id)
    .fetch_optional(pool)
    .await
}

async fn load_activity_id(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_asset_id: Uuid,
    activity_id: Uuid,
    activity_type: &str,
) -> Result<Option<Uuid>, sqlx::Error> {
    if load_context(pool, principal, map_asset_id).await?.is_none() {
        return Ok(None);
    }

    sqlx::query_scalar::<_, Uuid>(
        "SELECT activities.id \
         FROM learning_activities AS activities \
         INNER JOIN learning_routes AS routes ON routes.id = activities.route_id \
         WHERE routes.map_asset_id = $1 AND activities.id = $2 AND activities.activity_type = $3",
    )
    .bind(map_asset_id)
    .bind(activity_id)
    .bind(activity_type)
    .fetch_optional(pool)
    .await
}

async fn load_any_activity_id(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_asset_id: Uuid,
    activity_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    if load_context(pool, principal, map_asset_id).await?.is_none() {
        return Ok(None);
    }

    sqlx::query_scalar::<_, Uuid>(
        "SELECT activities.id \
         FROM learning_activities AS activities \
         INNER JOIN learning_routes AS routes ON routes.id = activities.route_id \
         WHERE routes.map_asset_id = $1 AND activities.id = $2",
    )
    .bind(map_asset_id)
    .bind(activity_id)
    .fetch_optional(pool)
    .await
}

async fn load_context(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_asset_id: Uuid,
) -> Result<Option<MapAssetContext>, sqlx::Error> {
    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };
    let Some(context) = sqlx::query_as::<_, MapAssetContext>(
        "SELECT nodes.id AS node_id, maps.id AS map_id, maps.created_by_principal_id AS map_creator_id \
         FROM learning_map_assets AS assets \
         INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id \
         INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id \
         WHERE assets.id = $1",
    )
    .bind(map_asset_id)
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };
    let direct_editor: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups \
         INNER JOIN learning_group_memberships AS memberships \
         ON memberships.group_id = editing_groups.group_id \
         WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)",
    )
    .bind(context.map_id)
    .bind(principal_id)
    .fetch_one(pool)
    .await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(None);
    };
    let permitted = scope == "all"
        || (permission_scope_allows(scope, "own") && context.map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_editor)
        || direct_editor;

    Ok(permitted.then_some(context))
}
