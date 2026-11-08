use std::collections::HashSet;

use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_world::{
    LearnerWorldReadError, LearnerWorldRepository as LearnerWorldRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerActivityProgress, LearnerActivityStart, LearnerActivityStartDeskContext,
        LearnerActivityStartProgress, LearnerBookmark, LearnerItem, LearnerPathTopic,
        LearnerRouteProgress, LearnerTool, LearnerWorldRoute, LearnerWorldSnapshot,
    },
};

use crate::learner_media::learner_media_url;
use crate::learner_node_availability::PostgresLearnerNodeAvailability;
use crate::learner_paths::{learning_areas, learning_intent, time_guide_minutes};
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
    map_slug: String,
    node_slug: String,
    route_slug: String,
    title: String,
}

#[derive(FromRow)]
struct ActivityStartRow {
    activity_config: Value,
    activity_slug: String,
    activity_type: String,
    current_activity_config: Option<Value>,
    button_border_color_dark: Option<String>,
    button_border_color_light: Option<String>,
    button_color_dark: Option<String>,
    button_color_light: Option<String>,
    completion_count: Option<i32>,
    current_activity_slug: Option<String>,
    current_activity_type: Option<String>,
    current_activity_title: Option<String>,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    label: String,
    last_completed_at: Option<String>,
    last_entered_at: Option<String>,
    map_slug: String,
    node_slug: String,
    route_slug: String,
    sort_order: i16,
    start_id: Uuid,
    status: Option<String>,
    topic_slug: Option<String>,
    topic_title: Option<String>,
}

#[derive(FromRow)]
struct BookmarkRow {
    map_slug: String,
    node_slug: String,
}

#[derive(FromRow)]
struct ItemRow {
    config: Value,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    quantity: i32,
    slug: String,
    title: String,
}

#[derive(FromRow)]
struct ToolRow {
    animation_dark: Option<String>,
    animation_light: Option<String>,
    config: Value,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    slug: String,
    title: String,
}

async fn load_first_visible(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Option<LearnerWorldSnapshot>, sqlx::Error> {
    let Some(availability) = PostgresLearnerNodeAvailability::load(pool, principal).await? else {
        return Ok(None);
    };
    let Some(mut loaded_world) = load_visible_world(pool, &principal.roles).await? else {
        return Ok(None);
    };
    let principal_id = availability.principal_id();
    let playable_nodes = apply_learner_node_states(&mut loaded_world.world, &availability);
    let items = sqlx::query_as::<_, ItemRow>(
        "SELECT items.config, items.description, items.image_dark, items.image_light, holdings.quantity, items.slug, items.title FROM learner_item_holdings AS holdings INNER JOIN learning_items AS items ON items.id = holdings.item_id WHERE holdings.principal_id = $1 AND holdings.quantity > 0 ORDER BY holdings.acquired_at ASC NULLS LAST, items.slug ASC LIMIT 100",
    )
    .bind(principal_id)
    .fetch_all(pool)
    .await?;
    let tools = sqlx::query_as::<_, ToolRow>(
        "SELECT tools.animation_dark, tools.animation_light, tools.config, tools.description, tools.image_dark, tools.image_light, tools.slug, tools.title FROM learner_tools AS holdings INNER JOIN learning_tools AS tools ON tools.id = holdings.tool_id WHERE holdings.principal_id = $1 ORDER BY holdings.acquired_at ASC, tools.slug ASC LIMIT 100",
    )
    .bind(principal_id)
    .fetch_all(pool)
    .await?;

    let bookmarked_nodes = sqlx::query_as::<_, BookmarkRow>(
        "SELECT maps.slug AS map_slug, nodes.slug AS node_slug FROM learner_node_bookmarks AS bookmarks INNER JOIN learning_nodes AS nodes ON nodes.id = bookmarks.node_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE bookmarks.principal_id = $1 AND nodes.map_id = ANY($2) AND nodes.published_at IS NOT NULL AND nodes.state <> 'hidden' AND NOT (nodes.visual_config @> '{\"hideEmptySpace\": true}'::jsonb) ORDER BY bookmarks.created_at ASC, maps.slug ASC, nodes.slug ASC LIMIT 500",
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
        "SELECT COUNT(activities.id) AS activity_count, routes.description, maps.slug AS map_slug, nodes.slug AS node_slug, routes.slug AS route_slug, routes.title FROM learning_routes AS routes INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id LEFT JOIN learning_activities AS activities ON activities.route_id = routes.id AND activities.published_at IS NOT NULL WHERE nodes.map_id = ANY($1) AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL GROUP BY routes.id, maps.slug, nodes.slug HAVING COUNT(activities.id) > 0 ORDER BY nodes.slug ASC, routes.position ASC, routes.slug ASC",
    )
    .bind(&loaded_world.map_ids)
    .fetch_all(pool)
    .await?;
    let start_routes = sqlx::query_as::<_, ActivityStartRow>(
        "SELECT activities.activity_config, activities.slug AS activity_slug, activities.activity_type, current_activity.activity_config AS current_activity_config, starts.button_border_color_dark, starts.button_border_color_light, starts.button_color_dark, starts.button_color_light, progress.completion_count, current_activity.slug AS current_activity_slug, current_activity.activity_type AS current_activity_type, current_activity.title AS current_activity_title, starts.description, starts.image_dark, starts.image_light, COALESCE(starts.label, activities.title) AS label, to_char(progress.last_completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS last_completed_at, to_char(progress.last_entered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS last_entered_at, maps.slug AS map_slug, nodes.slug AS node_slug, routes.slug AS route_slug, starts.sort_order, starts.id AS start_id, progress.status, topics.slug AS topic_slug, topics.title AS topic_title FROM learning_activity_starts AS starts INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = starts.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id LEFT JOIN learning_topics AS topics ON topics.id = maps.topic_id AND topics.published_at IS NOT NULL LEFT JOIN learner_route_progress AS progress ON progress.principal_id = $1 AND progress.activity_start_id = starts.id LEFT JOIN learning_activities AS current_activity ON current_activity.id = progress.current_activity_id WHERE nodes.map_id = ANY($2) AND nodes.map_asset_id = assets.id AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice', 'question', 'reflection', 'review', 'tool_grant', 'item_grant', 'item_obstacle', 'obstacle', 'markdown', 'npc_dialogue', 'shared_task', 'portal') ORDER BY nodes.slug ASC, starts.sort_order ASC, starts.id ASC",
    )
    .bind(principal_id)
    .bind(&loaded_world.map_ids)
    .fetch_all(pool)
    .await?;

    Ok(Some(LearnerWorldSnapshot {
        world: loaded_world.world,
        items: items
            .into_iter()
            .map(|item| LearnerItem {
                config: item.config,
                description: item.description,
                image_dark: item.image_dark,
                image_light: item.image_light,
                quantity: item.quantity,
                slug: item.slug,
                title: item.title,
            })
            .collect(),
        tools: tools
            .into_iter()
            .map(|tool| LearnerTool {
                animation_dark: tool.animation_dark,
                animation_light: tool.animation_light,
                config: tool.config,
                description: tool.description,
                image_dark: tool.image_dark,
                image_light: tool.image_light,
                slug: tool.slug,
                title: tool.title,
            })
            .collect(),
        bookmarked_nodes: bookmarked_nodes
            .into_iter()
            .filter(|row| playable_nodes.contains(&(row.map_slug.clone(), row.node_slug.clone())))
            .map(|row| LearnerBookmark {
                map_slug: row.map_slug,
                node_slug: row.node_slug,
            })
            .collect(),
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
            .filter(|row| playable_nodes.contains(&(row.map_slug.clone(), row.node_slug.clone())))
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
            .filter(|row| playable_nodes.contains(&(row.map_slug.clone(), row.node_slug.clone())))
            .map(|row| {
                let desk = learner_desk_context(&row);

                LearnerActivityStart {
                    start_id: row.start_id.to_string(),
                    map_slug: row.map_slug,
                    node_slug: row.node_slug,
                    route_slug: row.route_slug,
                    activity_slug: row.activity_slug,
                    label: row.label,
                    description: row.description,
                    image_dark: row.image_dark.as_deref().map(learner_media_url),
                    image_light: row.image_light.as_deref().map(learner_media_url),
                    button_color_dark: row.button_color_dark,
                    button_border_color_dark: row.button_border_color_dark,
                    button_color_light: row.button_color_light,
                    button_border_color_light: row.button_border_color_light,
                    learning_intent: learning_intent(&row.activity_type, &row.activity_config),
                    sort_order: row.sort_order,
                    time_guide_minutes: time_guide_minutes(&row.activity_config),
                    desk,
                    progress: row.status.map(|status| LearnerActivityStartProgress {
                        current_activity_slug: row.current_activity_slug,
                        status,
                        completion_count: row.completion_count.unwrap_or_default(),
                        last_completed_at: row.last_completed_at,
                        last_entered_at: row.last_entered_at,
                    }),
                }
            })
            .collect(),
    }))
}

fn learner_desk_context(row: &ActivityStartRow) -> LearnerActivityStartDeskContext {
    let is_in_progress = row.status.as_deref() == Some("in_progress");
    let (activity_type, activity_config) = if is_in_progress {
        row.current_activity_type
            .as_deref()
            .zip(row.current_activity_config.as_ref())
            .unwrap_or((&row.activity_type, &row.activity_config))
    } else {
        (row.activity_type.as_str(), &row.activity_config)
    };

    LearnerActivityStartDeskContext {
        current_activity_title: is_in_progress
            .then(|| row.current_activity_title.clone())
            .flatten(),
        learning_areas: learning_areas(activity_config),
        learning_intent: learning_intent(activity_type, activity_config),
        time_guide_minutes: time_guide_minutes(activity_config),
        topic: row
            .topic_slug
            .clone()
            .zip(row.topic_title.clone())
            .map(|(slug, title)| LearnerPathTopic {
                href: format!("/topics/{slug}"),
                slug,
                title,
            }),
    }
}

fn apply_learner_node_states(
    world: &mut wicked_learning_domain::world_content::PublicWorld,
    availability: &PostgresLearnerNodeAvailability,
) -> HashSet<(String, String)> {
    let mut playable_nodes = HashSet::new();

    for map in &mut world.maps {
        for node in &mut map.nodes {
            let state = availability.state_for_node(node.id, &node.state, &node.visual_config);
            node.state = match state {
                wicked_learning_domain::learner_availability::LearnerNodeState::Available => {
                    "available".to_owned()
                }
                wicked_learning_domain::learner_availability::LearnerNodeState::Hidden => {
                    "hidden".to_owned()
                }
                wicked_learning_domain::learner_availability::LearnerNodeState::Locked => {
                    "locked".to_owned()
                }
            };
            if state.can_play() {
                playable_nodes.insert((map.slug.clone(), node.slug.clone()));
            }
        }
    }

    playable_nodes
}
