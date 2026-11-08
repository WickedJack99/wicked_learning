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
    ai_capabilities: Value,
    ai_enabled: bool,
    ai_template_id: Option<Uuid>,
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
    activity_companion_config: Option<Value>,
    activity_title: Option<String>,
    map_id: Uuid,
    map_companion_config: Value,
    map_slug: String,
    map_title: String,
    node_id: Option<Uuid>,
    node_companion_config: Option<Value>,
    node_slug: Option<String>,
    node_title: Option<String>,
    node_visual_config: Option<Value>,
    node_state: Option<String>,
    topic_id: Option<Uuid>,
    topic_title: Option<String>,
    world_id: Uuid,
    world_companion_config: Value,
    world_title: String,
}

#[derive(FromRow)]
struct AssignedGraphRow {
    dialogue_graph: Value,
    scope_type: String,
}

struct ResolvedCompanionConfiguration {
    ai_capabilities: Vec<String>,
    ai_enabled: bool,
    ai_template_id: Option<Uuid>,
    avatar_color: String,
    avatar_position_x: i16,
    avatar_position_y: i16,
    avatar_scale: i16,
    avatar_url: Option<String>,
    dialogue: Option<Value>,
    display_name: String,
    enabled: bool,
    message: String,
    mode: String,
    source_scope: String,
}

async fn load(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    request: &LearnerCompanionRequest,
) -> Result<Option<LearnerCompanion>, LearnerCompanionError> {
    let settings = sqlx::query_as::<_, SettingsRow>(
        "SELECT enabled, display_name, avatar_url, avatar_color, avatar_position_x, avatar_position_y, avatar_scale, welcome_message, mode, ai_enabled, ai_template_id, ai_capabilities FROM learning_companion_settings WHERE singleton = TRUE",
    )
    .fetch_one(pool)
    .await
    .map_err(unavailable)?;
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

    let assigned_graphs = assigned_graphs(pool, scope.as_ref()).await?;
    let configuration = resolve_configuration(&settings, scope.as_ref(), &assigned_graphs);
    if !configuration.enabled {
        return Ok(None);
    }
    let context = context(pool, principal, request.surface, scope.as_ref()).await?;
    Ok(Some(LearnerCompanion {
        avatar_color: configuration.avatar_color,
        avatar_position_x: configuration.avatar_position_x,
        avatar_position_y: configuration.avatar_position_y,
        avatar_scale: configuration.avatar_scale,
        avatar_url: configuration.avatar_url,
        configuration: LearnerCompanionConfiguration {
            ai_enabled: configuration.ai_enabled
                && matches!(configuration.mode.as_str(), "guided_ai" | "open_ai"),
            mode: configuration.mode,
            source_scope: configuration.source_scope,
        },
        context,
        dialogue: configuration.dialogue,
        display_name: configuration.display_name,
        message: configuration.message,
    }))
}

async fn visible_map_scope(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    requested_map_slug: Option<&str>,
) -> Result<Option<ScopeRow>, LearnerCompanionError> {
    sqlx::query_as::<_, ScopeRow>(
        "SELECT worlds.id AS world_id, worlds.title AS world_title, worlds.companion_config AS world_companion_config, maps.id AS map_id, maps.slug AS map_slug, maps.title AS map_title, maps.companion_config AS map_companion_config, NULL::UUID AS node_id, NULL::JSONB AS node_companion_config, NULL::TEXT AS node_slug, NULL::TEXT AS node_title, NULL::JSONB AS node_visual_config, NULL::TEXT AS node_state, topics.id AS topic_id, topics.title AS topic_title, NULL::UUID AS activity_id, NULL::JSONB AS activity_companion_config, NULL::TEXT AS activity_title FROM learning_worlds AS worlds INNER JOIN learning_maps AS maps ON maps.world_id = worlds.id LEFT JOIN learning_topics AS topics ON topics.id = maps.topic_id AND topics.published_at IS NOT NULL WHERE worlds.published_at IS NOT NULL AND maps.published_at IS NOT NULL AND ($1::TEXT IS NULL OR maps.slug = $1) AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) ORDER BY worlds.published_at ASC, worlds.slug ASC, maps.position ASC, maps.slug ASC LIMIT 1",
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
        "SELECT worlds.id AS world_id, worlds.title AS world_title, worlds.companion_config AS world_companion_config, maps.id AS map_id, maps.slug AS map_slug, maps.title AS map_title, maps.companion_config AS map_companion_config, nodes.id AS node_id, nodes.companion_config AS node_companion_config, nodes.slug AS node_slug, nodes.title AS node_title, nodes.visual_config AS node_visual_config, nodes.state AS node_state, topics.id AS topic_id, topics.title AS topic_title, activities.id AS activity_id, activities.companion_config AS activity_companion_config, activities.title AS activity_title FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id INNER JOIN learning_worlds AS worlds ON worlds.id = maps.world_id LEFT JOIN learning_topics AS topics ON topics.id = maps.topic_id AND topics.published_at IS NOT NULL WHERE activities.id = $1 AND worlds.published_at IS NOT NULL AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) LIMIT 1",
    )
    .bind(activity_id)
    .bind(&principal.roles)
    .fetch_optional(pool)
    .await
    .map_err(unavailable)
}

async fn assigned_graphs(
    pool: &PgPool,
    scope: Option<&ScopeRow>,
) -> Result<HashMap<String, Value>, LearnerCompanionError> {
    let Some(scope) = scope else {
        return Ok(HashMap::new());
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
    Ok(assignments
        .into_iter()
        .map(|assignment| (assignment.scope_type, assignment.dialogue_graph))
        .collect())
}

fn resolve_configuration(
    settings: &SettingsRow,
    scope: Option<&ScopeRow>,
    assigned_graphs: &HashMap<String, Value>,
) -> ResolvedCompanionConfiguration {
    let mut configuration = ResolvedCompanionConfiguration {
        ai_capabilities: capabilities(&settings.ai_capabilities),
        ai_enabled: settings.ai_enabled,
        ai_template_id: settings.ai_template_id,
        avatar_color: settings.avatar_color.clone(),
        avatar_position_x: settings.avatar_position_x,
        avatar_position_y: settings.avatar_position_y,
        avatar_scale: settings.avatar_scale,
        avatar_url: settings.avatar_url.clone(),
        dialogue: None,
        display_name: settings.display_name.clone(),
        enabled: settings.enabled,
        message: settings.welcome_message.clone(),
        mode: settings.mode.clone(),
        source_scope: "platform".to_owned(),
    };
    let Some(scope) = scope else {
        return configuration;
    };
    for (scope_type, scope_config) in [
        ("world", Some(&scope.world_companion_config)),
        ("map", Some(&scope.map_companion_config)),
        ("node", scope.node_companion_config.as_ref()),
        ("activity", scope.activity_companion_config.as_ref()),
    ] {
        if apply_scope(
            &mut configuration,
            scope_config,
            assigned_graphs.get(scope_type),
        ) {
            configuration.source_scope = scope_type.to_owned();
        }
    }
    configuration
}

fn apply_scope(
    configuration: &mut ResolvedCompanionConfiguration,
    scope_config: Option<&Value>,
    assigned_graph: Option<&Value>,
) -> bool {
    let mut changed = false;
    if let Some(config) = scope_config.and_then(Value::as_object) {
        if let Some(value) = config.get("enabled").and_then(Value::as_bool) {
            configuration.enabled = value;
            changed = true;
        }
        for (key, target) in [
            ("display_name", &mut configuration.display_name),
            ("welcome_message", &mut configuration.message),
        ] {
            if let Some(value) = config.get(key).and_then(Value::as_str) {
                *target = value.to_owned();
                changed = true;
            }
        }
        if let Some(value) = config.get("avatar_url").and_then(Value::as_str) {
            configuration.avatar_url = (!value.trim().is_empty()).then(|| value.to_owned());
            changed = true;
        }
        if let Some(value) = config.get("avatar_color").and_then(Value::as_str)
            && valid_hex_color(value)
        {
            configuration.avatar_color = value.to_owned();
            changed = true;
        }
        for (key, target, minimum, maximum) in [
            (
                "avatar_position_x",
                &mut configuration.avatar_position_x,
                0,
                100,
            ),
            (
                "avatar_position_y",
                &mut configuration.avatar_position_y,
                0,
                100,
            ),
            ("avatar_scale", &mut configuration.avatar_scale, 80, 200),
        ] {
            if let Some(value) = config.get(key).and_then(Value::as_i64)
                && (minimum..=maximum).contains(&value)
            {
                *target = value as i16;
                changed = true;
            }
        }
        if let Some(value) = config.get("mode").and_then(Value::as_str)
            && matches!(value, "scripted" | "guided_ai" | "open_ai")
        {
            configuration.mode = value.to_owned();
            changed = true;
        }
        if let Some(ai) = config.get("ai").and_then(Value::as_object) {
            if let Some(value) = ai.get("enabled").and_then(Value::as_bool) {
                configuration.ai_enabled = value;
                changed = true;
            }
            if let Some(value) = ai
                .get("template_id")
                .and_then(Value::as_str)
                .and_then(|value| Uuid::parse_str(value).ok())
            {
                configuration.ai_template_id = Some(value);
                changed = true;
            }
            if let Some(value) = ai.get("capabilities")
                && value.is_array()
            {
                configuration.ai_capabilities = capabilities(value);
                changed = true;
            }
        }
    }
    let graph = assigned_graph.or_else(|| {
        scope_config
            .and_then(Value::as_object)
            .and_then(|config| config.get("dialogue_graph"))
    });
    if let Some(graph) = graph.and_then(parse_dialogue_graph) {
        configuration.dialogue = Some(graph);
        changed = true;
    }
    changed
}

fn capabilities(value: &Value) -> Vec<String> {
    value
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .filter(|capability| {
            matches!(
                *capability,
                "current-context"
                    | "topic-context"
                    | "route-context"
                    | "nearby-places"
                    | "navigation-alternatives"
                    | "revisit-options"
            )
        })
        .take(3)
        .map(str::to_owned)
        .collect()
}

fn valid_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value
            .chars()
            .skip(1)
            .all(|character| character.is_ascii_hexdigit())
}

#[derive(FromRow)]
struct ActivityContextStateRow {
    play_run_id: Uuid,
    route_start_id: Uuid,
    route_start_label: String,
}

async fn context(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    surface: LearnerCompanionSurface,
    scope: Option<&ScopeRow>,
) -> Result<LearnerCompanionContext, LearnerCompanionError> {
    match surface {
        LearnerCompanionSurface::Desk => Ok(LearnerCompanionContext {
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
        }),
        LearnerCompanionSurface::World => {
            let scope = scope.expect("a visible world request has scope");
            Ok(LearnerCompanionContext {
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
            })
        }
        LearnerCompanionSurface::Activity => {
            let scope = scope.expect("a visible activity request has scope");
            let activity_id = scope.activity_id.expect("activity scope activity id");
            let active_run = active_run(pool, principal, activity_id).await?;
            let post_attempt_available = completed_activity(pool, principal, activity_id).await?;
            Ok(LearnerCompanionContext {
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
                play_run_id: active_run.as_ref().map(|run| run.play_run_id.to_string()),
                post_attempt_available,
                route: active_run
                    .as_ref()
                    .map(|run| reference(run.route_start_id, &run.route_start_label)),
                surface: surface.as_str().to_owned(),
                topic: scope
                    .topic_id
                    .zip(scope.topic_title.as_deref())
                    .map(|(id, title)| reference(id, title)),
                world: Some(reference(scope.world_id, &scope.world_title)),
            })
        }
    }
}

async fn active_run(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
) -> Result<Option<ActivityContextStateRow>, LearnerCompanionError> {
    sqlx::query_as::<_, ActivityContextStateRow>(
        "SELECT progress.current_play_run_id AS play_run_id, starts.id AS route_start_id, COALESCE(NULLIF(BTRIM(starts.label), ''), 'Current route') AS route_start_label FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id WHERE principals.identity_subject_id = $1 AND progress.current_activity_id = $2 AND progress.current_play_run_id IS NOT NULL AND progress.status = 'in_progress' ORDER BY progress.updated_at DESC LIMIT 1",
    )
    .bind(principal.subject_id)
    .bind(activity_id)
    .fetch_optional(pool)
    .await
    .map_err(unavailable)
}

async fn completed_activity(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
) -> Result<bool, LearnerCompanionError> {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learner_activity_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id WHERE principals.identity_subject_id = $1 AND progress.activity_id = $2 AND progress.status = 'completed')",
    )
    .bind(principal.subject_id)
    .bind(activity_id)
    .fetch_one(pool)
    .await
    .map_err(unavailable)
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
    use std::collections::HashMap;

    use serde_json::json;
    use uuid::Uuid;

    use super::{
        ResolvedCompanionConfiguration, ScopeRow, SettingsRow, apply_scope, parse_dialogue_graph,
        resolve_configuration,
    };

    #[test]
    fn corrupt_assigned_graphs_are_not_learner_projections() {
        assert!(
            parse_dialogue_graph(&json!({"version": 1, "start": "missing", "nodes": []})).is_none()
        );
    }

    #[test]
    fn valid_scope_configuration_inherits_from_world_to_activity() {
        let settings = SettingsRow {
            ai_capabilities: json!(["current-context"]),
            ai_enabled: false,
            ai_template_id: None,
            avatar_color: "#5eead4".to_owned(),
            avatar_position_x: 50,
            avatar_position_y: 50,
            avatar_scale: 100,
            avatar_url: None,
            display_name: "Platform guide".to_owned(),
            enabled: true,
            mode: "scripted".to_owned(),
            welcome_message: "Welcome".to_owned(),
        };
        let scope = ScopeRow {
            activity_id: Some(Uuid::nil()),
            activity_companion_config: Some(json!({
                "display_name": "Activity guide",
                "avatar_position_y": 10,
                "ai": {"enabled": true}
            })),
            activity_title: Some("Activity".to_owned()),
            map_id: Uuid::nil(),
            map_companion_config: json!({"display_name": "Map guide", "avatar_scale": 120}),
            map_slug: "map".to_owned(),
            map_title: "Map".to_owned(),
            node_id: Some(Uuid::nil()),
            node_companion_config: Some(
                json!({"display_name": "Node guide", "avatar_position_x": 5}),
            ),
            node_slug: Some("node".to_owned()),
            node_title: Some("Node".to_owned()),
            node_visual_config: None,
            node_state: None,
            topic_id: None,
            topic_title: None,
            world_id: Uuid::nil(),
            world_companion_config: json!({"display_name": "World guide", "avatar_color": "#123456", "mode": "guided_ai"}),
            world_title: "World".to_owned(),
        };

        let configuration = resolve_configuration(&settings, Some(&scope), &HashMap::new());

        assert_eq!(configuration.source_scope, "activity");
        assert_eq!(configuration.display_name, "Activity guide");
        assert_eq!(configuration.avatar_color, "#123456");
        assert_eq!(configuration.avatar_position_x, 5);
        assert_eq!(configuration.avatar_position_y, 10);
        assert_eq!(configuration.avatar_scale, 120);
        assert_eq!(configuration.mode, "guided_ai");
        assert!(configuration.ai_enabled);
    }

    #[test]
    fn scope_overrides_are_bounded_and_assigned_graphs_win_at_the_same_scope() {
        let mut configuration = ResolvedCompanionConfiguration {
            ai_capabilities: vec!["current-context".to_owned()],
            ai_enabled: false,
            ai_template_id: None,
            avatar_color: "#5eead4".to_owned(),
            avatar_position_x: 50,
            avatar_position_y: 50,
            avatar_scale: 100,
            avatar_url: None,
            dialogue: None,
            display_name: "Platform guide".to_owned(),
            enabled: true,
            message: "Welcome".to_owned(),
            mode: "scripted".to_owned(),
            source_scope: "platform".to_owned(),
        };
        let assigned = json!({
            "version": 1,
            "start": "welcome",
            "nodes": [{"id": "welcome", "type": "end", "message": "Assigned graph"}]
        });

        assert!(apply_scope(
            &mut configuration,
            Some(&json!({
                "display_name": "Activity guide",
                "avatar_color": "not-a-color",
                "avatar_position_x": 101,
                "mode": "guided_ai",
                "ai": {"enabled": true, "capabilities": ["topic-context", "unknown"]},
                "dialogue_graph": {"version": 1, "start": "missing", "nodes": []}
            })),
            Some(&assigned),
        ));

        assert_eq!(configuration.display_name, "Activity guide");
        assert_eq!(configuration.avatar_color, "#5eead4");
        assert_eq!(configuration.avatar_position_x, 50);
        assert_eq!(configuration.mode, "guided_ai");
        assert!(configuration.ai_enabled);
        assert_eq!(configuration.ai_capabilities, ["topic-context"]);
        assert_eq!(configuration.dialogue, parse_dialogue_graph(&assigned));

        configuration.dialogue = None;
        assert!(apply_scope(&mut configuration, None, Some(&assigned)));
        assert_eq!(configuration.dialogue, parse_dialogue_graph(&assigned));
    }
}
