use std::collections::{HashMap, HashSet};

use serde_json::{Value, json};
use sqlx::{FromRow, PgConnection, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_world::{
    LearnerWorldReadError, LearnerWorldRepository as LearnerWorldRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerActivityProgress, LearnerActivityStart, LearnerActivityStartDeskContext,
        LearnerActivityStartProgress, LearnerBookmark, LearnerItem, LearnerPathTopic,
        LearnerRouteProgress, LearnerTool, LearnerWorldActivityOutline, LearnerWorldAssetIdentity,
        LearnerWorldGraph, LearnerWorldMapGraph, LearnerWorldNodeGraph, LearnerWorldRoute,
        LearnerWorldSnapshot, LearnerWorldStartIdentity,
    },
};

use crate::learner_media::learner_media_url;
use crate::learner_node_availability::PostgresLearnerNodeAvailability;
use crate::learner_node_availability::authored_node_state;
use crate::learner_paths::{learning_areas, learning_intent, time_guide_minutes};
use crate::learner_route_run::ROUTE_START_ACTIVITY_TYPES;
use crate::public_world::load_first_visible as load_visible_world;
use wicked_learning_domain::learner_availability::{
    LearnerNodeAvailabilityConfig, LearnerNodeState, LearnerNodeToolAction,
};
use wicked_learning_domain::learner_availability_presentation::{
    AvailabilityLabels, visual_config as evaluated_visual_config,
};

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
    node_id: Uuid,
    activity_id: Uuid,
    current_activity_id: Option<Uuid>,
    play_run_id: Option<Uuid>,
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
struct GraphActivityRow {
    node_id: Uuid,
    id: Uuid,
    slug: String,
    title: String,
    activity_type: String,
    status: Option<String>,
    preferred_start_id: Option<Uuid>,
    can_start: bool,
}

#[derive(FromRow)]
struct BookmarkRow {
    map_slug: String,
    node_slug: String,
}

#[derive(FromRow)]
struct ItemRow {
    id: Uuid,
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
    id: Uuid,
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
    let labels = availability_labels(pool, &loaded_world.world).await?;
    let playable_nodes = apply_learner_node_states(&mut loaded_world.world, &availability, &labels);
    let (items, tools) = load_inventory(pool, principal_id).await?;

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
        "SELECT nodes.id AS node_id, activities.id AS activity_id, current_activity.id AS current_activity_id, progress.current_play_run_id AS play_run_id, activities.activity_config, activities.slug AS activity_slug, activities.activity_type, current_activity.activity_config AS current_activity_config, starts.button_border_color_dark, starts.button_border_color_light, starts.button_color_dark, starts.button_color_light, progress.completion_count, current_activity.slug AS current_activity_slug, current_activity.activity_type AS current_activity_type, current_activity.title AS current_activity_title, starts.description, starts.image_dark, starts.image_light, COALESCE(starts.label, activities.title) AS label, to_char(progress.last_completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS last_completed_at, to_char(progress.last_entered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS last_entered_at, maps.slug AS map_slug, nodes.slug AS node_slug, routes.slug AS route_slug, starts.sort_order, starts.id AS start_id, progress.status, topics.slug AS topic_slug, topics.title AS topic_title FROM learning_activity_starts AS starts INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = starts.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id LEFT JOIN learning_topics AS topics ON topics.id = maps.topic_id AND topics.published_at IS NOT NULL LEFT JOIN learner_route_progress AS progress ON progress.principal_id = $1 AND progress.activity_start_id = starts.id LEFT JOIN learning_activities AS current_activity ON current_activity.id = progress.current_activity_id WHERE nodes.map_id = ANY($2) AND nodes.map_asset_id = assets.id AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type = ANY($3) ORDER BY nodes.slug ASC, starts.sort_order ASC, starts.id ASC",
    )
    .bind(principal_id)
    .bind(&loaded_world.map_ids)
    .bind(ROUTE_START_ACTIVITY_TYPES)
    .fetch_all(pool)
    .await?;

    let graph = load_graph(pool, principal_id, &loaded_world, &start_routes).await?;
    let visible_nodes: HashSet<Uuid> = loaded_world
        .world
        .maps
        .iter()
        .flat_map(|map| &map.nodes)
        .filter(|node| node.state != "hidden")
        .map(|node| node.id)
        .collect();
    Ok(Some(LearnerWorldSnapshot {
        graph,
        world: loaded_world.world,
        items,
        tools,
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
            .filter(|row| visible_nodes.contains(&row.node_id) && start_is_eligible(row))
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

fn start_is_eligible(row: &ActivityStartRow) -> bool {
    row.activity_type != "portal"
        || row
            .activity_config
            .get("portalMode")
            .and_then(Value::as_str)
            != Some("input")
}

async fn load_graph(
    pool: &PgPool,
    principal_id: Uuid,
    loaded: &crate::public_world::LoadedWorld,
    starts: &[ActivityStartRow],
) -> Result<LearnerWorldGraph, sqlx::Error> {
    let readable_node_ids: Vec<Uuid> = loaded
        .world
        .maps
        .iter()
        .flat_map(|map| &map.nodes)
        .filter(|node| node.state != "hidden")
        .map(|node| node.id)
        .collect();
    // One batched query includes non-start activities and scopes progress by
    // principal. An oversized graph fails rather than silently losing badges.
    let rows = sqlx::query_as::<_, GraphActivityRow>(
        "SELECT nodes.id AS node_id, activities.id, activities.slug, activities.title, \
         activities.activity_type, progress.status, nodes.start_activity_id AS preferred_start_id, \
         (activities.activity_type <> 'portal' OR COALESCE(activities.activity_config->>'portalMode', 'output') <> 'input') AS can_start \
         FROM learning_nodes AS nodes \
         INNER JOIN learning_map_assets AS assets ON assets.id = nodes.map_asset_id \
         INNER JOIN learning_routes AS routes ON routes.map_asset_id = assets.id \
         INNER JOIN learning_activities AS activities ON activities.route_id = routes.id \
         LEFT JOIN learner_activity_progress AS progress ON progress.activity_id = activities.id AND progress.principal_id = $1 \
         WHERE nodes.id = ANY($2) AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL \
         AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL \
         ORDER BY nodes.id, routes.position, routes.id, activities.position, activities.id LIMIT 10001",
    ).bind(principal_id).bind(&readable_node_ids).fetch_all(pool).await?;
    if rows.len() > 10_000 {
        return Err(sqlx::Error::Protocol(
            "World activity outline exceeds its bound".to_owned(),
        ));
    }
    let mut activities_by_node: HashMap<Uuid, Vec<GraphActivityRow>> = HashMap::new();
    for row in rows {
        activities_by_node.entry(row.node_id).or_default().push(row);
    }
    let mut starts_by_node: HashMap<Uuid, Vec<&ActivityStartRow>> = HashMap::new();
    for start in starts.iter().filter(|row| start_is_eligible(row)) {
        starts_by_node.entry(start.node_id).or_default().push(start);
    }
    let maps = loaded
        .world
        .maps
        .iter()
        .zip(&loaded.map_ids)
        .map(|(map, map_id)| {
            let assets = map
                .assets
                .iter()
                .map(|asset| {
                    let id = loaded
                        .asset_ids
                        .get(map_id)
                        .and_then(|ids| ids.get(&asset.slug))
                        .copied()
                        .ok_or(sqlx::Error::RowNotFound)?;
                    Ok(LearnerWorldAssetIdentity {
                        id,
                        slug: asset.slug.clone(),
                    })
                })
                .collect::<Result<Vec<_>, sqlx::Error>>()?;
            let nodes = map
                .nodes
                .iter()
                .map(|node| {
                    let activities = activities_by_node.remove(&node.id).unwrap_or_default();
                    let activity_ids: HashSet<Uuid> = activities.iter().map(|row| row.id).collect();
                    let start_activity_id = preferred_graph_start(&activities);
                    let starts = starts_by_node
                        .remove(&node.id)
                        .unwrap_or_default()
                        .into_iter()
                        .filter(|start| activity_ids.contains(&start.activity_id))
                        .map(|start| LearnerWorldStartIdentity {
                            id: start.start_id,
                            activity_id: start.activity_id,
                            current_activity_id: start
                                .current_activity_id
                                .filter(|id| activity_ids.contains(id)),
                            play_run_id: start.play_run_id,
                        })
                        .collect();
                    LearnerWorldNodeGraph {
                        id: node.id,
                        slug: node.slug.clone(),
                        start_activity_id,
                        activities: activities
                            .into_iter()
                            .map(|row| LearnerWorldActivityOutline {
                                id: row.id,
                                slug: row.slug,
                                title: row.title,
                                activity_type: row.activity_type,
                                status: row.status,
                            })
                            .collect(),
                        starts,
                    }
                })
                .collect();
            Ok(LearnerWorldMapGraph {
                id: *map_id,
                slug: map.slug.clone(),
                assets,
                nodes,
            })
        })
        .collect::<Result<Vec<_>, sqlx::Error>>()?;
    Ok(LearnerWorldGraph {
        id: loaded.world_id,
        maps,
    })
}

fn preferred_graph_start(activities: &[GraphActivityRow]) -> Option<Uuid> {
    activities
        .iter()
        .find(|row| row.can_start && Some(row.id) == row.preferred_start_id)
        .map(|row| row.id)
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

/// At most three catalog reads for the complete World, never per-node queries.
async fn availability_labels(
    pool: &PgPool,
    world: &wicked_learning_domain::world_content::PublicWorld,
) -> Result<AvailabilityLabels, sqlx::Error> {
    let mut labels = AvailabilityLabels::default();
    let mut tool_refs = HashSet::new();
    let mut item_refs = HashSet::new();
    let mut role_refs = HashSet::new();
    for map in &world.maps {
        for node in &map.nodes {
            labels.nodes.insert(
                node.id.to_string(),
                json!({"mapSlug":map.slug,"nodeSlug":node.slug,"nodeTitle":node.title}),
            );
            collect_catalog_references(
                &node.state,
                &node.visual_config,
                &mut tool_refs,
                &mut item_refs,
                &mut role_refs,
            );
        }
    }
    let mut connection = pool.acquire().await?;
    load_catalog_labels(
        &mut connection,
        &mut labels,
        tool_refs,
        item_refs,
        role_refs,
    )
    .await?;
    Ok(labels)
}

pub(crate) fn collect_catalog_references(
    state: &str,
    visual_config: &Value,
    tool_refs: &mut HashSet<String>,
    item_refs: &mut HashSet<String>,
    role_refs: &mut HashSet<String>,
) {
    let config = LearnerNodeAvailabilityConfig::from_visual_config(visual_config);
    if let Some(action) = config.tool_action(authored_node_state(state)) {
        match action {
            LearnerNodeToolAction::Reveal { tool_reference }
            | LearnerNodeToolAction::Unlock { tool_reference } => {
                tool_refs.insert(tool_reference);
            }
        }
    }
    if let Some(reference) = config.unlock.legacy_item_reference {
        item_refs.insert(reference);
    }
    if let Some(reference) = config.unlock.legacy_role_slug {
        role_refs.insert(reference);
    }
}

pub(crate) async fn load_catalog_labels(
    connection: &mut PgConnection,
    labels: &mut AvailabilityLabels,
    tool_refs: HashSet<String>,
    item_refs: HashSet<String>,
    role_refs: HashSet<String>,
) -> Result<(), sqlx::Error> {
    if !tool_refs.is_empty() {
        labels.tools = sqlx::query_as::<_, (String, String)>(
            "SELECT slug, title FROM learning_tools WHERE slug = ANY($1)",
        )
        .bind(tool_refs.into_iter().collect::<Vec<_>>())
        .fetch_all(&mut *connection)
        .await?
        .into_iter()
        .collect();
    }
    if !item_refs.is_empty() {
        labels.items = sqlx::query_as::<_, (String, String)>(
            "SELECT slug, title FROM learning_items WHERE slug = ANY($1)",
        )
        .bind(item_refs.into_iter().collect::<Vec<_>>())
        .fetch_all(&mut *connection)
        .await?
        .into_iter()
        .collect();
    }
    if !role_refs.is_empty() {
        labels.roles = sqlx::query_as::<_, (String, String)>(
            "SELECT role_key, name FROM application_roles WHERE role_key = ANY($1)",
        )
        .bind(role_refs.into_iter().collect::<Vec<_>>())
        .fetch_all(&mut *connection)
        .await?
        .into_iter()
        .collect();
    }
    Ok(())
}

fn apply_learner_node_states(
    world: &mut wicked_learning_domain::world_content::PublicWorld,
    availability: &PostgresLearnerNodeAvailability,
    labels: &AvailabilityLabels,
) -> HashSet<(String, String)> {
    let mut playable_nodes = HashSet::new();

    for map in &mut world.maps {
        for node in &mut map.nodes {
            let state = availability.state_for_node(node.id, &node.state, &node.visual_config);
            let authored = authored_node_state(&node.state);
            node.visual_config = evaluated_visual_config(
                authored,
                state,
                &node.visual_config,
                &availability.facts_for_node(node.id, &node.visual_config),
                labels,
            );
            if state == LearnerNodeState::Hidden {
                node.title = "Undiscovered place".into();
                node.description.clear();
            }
            node.state = match state {
                LearnerNodeState::Available if authored == LearnerNodeState::Available => {
                    node.state.clone()
                }
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

pub(crate) async fn load_inventory(
    pool: &PgPool,
    principal_id: Uuid,
) -> Result<(Vec<LearnerItem>, Vec<LearnerTool>), sqlx::Error> {
    let items = sqlx::query_as::<_, ItemRow>(
        "SELECT items.id, items.config, items.description, items.image_dark, items.image_light, holdings.quantity, items.slug, items.title FROM learner_item_holdings AS holdings INNER JOIN learning_items AS items ON items.id = holdings.item_id WHERE holdings.principal_id = $1 AND holdings.quantity > 0 ORDER BY holdings.acquired_at ASC NULLS LAST, items.slug ASC LIMIT 101",
    )
    .bind(principal_id)
    .fetch_all(pool)
    .await?;
    let tools = sqlx::query_as::<_, ToolRow>(
        "SELECT tools.id, tools.animation_dark, tools.animation_light, tools.config, tools.description, tools.image_dark, tools.image_light, tools.slug, tools.title FROM learner_tools AS holdings INNER JOIN learning_tools AS tools ON tools.id = holdings.tool_id WHERE holdings.principal_id = $1 ORDER BY holdings.acquired_at ASC, tools.slug ASC LIMIT 101",
    )
    .bind(principal_id)
    .fetch_all(pool)
    .await?;

    if items.len() > 100 || tools.len() > 100 {
        return Err(sqlx::Error::Protocol(
            "Learner inventory exceeds its bound".into(),
        ));
    }
    Ok((
        items
            .into_iter()
            .map(|item| {
                crate::learner_media::learner_item(LearnerItem {
                    id: item.id,
                    config: item.config,
                    description: item.description,
                    image_dark: item.image_dark,
                    image_light: item.image_light,
                    quantity: item.quantity,
                    slug: item.slug,
                    title: item.title,
                })
            })
            .collect(),
        tools
            .into_iter()
            .map(|tool| {
                crate::learner_media::learner_tool(LearnerTool {
                    id: tool.id,
                    animation_dark: tool.animation_dark,
                    animation_light: tool.animation_light,
                    config: tool.config,
                    description: tool.description,
                    image_dark: tool.image_dark,
                    image_light: tool.image_light,
                    slug: tool.slug,
                    title: tool.title,
                })
            })
            .collect(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::public_world::LoadedWorld;
    use serde_json::json;
    use wicked_learning_domain::world_content::{PublicMap, PublicNode, PublicWorld};

    #[tokio::test]
    #[ignore = "requires TEST_APPLICATION_DATABASE_URL pointing to the migrated local test stack"]
    async fn evaluated_source_world_availability_tracks_native_tools_and_principal_isolation() {
        use crate::learner_node_tool::PostgresLearnerNodeToolRepository;
        use wicked_learning_application::learner_node_tool::{
            LearnerNodeToolRepository, LearnerNodeToolTarget,
        };
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .idle_timeout(None)
            .max_lifetime(None)
            .connect(&std::env::var("TEST_APPLICATION_DATABASE_URL").unwrap())
            .await
            .unwrap();
        for table in [
            "application_principals",
            "learning_nodes",
            "learning_maps",
            "learning_tools",
            "learner_tools",
            "learner_node_tool_uses",
            "learner_node_discoveries",
            "learner_node_manual_unlocks",
            "learning_items",
            "learner_item_holdings",
            "application_roles",
            "learning_activities",
            "learning_routes",
            "learning_map_assets",
            "learner_activity_progress",
        ] {
            sqlx::query(&format!(
                "CREATE TEMP TABLE {table} AS SELECT * FROM public.{table} WITH NO DATA"
            ))
            .execute(&pool)
            .await
            .unwrap();
        }
        sqlx::query("CREATE UNIQUE INDEX ON learner_node_discoveries (principal_id, node_id)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            "CREATE UNIQUE INDEX ON learner_node_tool_uses (principal_id, node_id, tool_id)",
        )
        .execute(&pool)
        .await
        .unwrap();
        let owner = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".into()],
            capabilities: vec![],
        };
        let peer = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            ..owner.clone()
        };
        let owner_id = Uuid::new_v4();
        let peer_id = Uuid::new_v4();
        let map_id = Uuid::new_v4();
        let tool_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO application_principals (id, identity_subject_id) VALUES ($1,$2),($3,$4)",
        )
        .bind(owner_id)
        .bind(owner.subject_id)
        .bind(peer_id)
        .bind(peer.subject_id)
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("INSERT INTO learning_maps (id,slug,published_at,access_roles) VALUES ($1,'tool-map',NOW(),'[\"public\"]')")
            .bind(map_id).execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO learning_tools (id,slug,title) VALUES ($1,'lens','Source lens')")
            .bind(tool_id)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO learner_tools (principal_id,tool_id) VALUES ($1,$2)")
            .bind(owner_id)
            .bind(tool_id)
            .execute(&pool)
            .await
            .unwrap();
        let mut nodes = vec![];
        for (slug, state, config) in [
            (
                "concealed",
                "hidden",
                json!({"label":"Secret label","reveal":{"enabled":true,"toolId":"lens"}}),
            ),
            (
                "locked",
                "locked",
                json!({"unlock":{"tool":{"enabled":true,"toolId":"lens"}}}),
            ),
            (
                "scheduled",
                "locked",
                json!({"unlock":{"enabled":true,"tool":{"enabled":true,"toolId":"lens"}},"schedule":{"unlockAt":"2099-01-01T00:00:00Z"}}),
            ),
            ("active", "active", json!({})),
            ("completed", "completed", json!({})),
            ("hinted", "hinted", json!({})),
            ("recommended", "recommended", json!({})),
            (
                "scheduled-recommended",
                "recommended",
                json!({"schedule":{"lockAt":"2000-01-01T00:00:00Z"}}),
            ),
        ] {
            let id = Uuid::new_v4();
            sqlx::query("INSERT INTO learning_nodes (id,map_id,slug,state,visual_config,published_at) VALUES ($1,$2,$3,$4,$5,NOW())")
                .bind(id).bind(map_id).bind(slug).bind(state).bind(&config).execute(&pool).await.unwrap();
            nodes.push(PublicNode {
                id,
                asset_slug: None,
                slug: slug.into(),
                title: format!("Source {slug}"),
                description: "Private description".into(),
                q: 0,
                r: 0,
                state: state.into(),
                visual_config: config,
            });
        }
        let world = PublicWorld {
            slug: "world".into(),
            title: "World".into(),
            description: String::new(),
            theme_config: json!({}),
            maps: vec![PublicMap {
                slug: "tool-map".into(),
                title: "Map".into(),
                description: String::new(),
                topic: None,
                background_config: json!({}),
                grid_config: json!({}),
                map_assets_locked: false,
                assets: vec![],
                nodes,
            }],
        };
        let labels = availability_labels(&pool, &world).await.unwrap();
        let availability = PostgresLearnerNodeAvailability::load(&pool, &owner)
            .await
            .unwrap()
            .unwrap();
        let mut before = world.clone();
        let playable = apply_learner_node_states(&mut before, &availability, &labels);
        for node in &before.maps[0].nodes[3..7] {
            assert_eq!(node.state, node.slug);
            assert!(playable.contains(&("tool-map".into(), node.slug.clone())));
        }
        assert_eq!(before.maps[0].nodes[7].state, "locked");
        assert!(!playable.contains(&("tool-map".into(), "scheduled-recommended".into())));
        assert_eq!(before.maps[0].nodes[0].title, "Undiscovered place");
        assert!(before.maps[0].nodes[0].description.is_empty());
        assert!(before.maps[0].nodes[0].visual_config.get("label").is_none());
        assert_eq!(
            before.maps[0].nodes[1].visual_config["unlock"]["isToolUnlockable"],
            true
        );
        assert_eq!(
            before.maps[0].nodes[1].visual_config["unlock"]["requirements"]["requirements"][0]["toolTitle"],
            "Source lens"
        );
        let repository = PostgresLearnerNodeToolRepository::new(&pool);
        for slug in ["concealed", "locked", "scheduled"] {
            let target = LearnerNodeToolTarget::parse("tool-map", slug, "lens").unwrap();
            assert!(repository.use_tool(&peer, &target).await.unwrap().is_none());
            let result = repository.use_tool(&owner, &target).await.unwrap().unwrap();
            assert!(result.is_useful);
            assert_eq!(result.is_unlocked, slug != "scheduled");
        }
        let mut after = world.clone();
        apply_learner_node_states(
            &mut after,
            &PostgresLearnerNodeAvailability::load(&pool, &owner)
                .await
                .unwrap()
                .unwrap(),
            &labels,
        );
        assert_eq!(after.maps[0].nodes[0].title, "Source concealed");
        assert_eq!(after.maps[0].nodes[0].state, "available");
        assert_eq!(
            after.maps[0].nodes[0].visual_config["reveal"]["isDiscovered"],
            true
        );
        assert_eq!(
            after.maps[0].nodes[1].visual_config["unlock"]["isUnlocked"],
            true
        );
        assert_eq!(after.maps[0].nodes[2].state, "locked");
        assert_eq!(
            after.maps[0].nodes[2].visual_config["unlock"]["toolUsed"],
            true
        );
        let mut peer_world = world.clone();
        apply_learner_node_states(
            &mut peer_world,
            &PostgresLearnerNodeAvailability::load(&pool, &peer)
                .await
                .unwrap()
                .unwrap(),
            &labels,
        );
        assert_eq!(peer_world.maps[0].nodes[0].state, "hidden");
        for node in &peer_world.maps[0].nodes[3..7] {
            assert_eq!(node.state, node.slug);
        }
        assert_eq!(
            peer_world.maps[0].nodes[1].visual_config["unlock"]["toolUsed"],
            false
        );
        pool.close().await;
    }

    #[test]
    fn preferred_start_requires_an_eligible_published_outline() {
        let id = Uuid::new_v4();
        let mut row = GraphActivityRow {
            node_id: Uuid::new_v4(),
            id,
            slug: "activity".into(),
            title: "Activity".into(),
            activity_type: "portal".into(),
            status: None,
            preferred_start_id: Some(id),
            can_start: false,
        };
        assert_eq!(preferred_graph_start(&[]), None);
        assert_eq!(preferred_graph_start(std::slice::from_ref(&row)), None);
        row.can_start = true;
        assert_eq!(preferred_graph_start(std::slice::from_ref(&row)), Some(id));
        row.preferred_start_id = Some(Uuid::new_v4());
        assert_eq!(preferred_graph_start(&[row]), None);
    }

    // Temporary copies use the real migrated column types. Every fixture write
    // is connection-local and disappears on close; no application rows change.
    #[tokio::test]
    #[ignore = "requires TEST_APPLICATION_DATABASE_URL pointing to the migrated local test stack"]
    async fn graph_outlines_preserve_identity_publication_visibility_and_private_progress() {
        let url = std::env::var("TEST_APPLICATION_DATABASE_URL").expect("test database URL");
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .idle_timeout(None)
            .max_lifetime(None)
            .connect(&url)
            .await
            .unwrap();
        for table in [
            "learning_nodes",
            "learning_map_assets",
            "learning_routes",
            "learning_activities",
            "learner_activity_progress",
        ] {
            sqlx::query(&format!(
                "CREATE TEMP TABLE {table} AS SELECT * FROM public.{table} WITH NO DATA"
            ))
            .execute(&pool)
            .await
            .unwrap();
        }
        let principal = Uuid::new_v4();
        let peer = Uuid::new_v4();
        let mut maps = Vec::new();
        let mut map_ids = Vec::new();
        let mut expected = Vec::new();
        for state in ["available", "locked", "hidden"] {
            let map_id = Uuid::new_v4();
            let node_id = Uuid::new_v4();
            let asset_id = Uuid::new_v4();
            let route_id = Uuid::new_v4();
            let first_id = Uuid::new_v4();
            let non_start_id = Uuid::new_v4();
            sqlx::query("INSERT INTO learning_map_assets (id, published_at) VALUES ($1, NOW())")
                .bind(asset_id)
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query("INSERT INTO learning_nodes (id, map_asset_id, start_activity_id, published_at) VALUES ($1, $2, $3, NOW())")
                .bind(node_id).bind(asset_id).bind(non_start_id).execute(&pool).await.unwrap();
            sqlx::query("INSERT INTO learning_routes (id, map_asset_id, published_at) VALUES ($1, $2, NOW())")
                .bind(route_id).bind(asset_id).execute(&pool).await.unwrap();
            for (id, title, published) in [
                (first_id, "First", true),
                (non_start_id, "Without a button", true),
                (Uuid::new_v4(), "Draft secret", false),
            ] {
                sqlx::query("INSERT INTO learning_activities (id, route_id, slug, title, activity_type, activity_config, published_at) VALUES ($1, $2, $3, $4, 'markdown', '{\"answer\":\"private content\"}', CASE WHEN $5 THEN NOW() END)")
                    .bind(id).bind(route_id).bind(title).bind(title).bind(published).execute(&pool).await.unwrap();
            }
            sqlx::query("INSERT INTO learner_activity_progress (principal_id, activity_id, status) VALUES ($1, $2, 'completed'), ($3, $4, 'completed')")
                .bind(principal).bind(non_start_id).bind(peer).bind(first_id).execute(&pool).await.unwrap();
            map_ids.push(map_id);
            expected.push((node_id, first_id, non_start_id));
            maps.push(PublicMap {
                slug: state.into(),
                title: state.into(),
                description: String::new(),
                topic: None,
                background_config: json!({}),
                grid_config: json!({}),
                map_assets_locked: false,
                assets: vec![],
                nodes: vec![PublicNode {
                    id: node_id,
                    asset_slug: None,
                    slug: "same-node-slug".into(),
                    title: "Place".into(),
                    description: String::new(),
                    q: 0,
                    r: 0,
                    state: state.into(),
                    visual_config: json!({}),
                }],
            });
        }
        let loaded = LoadedWorld {
            world_id: Uuid::new_v4(),
            map_ids,
            asset_ids: HashMap::new(),
            world: PublicWorld {
                slug: "world".into(),
                title: "World".into(),
                description: String::new(),
                theme_config: json!({}),
                maps,
            },
        };
        let graph = load_graph(&pool, principal, &loaded, &[]).await.unwrap();
        assert_eq!(graph.id, loaded.world_id);
        for (index, (node_id, first, non_start)) in expected.iter().enumerate() {
            let map = &graph.maps[index];
            let node = &map.nodes[0];
            assert_eq!(map.id, loaded.map_ids[index]);
            assert_eq!(node.id, *node_id);
            if index == 2 {
                assert!(node.activities.is_empty());
                assert!(node.starts.is_empty());
                assert_eq!(node.start_activity_id, None);
            } else {
                assert_eq!(node.start_activity_id, Some(*non_start));
                assert_eq!(node.activities.len(), 2);
                assert_eq!(
                    node.activities
                        .iter()
                        .find(|row| row.id == *first)
                        .unwrap()
                        .status,
                    None
                );
                assert_eq!(
                    node.activities
                        .iter()
                        .find(|row| row.id == *non_start)
                        .unwrap()
                        .status
                        .as_deref(),
                    Some("completed")
                );
            }
        }
        let serialized = serde_json::to_string(&graph).unwrap();
        assert!(!serialized.contains("Draft secret"));
        assert!(!serialized.contains("private content"));
        assert!(!serialized.contains("activity_config"));
        assert!(
            serde_json::to_value(&loaded.world).unwrap()["maps"][0]["nodes"][0]
                .get("id")
                .is_none()
        );
        pool.close().await;
    }
}
