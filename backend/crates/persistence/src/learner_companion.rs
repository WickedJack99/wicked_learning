use std::collections::HashMap;

use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::{
    admin_learning_companion_dialogue::parse_dialogue_graph,
    learner_companion::{
        LearnerCompanionError, LearnerCompanionRepository, LearnerCompanionRequest,
        LearnerCompanionSurface,
    },
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learning_companion::{
        LearnerCompanion, LearnerCompanionAction, LearnerCompanionConfiguration,
        LearnerCompanionContext, LearnerCompanionReference,
    },
};

use crate::learner_node_availability::PostgresLearnerNodeAvailability;

pub struct PostgresLearnerCompanionRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerCompanionRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl LearnerCompanionRepository for PostgresLearnerCompanionRepository<'_> {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerCompanionRequest,
    ) -> impl std::future::Future<Output = Result<Option<LearnerCompanion>, LearnerCompanionError>> + Send
    {
        async move { load(self.pool, principal, request).await }
    }
}

#[derive(FromRow)]
struct SettingsRow {
    ai_enabled: bool,
    avatar_color: String,
    avatar_position_x: i16,
    avatar_position_y: i16,
    avatar_scale: i16,
    avatar_url: Option<String>,
    display_name: String,
    enabled: bool,
    mode: String,
    welcome_message: String,
}

#[derive(FromRow)]
struct ScopeRow {
    activity_id: Option<Uuid>,
    activity_title: Option<String>,
    map_id: Uuid,
    map_slug: String,
    map_title: String,
    node_id: Option<Uuid>,
    node_slug: Option<String>,
    node_title: Option<String>,
    node_visual_config: Option<Value>,
    node_state: Option<String>,
    topic_id: Option<Uuid>,
    topic_title: Option<String>,
    world_id: Uuid,
    world_title: String,
}

#[derive(FromRow)]
struct AssignedGraphRow {
    dialogue_graph: Value,
    scope_type: String,
}

async fn load(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    request: &LearnerCompanionRequest,
) -> Result<Option<LearnerCompanion>, LearnerCompanionError> {
    let settings = sqlx::query_as::<_, SettingsRow>(
        "SELECT enabled, display_name, avatar_url, avatar_color, avatar_position_x, avatar_position_y, avatar_scale, welcome_message, mode, ai_enabled FROM learning_companion_settings WHERE singleton = TRUE",
    )
    .fetch_one(pool)
    .await
    .map_err(unavailable)?;
    if !settings.enabled {
        return Ok(None);
    }

    let scope = match request.surface {
        LearnerCompanionSurface::Desk => None,
        LearnerCompanionSurface::World => {
            visible_map_scope(pool, principal, request.map_slug.as_deref()).await?
        }
        LearnerCompanionSurface::Activity => {
            visible_activity_scope(
                pool,
                principal,
                request.activity_id.expect("validated activity request"),
            )
            .await?
        }
    };
    if matches!(
        request.surface,
        LearnerCompanionSurface::World | LearnerCompanionSurface::Activity
    ) && scope.is_none()
    {
        return Ok(None);
    }
    if let Some(scope) = scope.as_ref()
        && let (Some(node_id), Some(node_state), Some(node_visual_config)) = (
            scope.node_id,
            scope.node_state.as_deref(),
            scope.node_visual_config.as_ref(),
        )
    {
        let Some(availability) = PostgresLearnerNodeAvailability::load(pool, principal)
            .await
            .map_err(unavailable)?
        else {
            return Ok(None);
        };
        if !availability
            .state_for_node(node_id, node_state, node_visual_config)
            .can_play()
        {
            return Ok(None);
        }
    }

    let (dialogue, source_scope) = assigned_dialogue(pool, scope.as_ref()).await?;
    Ok(Some(LearnerCompanion {
        avatar_color: settings.avatar_color,
        avatar_position_x: settings.avatar_position_x,
        avatar_position_y: settings.avatar_position_y,
        avatar_scale: settings.avatar_scale,
        avatar_url: settings.avatar_url,
        configuration: LearnerCompanionConfiguration {
            ai_enabled: settings.ai_enabled
                && matches!(settings.mode.as_str(), "guided_ai" | "open_ai"),
            mode: settings.mode,
            source_scope,
        },
        context: context(request.surface, scope.as_ref()),
        dialogue,
        display_name: settings.display_name,
        message: settings.welcome_message,
    }))
}

async fn visible_map_scope(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    requested_map_slug: Option<&str>,
) -> Result<Option<ScopeRow>, LearnerCompanionError> {
    sqlx::query_as::<_, ScopeRow>(
        "SELECT worlds.id AS world_id, worlds.title AS world_title, maps.id AS map_id, maps.slug AS map_slug, maps.title AS map_title, NULL::UUID AS node_id, NULL::TEXT AS node_slug, NULL::TEXT AS node_title, NULL::JSONB AS node_visual_config, NULL::TEXT AS node_state, topics.id AS topic_id, topics.title AS topic_title, NULL::UUID AS activity_id, NULL::TEXT AS activity_title FROM learning_worlds AS worlds INNER JOIN learning_maps AS maps ON maps.world_id = worlds.id LEFT JOIN learning_topics AS topics ON topics.id = maps.topic_id AND topics.published_at IS NOT NULL WHERE worlds.published_at IS NOT NULL AND maps.published_at IS NOT NULL AND ($1::TEXT IS NULL OR maps.slug = $1) AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) ORDER BY worlds.published_at ASC, worlds.slug ASC, maps.position ASC, maps.slug ASC LIMIT 1",
    )
    .bind(requested_map_slug)
    .bind(&principal.roles)
    .fetch_optional(pool)
    .await
    .map_err(unavailable)
}

async fn visible_activity_scope(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
) -> Result<Option<ScopeRow>, LearnerCompanionError> {
    sqlx::query_as::<_, ScopeRow>(
        "SELECT worlds.id AS world_id, worlds.title AS world_title, maps.id AS map_id, maps.slug AS map_slug, maps.title AS map_title, nodes.id AS node_id, nodes.slug AS node_slug, nodes.title AS node_title, nodes.visual_config AS node_visual_config, nodes.state AS node_state, topics.id AS topic_id, topics.title AS topic_title, activities.id AS activity_id, activities.title AS activity_title FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id LEFT JOIN learning_topics AS topics ON topics.id = maps.topic_id AND topics.published_at IS NOT NULL WHERE activities.id = $1 AND worlds.published_at IS NOT NULL AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) LIMIT 1",
    )
    .bind(activity_id)
    .bind(&principal.roles)
    .fetch_optional(pool)
    .await
    .map_err(unavailable)
}

async fn assigned_dialogue(
    pool: &PgPool,
    scope: Option<&ScopeRow>,
) -> Result<(Option<Value>, String), LearnerCompanionError> {
    let Some(scope) = scope else {
        return Ok((None, "platform".to_owned()));
    };
    let mut scope_ids = vec![scope.world_id, scope.map_id];
    let mut scope_types = vec!["world".to_owned(), "map".to_owned()];
    if let Some(node_id) = scope.node_id {
        scope_ids.push(node_id);
        scope_types.push("node".to_owned());
    }
    if let Some(activity_id) = scope.activity_id {
        scope_ids.push(activity_id);
        scope_types.push("activity".to_owned());
    }
    let assignments = sqlx::query_as::<_, AssignedGraphRow>(
        "SELECT assignments.scope_type, dialogues.dialogue_graph FROM learning_companion_dialogue_assignments AS assignments INNER JOIN learning_companion_dialogues AS dialogues ON dialogues.id = assignments.dialogue_id WHERE assignments.scope_id = ANY($1) AND assignments.scope_type = ANY($2) ORDER BY assignments.created_at ASC, assignments.id ASC",
    )
    .bind(&scope_ids)
    .bind(&scope_types)
    .fetch_all(pool)
    .await
    .map_err(unavailable)?;
    let graphs = assignments
        .into_iter()
        .map(|assignment| (assignment.scope_type, assignment.dialogue_graph))
        .collect::<HashMap<_, _>>();
    for scope_type in ["activity", "node", "map", "world"] {
        if let Some(graph) = graphs.get(scope_type).and_then(parse_dialogue_graph) {
            return Ok((Some(graph), scope_type.to_owned()));
        }
    }
    Ok((None, "platform".to_owned()))
}

fn context(surface: LearnerCompanionSurface, scope: Option<&ScopeRow>) -> LearnerCompanionContext {
    match surface {
        LearnerCompanionSurface::Desk => LearnerCompanionContext {
            actions: vec![
                action(
                    "topics",
                    "Explore topics",
                    "/topics",
                    "Browse learning areas and choose where to go next.",
                ),
                action(
                    "current-map",
                    "Open current map",
                    "/world",
                    "Return to the map and continue exploring.",
                ),
            ],
            activity: None,
            map: None,
            node: None,
            play_run_id: None,
            post_attempt_available: false,
            route: None,
            surface: surface.as_str().to_owned(),
            topic: None,
            world: None,
        },
        LearnerCompanionSurface::World => {
            let scope = scope.expect("a visible world request has scope");
            LearnerCompanionContext {
                actions: vec![
                    action(
                        "learning-desk",
                        "Open learning desk",
                        "/home",
                        "Review recent learning and choose what to revisit.",
                    ),
                    action(
                        "current-map",
                        "Stay on this map",
                        &format!("/world?map={}", scope.map_slug),
                        "Continue exploring the current learning space.",
                    ),
                ],
                activity: None,
                map: Some(reference(scope.map_id, &scope.map_title)),
                node: None,
                play_run_id: None,
                post_attempt_available: false,
                route: None,
                surface: surface.as_str().to_owned(),
                topic: scope
                    .topic_id
                    .zip(scope.topic_title.as_deref())
                    .map(|(id, title)| reference(id, title)),
                world: Some(reference(scope.world_id, &scope.world_title)),
            }
        }
        LearnerCompanionSurface::Activity => {
            let scope = scope.expect("a visible activity request has scope");
            LearnerCompanionContext {
                actions: vec![
                    action(
                        "current-map",
                        "Return to the map",
                        &format!(
                            "/world?map={}&focused={}",
                            scope.map_slug,
                            scope
                                .node_slug
                                .as_deref()
                                .expect("activity scope node slug")
                        ),
                        "Step back and choose another place when that feels useful.",
                    ),
                    action(
                        "learning-desk",
                        "Open learning desk",
                        "/home",
                        "See your recent learning moments and available directions.",
                    ),
                ],
                activity: scope
                    .activity_id
                    .zip(scope.activity_title.as_deref())
                    .map(|(id, title)| reference(id, title)),
                map: Some(reference(scope.map_id, &scope.map_title)),
                node: scope
                    .node_id
                    .zip(scope.node_title.as_deref())
                    .map(|(id, title)| reference(id, title)),
                play_run_id: None,
                post_attempt_available: false,
                route: None,
                surface: surface.as_str().to_owned(),
                topic: scope
                    .topic_id
                    .zip(scope.topic_title.as_deref())
                    .map(|(id, title)| reference(id, title)),
                world: Some(reference(scope.world_id, &scope.world_title)),
            }
        }
    }
}

fn action(key: &str, label: &str, href: &str, reason: &str) -> LearnerCompanionAction {
    LearnerCompanionAction {
        href: href.to_owned(),
        key: key.to_owned(),
        label: label.to_owned(),
        reason: reason.to_owned(),
    }
}

fn reference(id: Uuid, title: &str) -> LearnerCompanionReference {
    LearnerCompanionReference {
        id,
        title: title.to_owned(),
    }
}

fn unavailable(error: sqlx::Error) -> LearnerCompanionError {
    tracing::error!(%error, "could not resolve the learner Learning Companion context");
    LearnerCompanionError::Unavailable
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::parse_dialogue_graph;

    #[test]
    fn corrupt_assigned_graphs_are_not_learner_projections() {
        assert!(
            parse_dialogue_graph(&json!({"version": 1, "start": "missing", "nodes": []})).is_none()
        );
    }
}
