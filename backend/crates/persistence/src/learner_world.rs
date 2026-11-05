use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_world::{
    LearnerWorldReadError, LearnerWorldRepository as LearnerWorldRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerActivityProgress, LearnerActivityStart, LearnerActivityStartProgress,
        LearnerRouteProgress, LearnerWorldRoute, LearnerWorldSnapshot,
    },
};

use crate::public_world::load_first_visible as load_visible_world;

pub struct PostgresLearnerWorldRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerWorldRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl LearnerWorldRepositoryPort for PostgresLearnerWorldRepository<'_> {
    fn load_first_visible(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl std::future::Future<
        Output = Result<Option<LearnerWorldSnapshot>, LearnerWorldReadError>,
    > + Send {
        async move {
            load_first_visible(self.pool, principal)
                .await
                .map_err(|_| LearnerWorldReadError)
        }
    }
}

#[derive(FromRow)]
struct ActivityProgressRow {
    activity_slug: String,
    completed_at: Option<String>,
    node_slug: String,
    status: String,
}

#[derive(FromRow)]
struct RouteProgressRow {
    completion_count: i32,
    current_activity_slug: Option<String>,
    last_completed_at: Option<String>,
    last_entered_at: Option<String>,
    node_slug: String,
    route_slug: String,
    status: String,
    start_id: Uuid,
}

#[derive(FromRow)]
struct AvailableRouteRow {
    activity_count: i64,
    description: String,
    node_slug: String,
    route_slug: String,
    title: String,
}

#[derive(FromRow)]
struct ActivityStartRow {
    activity_slug: String,
    button_border_color_dark: Option<String>,
    button_border_color_light: Option<String>,
    button_color_dark: Option<String>,
    button_color_light: Option<String>,
    completion_count: Option<i32>,
    current_activity_slug: Option<String>,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    label: String,
    last_completed_at: Option<String>,
    last_entered_at: Option<String>,
    node_slug: String,
    route_slug: String,
    sort_order: i16,
    start_id: Uuid,
    status: Option<String>,
}

async fn load_first_visible(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Option<LearnerWorldSnapshot>, sqlx::Error> {
    let Some(loaded_world) = load_visible_world(pool, &principal.roles).await? else {
        return Ok(None);
    };
    let principal_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await?;
    let Some(principal_id) = principal_id else {
        return Ok(None);
    };

    let bookmarked_node_slugs = sqlx::query_scalar::<_, String>(
        "SELECT nodes.slug FROM learner_node_bookmarks AS bookmarks INNER JOIN learning_nodes AS nodes ON nodes.id = bookmarks.node_id WHERE bookmarks.principal_id = $1 AND nodes.map_id = ANY($2) AND nodes.published_at IS NOT NULL ORDER BY bookmarks.created_at ASC, nodes.slug ASC",
    )
    .bind(principal_id)
    .bind(&loaded_world.map_ids)
    .fetch_all(pool)
    .await?;
    let activity_progress = sqlx::query_as::<_, ActivityProgressRow>(
        "SELECT activities.slug AS activity_slug, to_char(progress.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS completed_at, nodes.slug AS node_slug, progress.status FROM learner_activity_progress AS progress INNER JOIN learning_activities AS activities ON activities.id = progress.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id WHERE progress.principal_id = $1 AND nodes.map_id = ANY($2) AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL ORDER BY nodes.slug ASC, activities.slug ASC",
    )
    .bind(principal_id)
    .bind(&loaded_world.map_ids)
    .fetch_all(pool)
    .await?;
    let route_progress = sqlx::query_as::<_, RouteProgressRow>(
        "SELECT progress.completion_count, current_activity.slug AS current_activity_slug, to_char(progress.last_completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS last_completed_at, to_char(progress.last_entered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS last_entered_at, nodes.slug AS node_slug, routes.slug AS route_slug, progress.status, progress.activity_start_id AS start_id FROM learner_route_progress AS progress INNER JOIN learning_routes AS routes ON routes.id = progress.route_id INNER JOIN learning_nodes AS nodes ON nodes.id = progress.node_id LEFT JOIN learning_activities AS current_activity ON current_activity.id = progress.current_activity_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id WHERE progress.principal_id = $1 AND nodes.map_id = ANY($2) AND nodes.map_asset_id = assets.id AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL ORDER BY nodes.slug ASC, routes.slug ASC, progress.activity_start_id ASC",
    )
    .bind(principal_id)
    .bind(&loaded_world.map_ids)
    .fetch_all(pool)
    .await?;
    let available_routes = sqlx::query_as::<_, AvailableRouteRow>(
        "SELECT COUNT(activities.id) AS activity_count, routes.description, nodes.slug AS node_slug, routes.slug AS route_slug, routes.title FROM learning_routes AS routes INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id LEFT JOIN learning_activities AS activities ON activities.route_id = routes.id AND activities.published_at IS NOT NULL WHERE nodes.map_id = ANY($1) AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL GROUP BY routes.id, nodes.slug HAVING COUNT(activities.id) > 0 ORDER BY nodes.slug ASC, routes.position ASC, routes.slug ASC",
    )
    .bind(&loaded_world.map_ids)
    .fetch_all(pool)
    .await?;
    let start_routes = sqlx::query_as::<_, ActivityStartRow>(
        "SELECT activities.slug AS activity_slug, starts.button_border_color_dark, starts.button_border_color_light, starts.button_color_dark, starts.button_color_light, progress.completion_count, current_activity.slug AS current_activity_slug, starts.description, starts.image_dark, starts.image_light, COALESCE(starts.label, activities.title) AS label, to_char(progress.last_completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS last_completed_at, to_char(progress.last_entered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS last_entered_at, nodes.slug AS node_slug, routes.slug AS route_slug, starts.sort_order, starts.id AS start_id, progress.status FROM learning_activity_starts AS starts INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = starts.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id LEFT JOIN learner_route_progress AS progress ON progress.principal_id = $1 AND progress.activity_start_id = starts.id LEFT JOIN learning_activities AS current_activity ON current_activity.id = progress.current_activity_id WHERE nodes.map_id = ANY($2) AND nodes.map_asset_id = assets.id AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL ORDER BY nodes.slug ASC, starts.sort_order ASC, starts.id ASC",
    )
    .bind(principal_id)
    .bind(&loaded_world.map_ids)
    .fetch_all(pool)
    .await?;

    Ok(Some(LearnerWorldSnapshot {
        world: loaded_world.world,
        bookmarked_node_slugs,
        activity_progress: activity_progress
            .into_iter()
            .map(|row| LearnerActivityProgress {
                node_slug: row.node_slug,
                activity_slug: row.activity_slug,
                status: row.status,
                completed_at: row.completed_at,
            })
            .collect(),
        route_progress: route_progress
            .into_iter()
            .map(|row| LearnerRouteProgress {
                start_id: row.start_id.to_string(),
                node_slug: row.node_slug,
                route_slug: row.route_slug,
                current_activity_slug: row.current_activity_slug,
                status: row.status,
                completion_count: row.completion_count,
                last_completed_at: row.last_completed_at,
                last_entered_at: row.last_entered_at,
            })
            .collect(),
        available_routes: available_routes
            .into_iter()
            .map(|row| LearnerWorldRoute {
                node_slug: row.node_slug,
                route_slug: row.route_slug,
                title: row.title,
                description: row.description,
                activity_count: row.activity_count,
            })
            .collect(),
        start_routes: start_routes
            .into_iter()
            .map(|row| LearnerActivityStart {
                start_id: row.start_id.to_string(),
                node_slug: row.node_slug,
                route_slug: row.route_slug,
                activity_slug: row.activity_slug,
                label: row.label,
                description: row.description,
                image_dark: row.image_dark,
                image_light: row.image_light,
                button_color_dark: row.button_color_dark,
                button_border_color_dark: row.button_border_color_dark,
                button_color_light: row.button_color_light,
                button_border_color_light: row.button_border_color_light,
                sort_order: row.sort_order,
                progress: row.status.map(|status| LearnerActivityStartProgress {
                    current_activity_slug: row.current_activity_slug,
                    status,
                    completion_count: row.completion_count.unwrap_or_default(),
                    last_completed_at: row.last_completed_at,
                    last_entered_at: row.last_entered_at,
                }),
            })
            .collect(),
    }))
}
