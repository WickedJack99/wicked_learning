use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{FromRow, PgPool};
use std::collections::{BTreeMap, HashMap};
use uuid::Uuid;
use wicked_learning_application::{
    admin_world_graph::AdminWorldGraphQuery,
    admin_world_item_grant::{
        AdminWorldItemGrantCommand, AdminWorldItemGrantError, CreatedItemGrantActivity,
        ItemGrantActivityForm, ItemGrantItem,
    },
    admin_world_item_obstacle::{
        AdminWorldItemObstacleCommand, AdminWorldItemObstacleError, CreatedItemObstacleActivity,
        ItemObstacleActivityForm, ItemObstacleSlot, ItemObstacleSound,
    },
    admin_world_map::AdminWorldMapQuery,
    admin_world_map_asset::{AdminWorldMapAssetCommand, WorldMapAssetForm},
    admin_world_map_create::{AdminWorldMapCreateCommand, CreateWorldMapForm},
    admin_world_markdown::{
        AdminWorldMarkdownCommand, AdminWorldMarkdownError, CreatedMarkdownActivity,
    },
    admin_world_message::{
        AdminWorldMessageCommand, AdminWorldMessageError, CreatedMessageActivity,
        MessageActivityForm, MessageUi,
    },
    admin_world_npc_dialogue::{
        AdminWorldNpcDialogueCommand, AdminWorldNpcDialogueError, CreatedNpcDialogueActivity,
        NpcDialogueActivityForm,
    },
    admin_world_obstacle::{
        AdminWorldObstacleCommand, AdminWorldObstacleError, CreatedObstacleActivity,
        ObstacleActivityForm,
    },
    admin_world_open_practice::{
        AdminWorldOpenPracticeCommand, AdminWorldOpenPracticeError, CreatedOpenPracticeActivity,
        OpenPracticeActivityForm,
    },
    admin_world_portal::{
        AdminWorldPortalCommand, AdminWorldPortalError, CreatedPortalActivity, PortalActivityForm,
        PortalAssetForm, PortalMode,
    },
    admin_world_question::{
        AdminWorldQuestionCommand, AdminWorldQuestionError, CreatedQuestionActivity,
        QuestionActivityForm, QuestionOptionForm,
    },
    admin_world_reflection::{
        AdminWorldReflectionCommand, AdminWorldReflectionError, AdminWorldReviewCommand,
        CreatedReflectionActivity, DEFAULT_REFLECTION_PROMPT, ReflectionActivityForm,
    },
    admin_world_shared_task::{
        AdminWorldSharedTaskCommand, AdminWorldSharedTaskError, CreatedSharedTaskActivity,
        SharedTaskActivityForm,
    },
    admin_world_tool_grant::{
        AdminWorldToolGrantCommand, AdminWorldToolGrantError, CreatedToolGrantActivity,
        ToolGrantActivityForm,
    },
    content_api_activity::{
        ContentApiActivity, ContentApiActivityListQuery, ContentApiActivityNodeQuery,
    },
};
use wicked_learning_domain::world_content::{AdminEditableMapAsset, AdminNodeSummary};
use wicked_learning_persistence::{
    admin_world_graph::PostgresAdminWorldGraphRepository,
    admin_world_item_grant::PostgresAdminWorldItemGrantRepository,
    admin_world_item_obstacle::PostgresAdminWorldItemObstacleRepository,
    admin_world_map::PostgresAdminWorldMapRepository,
    admin_world_map_asset::PostgresAdminWorldMapAssetRepository,
    admin_world_map_create::PostgresAdminWorldMapCreateRepository,
    admin_world_markdown::{PostgresAdminWorldMarkdownRepository, markdown_config},
    admin_world_message::PostgresAdminWorldMessageRepository,
    admin_world_npc_dialogue::PostgresAdminWorldNpcDialogueRepository,
    admin_world_obstacle::PostgresAdminWorldObstacleRepository,
    admin_world_open_practice::PostgresAdminWorldOpenPracticeRepository,
    admin_world_portal::PostgresAdminWorldPortalRepository,
    admin_world_question::{PostgresAdminWorldQuestionRepository, config as question_config},
    admin_world_reflection::PostgresAdminWorldReflectionRepository,
    admin_world_shared_task::{
        PostgresAdminWorldSharedTaskRepository, config as shared_task_config,
    },
    admin_world_tool_grant::PostgresAdminWorldToolGrantRepository,
    content_api_activity::PostgresContentApiActivityRepository,
};

use crate::{
    AppState,
    admin_world_markdown::{
        MarkdownGraphLayoutRequest, MarkdownPageRequest, MarkdownTransitionRequest,
        form as markdown_form,
    },
    csrf,
    error::ApiError,
    identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

/// Serves the source Content API's machine-readable authoring boundary. The
/// contract is intentionally a separate `/api/content/v1` namespace: it is an
/// authenticated administration API, not a browser capability or public token.
pub async fn contract(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<Value>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    if !principal.has_permission("content_api", "ro") {
        return Err(ApiError::forbidden());
    }

    Ok(Json(json!({ "data": document() })))
}

#[derive(Deserialize)]
pub struct CreateMapRequest {
    title: String,
    slug: Option<String>,
    description: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateMapAssetRequest {
    title: String,
    description: Option<String>,
    image_url: Option<String>,
    text: Option<String>,
    position_x: f64,
    position_y: f64,
    position_z: i32,
    width: f64,
    opacity: f64,
    #[serde(default)]
    locked: bool,
    interaction_mode: String,
    #[serde(default = "empty_object")]
    interaction_config: Value,
    #[serde(default = "empty_object")]
    visual_config: Value,
    #[serde(default = "empty_object")]
    sound_config: Value,
}

#[derive(Deserialize)]
pub struct CreateActivityRequest {
    #[serde(rename = "type")]
    activity_type: String,
    title: String,
    slug: Option<String>,
    introduction: Option<String>,
    reflection_prompt: Option<String>,
    reflection_note: Option<String>,
    reflection_topic: Option<String>,
    reflection_subtopic: Option<String>,
    open_practice_next_step: Option<String>,
    markdown_pages: Option<Vec<MarkdownPageRequest>>,
    markdown_transitions: Option<Vec<MarkdownTransitionRequest>>,
    markdown_graph_layout: Option<MarkdownGraphLayoutRequest>,
    question_prompt: Option<String>,
    question_feedback_correct: Option<String>,
    question_feedback_incorrect: Option<String>,
    question_explanation: Option<String>,
    question_allow_multiple: Option<bool>,
    question_options: Option<Vec<ContentApiQuestionOptionRequest>>,
    shared_task_kind: Option<String>,
    shared_task_show_contributions: Option<bool>,
    shared_task_prompt: Option<String>,
    shared_task_instructions: Option<String>,
    shared_task_input_label: Option<String>,
    shared_task_project_goal: Option<String>,
    shared_task_project_deliverable: Option<String>,
    shared_task_project_steps: Option<Vec<String>>,
    shared_task_peer_review_enabled: Option<bool>,
    shared_task_peer_review_prompt: Option<String>,
    shared_task_threshold: Option<u16>,
    shared_task_minimum_length: Option<u16>,
    shared_task_repeat_policy: Option<String>,
    shared_task_validation_mode: Option<String>,
    shared_task_cycle_mode: Option<String>,
    item_grant_background_dark: Option<String>,
    item_grant_background_light: Option<String>,
    item_grant_background_mirrored: Option<bool>,
    item_grant_items: Option<Vec<ContentApiItemGrantItemRequest>>,
    item_grant_probability_percent: Option<f64>,
    tool_grant_background_dark: Option<String>,
    tool_grant_background_light: Option<String>,
    tool_grant_background_mirrored: Option<bool>,
    tool_grant_bubble_border_color_dark: Option<String>,
    tool_grant_bubble_border_color_light: Option<String>,
    tool_grant_bubble_color_dark: Option<String>,
    tool_grant_bubble_color_light: Option<String>,
    tool_grant_bubble_opacity_dark: Option<f64>,
    tool_grant_bubble_opacity_light: Option<f64>,
    tool_grant_fade_duration_seconds: Option<f64>,
    tool_grant_slide_direction: Option<String>,
    tool_grant_slide_duration_seconds: Option<f64>,
    tool_grant_text: Option<String>,
    tool_grant_tool_id: Option<String>,
    tool_grant_tool_mirrored: Option<bool>,
    tool_grant_tool_x: Option<f64>,
    tool_grant_tool_y: Option<f64>,
    tool_grant_typing_speed: Option<f64>,
    item_obstacle_background_dark: Option<String>,
    item_obstacle_background_light: Option<String>,
    item_obstacle_background_mirrored: Option<bool>,
    item_obstacle_met_background_dark: Option<String>,
    item_obstacle_met_background_light: Option<String>,
    item_obstacle_met_background_mirrored: Option<bool>,
    item_obstacle_overlay_dark: Option<String>,
    item_obstacle_overlay_light: Option<String>,
    item_obstacle_overlay_mirrored: Option<bool>,
    item_obstacle_overlay_x: Option<f64>,
    item_obstacle_overlay_y: Option<f64>,
    item_obstacle_overlay_width: Option<f64>,
    item_obstacle_slots: Option<Vec<ContentApiItemObstacleSlotRequest>>,
    item_obstacle_consume_on_each_entry: Option<bool>,
    item_obstacle_lock_minutes: Option<i32>,
    item_obstacle_sound_not_met_enabled: Option<bool>,
    item_obstacle_sound_not_met_id: Option<String>,
    item_obstacle_sound_met_enabled: Option<bool>,
    item_obstacle_sound_met_id: Option<String>,
    item_obstacle_sound_transition_enabled: Option<bool>,
    item_obstacle_sound_transition_id: Option<String>,
    obstacle_allowed_tool_ids: Option<Vec<String>>,
    obstacle_background_dark: Option<String>,
    obstacle_background_light: Option<String>,
    obstacle_background_mirrored: Option<bool>,
    obstacle_bubble_border_color_dark: Option<String>,
    obstacle_bubble_border_color_light: Option<String>,
    obstacle_bubble_color_dark: Option<String>,
    obstacle_bubble_color_light: Option<String>,
    obstacle_bubble_opacity_dark: Option<f64>,
    obstacle_bubble_opacity_light: Option<f64>,
    obstacle_image_dark: Option<String>,
    obstacle_image_light: Option<String>,
    obstacle_image_mirrored: Option<bool>,
    obstacle_persist_after_solved: Option<bool>,
    obstacle_prompt_text: Option<String>,
    obstacle_x: Option<f64>,
    obstacle_y: Option<f64>,
    obstacle_width: Option<f64>,
    obstacle_revisit_background_dark: Option<String>,
    obstacle_revisit_background_light: Option<String>,
    obstacle_revisit_background_mirrored: Option<bool>,
    obstacle_revisit_image_dark: Option<String>,
    obstacle_revisit_image_light: Option<String>,
    obstacle_revisit_image_mirrored: Option<bool>,
    obstacle_revisit_text: Option<String>,
    obstacle_success_animation: Option<String>,
    obstacle_success_text: Option<String>,
    obstacle_typing_speed: Option<f64>,
    portal_mode: Option<String>,
    portal_background_dark: Option<String>,
    portal_background_light: Option<String>,
    portal_background_mirrored: Option<bool>,
    portal_assets: Option<Vec<ContentApiPortalAssetRequest>>,
    portal_duration_seconds: Option<f64>,
    portal_foreground_dark: Option<String>,
    portal_foreground_light: Option<String>,
    portal_foreground_mirrored: Option<bool>,
    portal_foreground_width: Option<f64>,
    portal_foreground_x: Option<f64>,
    portal_foreground_y: Option<f64>,
    portal_show_on_arrival: Option<bool>,
    portal_swirl_enabled: Option<bool>,
    portal_bubble_text: Option<String>,
    portal_bubble_typing_speed: Option<f64>,
    portal_bubble_color_dark: Option<String>,
    portal_bubble_color_light: Option<String>,
    portal_bubble_border_color_dark: Option<String>,
    portal_bubble_border_color_light: Option<String>,
    portal_bubble_text_color_dark: Option<String>,
    portal_bubble_text_color_light: Option<String>,
    portal_wait_for_enter: Option<bool>,
    target_portal_activity_id: Option<String>,
    message_topic_id: Option<String>,
    message_topic_title: Option<String>,
    message_audience: Option<String>,
    message_allow_responses: Option<bool>,
    message_response_prompt: Option<String>,
    message_prompt_text: Option<String>,
    message_input_label: Option<String>,
    message_surface_color_dark: Option<String>,
    message_surface_color_light: Option<String>,
    message_card_color_dark: Option<String>,
    message_card_color_light: Option<String>,
    message_card_border_color_dark: Option<String>,
    message_card_border_color_light: Option<String>,
    message_text_color_dark: Option<String>,
    message_text_color_light: Option<String>,
    message_accent_color_dark: Option<String>,
    message_accent_color_light: Option<String>,
    graph_position_x: Option<i32>,
    graph_position_y: Option<i32>,
}

#[derive(Deserialize)]
struct ContentApiQuestionOptionRequest {
    label: String,
    body: String,
    is_correct: bool,
    key: Option<String>,
    outcome_key: Option<String>,
    feedback: Option<String>,
    #[serde(default)]
    weights: BTreeMap<String, f64>,
}

#[derive(Deserialize)]
struct ContentApiItemGrantItemRequest {
    item_id: String,
    quantity: u16,
}

#[derive(Deserialize)]
struct ContentApiItemObstacleSlotRequest {
    item_id: Option<String>,
    x: Option<f64>,
    y: Option<f64>,
    width: Option<f64>,
}

#[derive(Deserialize)]
struct ContentApiPortalAssetRequest {
    id: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    label: Option<String>,
    layer: Option<String>,
    mirrored: Option<bool>,
    opacity: Option<f64>,
    width: Option<f64>,
    x: Option<f64>,
    y: Option<f64>,
}

/// Lists only maps already visible in the caller's existing scoped World
/// Builder graph. Content API permission opens this namespace; map scope still
/// decides which records can be returned.
pub async fn maps(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<Value>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    require_content_permission(&principal, "ro")?;
    let repository = PostgresAdminWorldGraphRepository::new(&state.application_database);
    let graph = AdminWorldGraphQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::forbidden)?;

    Ok(Json(json!({
        "data": graph.maps.into_iter().map(|map| json!({
            "id": map.id,
            "slug": map.slug,
            "title": map.title,
            "description": map.description,
        })).collect::<Vec<_>>(),
    })))
}

/// Lists the source-compatible MapAssets for one already editable map. The
/// selected-map query remains the authorization authority; Content API
/// permission alone cannot reveal a map or its unpublished assets.
pub async fn map_assets(
    State(state): State<AppState>,
    Path(map_id): Path<String>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<Value>, ApiError> {
    let map_id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    require_content_permission(&principal, "ro")?;
    let repository = PostgresAdminWorldMapRepository::new(&state.application_database);
    let editable_map = AdminWorldMapQuery::new(&repository)
        .execute(&principal, map_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    let map = editable_map.editable_map.map;
    let activity_counts =
        load_map_asset_activity_counts(&state.application_database, &map.map_assets)
            .await
            .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(json!({
        "data": serialize_map_assets(map_id, &map.map_assets, &map.nodes, &activity_counts),
    })))
}

/// Creates the same MapAsset, compatibility node, and draft route as the
/// World Builder command. The Content API's title and description are carried
/// as explicit node metadata rather than inferred from display text.
pub async fn create_map_asset(
    State(state): State<AppState>,
    Path(map_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateMapAssetRequest>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let map_id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let form = WorldMapAssetForm::parse(
        request.image_url.as_deref(),
        request.text.as_deref(),
        request.position_x,
        request.position_y,
        request.position_z,
        request.width,
        request.opacity,
        request.locked,
        &request.interaction_mode,
        request.interaction_config,
        request.visual_config,
        request.sound_config,
    )
    .and_then(|form| form.with_content_metadata(&request.title, request.description.as_deref()))
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    require_content_permission(&principal, "ru")?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapAssetRepository::new(&state.application_database);
    let created = AdminWorldMapAssetCommand::new(&repository)
        .create(&principal, map_id, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "data": serialize_created_map_asset(map_id, created.asset_id, &form),
        })),
    ))
}

/// Lists source-shaped activities only after resolving the MapAsset's
/// compatibility node through the World Activity editor scope.
pub async fn activities(
    State(state): State<AppState>,
    Path(map_asset_id): Path<String>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<Value>, ApiError> {
    let map_asset_id = Uuid::parse_str(&map_asset_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    require_content_permission(&principal, "ro")?;
    let repository = PostgresContentApiActivityRepository::new(&state.application_database);
    let activities = ContentApiActivityListQuery::new(&repository)
        .execute(&principal, map_asset_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;

    Ok(Json(json!({
        "data": activities.activities.iter().map(|activity| serialize_activity(map_asset_id, activity)).collect::<Vec<_>>(),
    })))
}

/// Creates the bounded Content API activity types whose dedicated World
/// Builder commands own the write transaction and repeat scoped activity
/// authorization. This adapter only translates the source request shape.
pub async fn create_activity(
    State(state): State<AppState>,
    Path(map_asset_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(mut request): Json<CreateActivityRequest>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let map_asset_id = Uuid::parse_str(&map_asset_id).map_err(|_| ApiError::not_found())?;
    if !is_supported_content_api_activity_type(&request.activity_type) {
        return Err(ApiError::invalid_request());
    }
    let principal = authenticated_principal(&state, auth_session).await?;
    require_content_permission(&principal, "ru")?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let activity_repository =
        PostgresContentApiActivityRepository::new(&state.application_database);
    let node_id = ContentApiActivityNodeQuery::new(&activity_repository)
        .execute(&principal, map_asset_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    let data = match request.activity_type.as_str() {
        "reflection" => {
            let form = ReflectionActivityForm::parse(
                &request.title,
                request.slug.as_deref(),
                request.introduction.as_deref(),
                request
                    .reflection_prompt
                    .as_deref()
                    .unwrap_or(DEFAULT_REFLECTION_PROMPT),
                request.reflection_note.as_deref().unwrap_or_default(),
                request.reflection_topic.as_deref().unwrap_or_default(),
                request.reflection_subtopic.as_deref().unwrap_or_default(),
            )
            .ok_or_else(ApiError::invalid_request)?
            .with_graph_position(request.graph_position_x, request.graph_position_y);
            let repository =
                PostgresAdminWorldReflectionRepository::new(&state.application_database);
            AdminWorldReflectionCommand::new(&repository)
                .create(&principal, node_id, &form)
                .await
                .map_err(map_reflection_error)?
                .map(|created| {
                    serialize_created_reflective_activity(
                        map_asset_id,
                        created,
                        &form,
                        "reflection",
                    )
                })
        }
        "review" => {
            let form = ReflectionActivityForm::parse(
                &request.title,
                request.slug.as_deref(),
                request.introduction.as_deref(),
                request
                    .reflection_prompt
                    .as_deref()
                    .unwrap_or(DEFAULT_REFLECTION_PROMPT),
                request.reflection_note.as_deref().unwrap_or_default(),
                request.reflection_topic.as_deref().unwrap_or_default(),
                request.reflection_subtopic.as_deref().unwrap_or_default(),
            )
            .ok_or_else(ApiError::invalid_request)?
            .with_graph_position(request.graph_position_x, request.graph_position_y);
            let repository =
                PostgresAdminWorldReflectionRepository::new(&state.application_database);
            AdminWorldReviewCommand::new(&repository)
                .create(&principal, node_id, &form)
                .await
                .map_err(map_reflection_error)?
                .map(|created| {
                    serialize_created_reflective_activity(map_asset_id, created, &form, "review")
                })
        }
        "open_practice" => {
            let form = OpenPracticeActivityForm::parse(
                &request.title,
                request.slug.as_deref(),
                request.introduction.as_deref(),
                request.open_practice_next_step.as_deref(),
            )
            .ok_or_else(ApiError::invalid_request)?
            .with_graph_position(request.graph_position_x, request.graph_position_y);
            let repository =
                PostgresAdminWorldOpenPracticeRepository::new(&state.application_database);
            AdminWorldOpenPracticeCommand::new(&repository)
                .create(&principal, node_id, &form)
                .await
                .map_err(map_open_practice_error)?
                .map(|created| serialize_created_open_practice(map_asset_id, created, &form))
        }
        "markdown" => {
            let form = markdown_form(
                &request.title,
                request.slug.as_deref(),
                request.introduction.as_deref(),
                request
                    .markdown_pages
                    .take()
                    .ok_or_else(ApiError::invalid_request)?,
                request
                    .markdown_transitions
                    .take()
                    .ok_or_else(ApiError::invalid_request)?,
                request
                    .markdown_graph_layout
                    .take()
                    .ok_or_else(ApiError::invalid_request)?,
            )
            .map(|form| {
                form.with_graph_position(request.graph_position_x, request.graph_position_y)
            })?;
            let repository = PostgresAdminWorldMarkdownRepository::new(&state.application_database);
            AdminWorldMarkdownCommand::new(&repository)
                .create(&principal, node_id, &form)
                .await
                .map_err(map_markdown_error)?
                .map(|created| serialize_created_markdown(map_asset_id, created, &form))
        }
        "question" => {
            let form = content_api_question_form(&request)?;
            let repository = PostgresAdminWorldQuestionRepository::new(&state.application_database);
            AdminWorldQuestionCommand::new(&repository)
                .create(&principal, node_id, &form)
                .await
                .map_err(map_question_error)?
                .map(|created| serialize_created_question(map_asset_id, created, &form))
        }
        "shared_task" => {
            let form = content_api_shared_task_form(&request)?;
            let repository =
                PostgresAdminWorldSharedTaskRepository::new(&state.application_database);
            AdminWorldSharedTaskCommand::new(&repository)
                .create(&principal, node_id, &form)
                .await
                .map_err(map_shared_task_error)?
                .map(|created| serialize_created_shared_task(map_asset_id, created, &form))
        }
        "item_grant" => {
            let form = content_api_item_grant_form(&request)?;
            let repository =
                PostgresAdminWorldItemGrantRepository::new(&state.application_database);
            AdminWorldItemGrantCommand::new(&repository)
                .create(&principal, node_id, &form)
                .await
                .map_err(map_item_grant_error)?
                .map(|created| serialize_created_item_grant(map_asset_id, created, &form))
        }
        "tool_grant" => {
            let form = content_api_tool_grant_form(&request)?;
            let repository =
                PostgresAdminWorldToolGrantRepository::new(&state.application_database);
            AdminWorldToolGrantCommand::new(&repository)
                .create(&principal, node_id, &form)
                .await
                .map_err(map_tool_grant_error)?
                .map(|created| serialize_created_tool_grant(map_asset_id, created, &form))
        }
        "item_obstacle" => {
            let form = content_api_item_obstacle_form(&request)?;
            let repository =
                PostgresAdminWorldItemObstacleRepository::new(&state.application_database);
            AdminWorldItemObstacleCommand::new(&repository)
                .create(&principal, node_id, &form)
                .await
                .map_err(map_item_obstacle_error)?
                .map(|created| serialize_created_item_obstacle(map_asset_id, created, &form))
        }
        "obstacle" => {
            let form = content_api_obstacle_form(&request)?;
            let repository = PostgresAdminWorldObstacleRepository::new(&state.application_database);
            AdminWorldObstacleCommand::new(&repository)
                .create(&principal, node_id, &form)
                .await
                .map_err(map_obstacle_error)?
                .map(|created| serialize_created_obstacle(map_asset_id, created, &form))
        }
        "portal" => {
            let form = content_api_portal_form(&request)?;
            let repository = PostgresAdminWorldPortalRepository::new(&state.application_database);
            AdminWorldPortalCommand::new(&repository)
                .create(&principal, node_id, &form)
                .await
                .map_err(map_portal_error)?
                .map(|created| serialize_created_portal(map_asset_id, created, &form))
        }
        "npc_dialogue" => {
            let form = NpcDialogueActivityForm::parse(
                &request.title,
                request.slug.as_deref(),
                request.introduction.as_deref(),
            )
            .map(|form| {
                form.with_graph_position(request.graph_position_x, request.graph_position_y)
            })
            .ok_or_else(ApiError::invalid_request)?;
            let repository =
                PostgresAdminWorldNpcDialogueRepository::new(&state.application_database);
            AdminWorldNpcDialogueCommand::new(&repository)
                .create(&principal, node_id, &form)
                .await
                .map_err(map_npc_dialogue_error)?
                .map(|created| serialize_created_npc_dialogue(map_asset_id, created, &form))
        }
        "message_prompt" | "message_wall" => {
            let form = content_api_message_form(&request)?;
            let repository = PostgresAdminWorldMessageRepository::new(&state.application_database);
            AdminWorldMessageCommand::new(&repository)
                .create(&principal, node_id, &form)
                .await
                .map_err(map_message_error)?
                .map(|created| serialize_created_message(map_asset_id, created, &form))
        }
        _ => unreachable!("activity type is checked before creating an activity"),
    }
    .ok_or_else(ApiError::not_found)?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "data": data,
        })),
    ))
}

/// Creates a map through the established World Builder command. The Content
/// API adds no browser-chosen World or scope: both remain server-owned.
pub async fn create_map(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateMapRequest>,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let form = CreateWorldMapForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.description.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    require_content_permission(&principal, "ru")?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapCreateRepository::new(&state.application_database);
    let map_id = AdminWorldMapCreateCommand::new(&repository)
        .execute(&principal, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::forbidden)?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "data": {
                "id": map_id,
                "slug": form.slug.unwrap_or_else(|| wicked_learning_application::admin_world_map_create::generated_map_slug(&form.title)),
                "title": form.title,
                "description": form.description,
            }
        })),
    ))
}

fn require_content_permission(
    principal: &wicked_learning_domain::identity_access::AuthorizedPrincipal,
    level: &str,
) -> Result<(), ApiError> {
    principal
        .has_permission("content_api", level)
        .then_some(())
        .ok_or_else(ApiError::forbidden)
}

fn empty_object() -> Value {
    Value::Object(Default::default())
}

fn is_supported_content_api_activity_type(activity_type: &str) -> bool {
    matches!(
        activity_type,
        "reflection"
            | "review"
            | "open_practice"
            | "markdown"
            | "question"
            | "shared_task"
            | "item_grant"
            | "tool_grant"
            | "item_obstacle"
            | "obstacle"
            | "portal"
            | "npc_dialogue"
            | "message_prompt"
            | "message_wall"
    )
}

fn map_reflection_error(error: AdminWorldReflectionError) -> ApiError {
    match error {
        AdminWorldReflectionError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldReflectionError::Conflict => ApiError::conflict(),
        AdminWorldReflectionError::Unavailable => ApiError::service_unavailable(),
    }
}

fn map_open_practice_error(error: AdminWorldOpenPracticeError) -> ApiError {
    match error {
        AdminWorldOpenPracticeError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldOpenPracticeError::Conflict => ApiError::conflict(),
        AdminWorldOpenPracticeError::Unavailable => ApiError::service_unavailable(),
    }
}

fn map_markdown_error(error: AdminWorldMarkdownError) -> ApiError {
    match error {
        AdminWorldMarkdownError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldMarkdownError::Conflict => ApiError::conflict(),
        AdminWorldMarkdownError::Unavailable => ApiError::service_unavailable(),
    }
}

fn map_question_error(error: AdminWorldQuestionError) -> ApiError {
    match error {
        AdminWorldQuestionError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldQuestionError::Conflict => ApiError::conflict(),
        AdminWorldQuestionError::Unavailable => ApiError::service_unavailable(),
    }
}

fn map_shared_task_error(error: AdminWorldSharedTaskError) -> ApiError {
    match error {
        AdminWorldSharedTaskError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldSharedTaskError::Conflict => ApiError::conflict(),
        AdminWorldSharedTaskError::Unavailable => ApiError::service_unavailable(),
    }
}

fn map_item_grant_error(error: AdminWorldItemGrantError) -> ApiError {
    match error {
        AdminWorldItemGrantError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldItemGrantError::Conflict => ApiError::conflict(),
        AdminWorldItemGrantError::Unavailable => ApiError::service_unavailable(),
    }
}

fn map_tool_grant_error(error: AdminWorldToolGrantError) -> ApiError {
    match error {
        AdminWorldToolGrantError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldToolGrantError::Conflict => ApiError::conflict(),
        AdminWorldToolGrantError::Unavailable => ApiError::service_unavailable(),
    }
}

fn map_item_obstacle_error(error: AdminWorldItemObstacleError) -> ApiError {
    match error {
        AdminWorldItemObstacleError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldItemObstacleError::Conflict => ApiError::conflict(),
        AdminWorldItemObstacleError::Unavailable => ApiError::service_unavailable(),
    }
}

fn map_obstacle_error(error: AdminWorldObstacleError) -> ApiError {
    match error {
        AdminWorldObstacleError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldObstacleError::Conflict => ApiError::conflict(),
        AdminWorldObstacleError::Unavailable => ApiError::service_unavailable(),
    }
}

fn map_portal_error(error: AdminWorldPortalError) -> ApiError {
    match error {
        AdminWorldPortalError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldPortalError::Conflict => ApiError::conflict(),
        AdminWorldPortalError::Unavailable => ApiError::service_unavailable(),
    }
}

fn map_npc_dialogue_error(error: AdminWorldNpcDialogueError) -> ApiError {
    match error {
        AdminWorldNpcDialogueError::Conflict => ApiError::conflict(),
        AdminWorldNpcDialogueError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldNpcDialogueError::Unavailable => ApiError::service_unavailable(),
    }
}

fn map_message_error(error: AdminWorldMessageError) -> ApiError {
    match error {
        AdminWorldMessageError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldMessageError::Conflict => ApiError::conflict(),
        AdminWorldMessageError::Unavailable => ApiError::service_unavailable(),
    }
}

fn content_api_question_form(
    request: &CreateActivityRequest,
) -> Result<QuestionActivityForm, ApiError> {
    let options = request
        .question_options
        .as_ref()
        .ok_or_else(ApiError::invalid_request)?
        .iter()
        .map(|option| {
            QuestionOptionForm::parse(
                &option.label,
                &option.body,
                option.is_correct,
                option.key.as_deref(),
                option.outcome_key.as_deref().unwrap_or_default(),
                option.feedback.as_deref().unwrap_or_default(),
                option.weights.clone(),
            )
            .ok_or_else(ApiError::invalid_request)
        })
        .collect::<Result<Vec<_>, _>>()?;
    QuestionActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request
            .question_prompt
            .as_deref()
            .ok_or_else(ApiError::invalid_request)?,
        request
            .question_feedback_correct
            .as_deref()
            .unwrap_or_default(),
        request
            .question_feedback_incorrect
            .as_deref()
            .unwrap_or_default(),
        request.question_explanation.as_deref().unwrap_or_default(),
        request.question_allow_multiple.unwrap_or(false),
        options,
    )
    .map(|form| form.with_graph_position(request.graph_position_x, request.graph_position_y))
    .ok_or_else(ApiError::invalid_request)
}

fn content_api_shared_task_form(
    request: &CreateActivityRequest,
) -> Result<SharedTaskActivityForm, ApiError> {
    let task_kind = request.shared_task_kind.as_deref().unwrap_or("text");
    let input_label = request
        .shared_task_input_label
        .as_deref()
        .unwrap_or(match task_kind {
            "question" => "Your question",
            "reflection" => "Your reflection",
            _ => "Your contribution",
        });
    SharedTaskActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        task_kind,
        request.shared_task_show_contributions.unwrap_or(false),
        request
            .shared_task_prompt
            .as_deref()
            .unwrap_or("Add a useful contribution."),
        request
            .shared_task_instructions
            .as_deref()
            .unwrap_or_default(),
        input_label,
        request
            .shared_task_project_goal
            .as_deref()
            .unwrap_or_default(),
        request
            .shared_task_project_deliverable
            .as_deref()
            .unwrap_or_default(),
        request
            .shared_task_project_steps
            .clone()
            .unwrap_or_default(),
        request.shared_task_peer_review_enabled.unwrap_or(false),
        request
            .shared_task_peer_review_prompt
            .as_deref()
            .unwrap_or("What does this contribution help you notice, question, or extend?"),
        request.shared_task_threshold.unwrap_or(3),
        request.shared_task_minimum_length.unwrap_or(20),
        request
            .shared_task_repeat_policy
            .as_deref()
            .unwrap_or("once_per_user"),
        request
            .shared_task_validation_mode
            .as_deref()
            .unwrap_or("minimum_length"),
        request.shared_task_cycle_mode.as_deref().unwrap_or("none"),
    )
    .map(|form| form.with_graph_position(request.graph_position_x, request.graph_position_y))
    .ok_or_else(ApiError::invalid_request)
}

fn content_api_item_grant_form(
    request: &CreateActivityRequest,
) -> Result<ItemGrantActivityForm, ApiError> {
    let items = request
        .item_grant_items
        .as_ref()
        .map(|items| {
            items
                .iter()
                .map(|item| {
                    Ok(ItemGrantItem {
                        item_id: Uuid::parse_str(&item.item_id)
                            .map_err(|_| ApiError::invalid_request())?,
                        quantity: item.quantity,
                    })
                })
                .collect::<Result<Vec<_>, ApiError>>()
        })
        .transpose()?
        .unwrap_or_default();
    ItemGrantActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request.item_grant_background_dark.as_deref(),
        request.item_grant_background_light.as_deref(),
        request.item_grant_background_mirrored.unwrap_or(false),
        items,
        request.item_grant_probability_percent.unwrap_or(100.0),
    )
    .map(|form| form.with_graph_position(request.graph_position_x, request.graph_position_y))
    .ok_or_else(ApiError::invalid_request)
}

fn content_api_tool_grant_form(
    request: &CreateActivityRequest,
) -> Result<ToolGrantActivityForm, ApiError> {
    let tool_id = request
        .tool_grant_tool_id
        .as_deref()
        .map(|value| Uuid::parse_str(value).map_err(|_| ApiError::invalid_request()))
        .transpose()?;
    ToolGrantActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request.tool_grant_background_dark.as_deref(),
        request.tool_grant_background_light.as_deref(),
        request.tool_grant_background_mirrored.unwrap_or(false),
        request.tool_grant_bubble_border_color_dark.as_deref(),
        request.tool_grant_bubble_border_color_light.as_deref(),
        request.tool_grant_bubble_color_dark.as_deref(),
        request.tool_grant_bubble_color_light.as_deref(),
        request.tool_grant_bubble_opacity_dark.unwrap_or(92.0),
        request.tool_grant_bubble_opacity_light.unwrap_or(94.0),
        request.tool_grant_fade_duration_seconds.unwrap_or(0.4),
        request.tool_grant_slide_direction.as_deref(),
        request.tool_grant_slide_duration_seconds.unwrap_or(0.6),
        request.tool_grant_text.as_deref(),
        tool_id,
        request.tool_grant_tool_mirrored.unwrap_or(false),
        request.tool_grant_tool_x.unwrap_or(50.0),
        request.tool_grant_tool_y.unwrap_or(50.0),
        request.tool_grant_typing_speed.unwrap_or(24.0),
    )
    .map(|form| form.with_graph_position(request.graph_position_x, request.graph_position_y))
    .ok_or_else(ApiError::invalid_request)
}

fn content_api_item_obstacle_form(
    request: &CreateActivityRequest,
) -> Result<ItemObstacleActivityForm, ApiError> {
    let slots = request
        .item_obstacle_slots
        .as_ref()
        .map(|slots| {
            if slots.len() > 10 {
                return Err(ApiError::invalid_request());
            }
            slots
                .iter()
                .map(|slot| {
                    let x = slot.x.unwrap_or(50.0);
                    let y = slot.y.unwrap_or(50.0);
                    let width = slot.width.unwrap_or(10.0);
                    if !bounded_position(x, 0.0, 100.0)
                        || !bounded_position(y, 0.0, 100.0)
                        || !bounded_position(width, 1.0, 100.0)
                    {
                        return Err(ApiError::invalid_request());
                    }
                    slot.item_id
                        .as_deref()
                        .map(|item_id| {
                            Ok(ItemObstacleSlot {
                                item_id: Uuid::parse_str(item_id)
                                    .map_err(|_| ApiError::invalid_request())?,
                                x,
                                y,
                                width,
                            })
                        })
                        .transpose()
                })
                .filter_map(Result::transpose)
                .collect::<Result<Vec<_>, ApiError>>()
        })
        .transpose()?
        .unwrap_or_default();
    let sound = |enabled: Option<bool>, sound_id: Option<&str>| {
        Ok(ItemObstacleSound {
            enabled: enabled.unwrap_or(false),
            sound_id: sound_id
                .map(|id| Uuid::parse_str(id).map_err(|_| ApiError::invalid_request()))
                .transpose()?,
        })
    };
    ItemObstacleActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request.item_obstacle_background_dark.as_deref(),
        request.item_obstacle_background_light.as_deref(),
        request.item_obstacle_background_mirrored.unwrap_or(false),
        request.item_obstacle_met_background_dark.as_deref(),
        request.item_obstacle_met_background_light.as_deref(),
        request
            .item_obstacle_met_background_mirrored
            .unwrap_or(false),
        request.item_obstacle_overlay_dark.as_deref(),
        request.item_obstacle_overlay_light.as_deref(),
        request.item_obstacle_overlay_mirrored.unwrap_or(false),
        request.item_obstacle_overlay_x.unwrap_or(50.0),
        request.item_obstacle_overlay_y.unwrap_or(50.0),
        request.item_obstacle_overlay_width.unwrap_or(30.0),
        slots,
        request.item_obstacle_consume_on_each_entry.unwrap_or(false),
        request.item_obstacle_lock_minutes.unwrap_or(0),
        sound(
            request.item_obstacle_sound_not_met_enabled,
            request.item_obstacle_sound_not_met_id.as_deref(),
        )?,
        sound(
            request.item_obstacle_sound_met_enabled,
            request.item_obstacle_sound_met_id.as_deref(),
        )?,
        sound(
            request.item_obstacle_sound_transition_enabled,
            request.item_obstacle_sound_transition_id.as_deref(),
        )?,
    )
    .map(|form| form.with_graph_position(request.graph_position_x, request.graph_position_y))
    .ok_or_else(ApiError::invalid_request)
}

fn content_api_obstacle_form(
    request: &CreateActivityRequest,
) -> Result<ObstacleActivityForm, ApiError> {
    let allowed_tool_ids = request
        .obstacle_allowed_tool_ids
        .as_ref()
        .map(|ids| {
            if ids.len() > 100 {
                return Err(ApiError::invalid_request());
            }
            ids.iter()
                .map(|id| Uuid::parse_str(id).map_err(|_| ApiError::invalid_request()))
                .collect()
        })
        .transpose()?
        .unwrap_or_default();
    ObstacleActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        allowed_tool_ids,
        request.obstacle_background_dark.as_deref(),
        request.obstacle_background_light.as_deref(),
        request.obstacle_background_mirrored.unwrap_or(false),
        request.obstacle_bubble_border_color_dark.as_deref(),
        request.obstacle_bubble_border_color_light.as_deref(),
        request.obstacle_bubble_color_dark.as_deref(),
        request.obstacle_bubble_color_light.as_deref(),
        request.obstacle_bubble_opacity_dark.unwrap_or(92.0),
        request.obstacle_bubble_opacity_light.unwrap_or(94.0),
        request.obstacle_image_dark.as_deref(),
        request.obstacle_image_light.as_deref(),
        request.obstacle_image_mirrored.unwrap_or(false),
        request.obstacle_persist_after_solved.unwrap_or(true),
        request.obstacle_prompt_text.as_deref(),
        request.obstacle_x.unwrap_or(50.0),
        request.obstacle_y.unwrap_or(50.0),
        request.obstacle_width.unwrap_or(28.0),
        request.obstacle_revisit_background_dark.as_deref(),
        request.obstacle_revisit_background_light.as_deref(),
        request
            .obstacle_revisit_background_mirrored
            .unwrap_or(false),
        request.obstacle_revisit_image_dark.as_deref(),
        request.obstacle_revisit_image_light.as_deref(),
        request.obstacle_revisit_image_mirrored.unwrap_or(false),
        request.obstacle_revisit_text.as_deref(),
        request.obstacle_success_animation.as_deref(),
        request.obstacle_success_text.as_deref(),
        request.obstacle_typing_speed.unwrap_or(24.0),
    )
    .map(|form| form.with_graph_position(request.graph_position_x, request.graph_position_y))
    .ok_or_else(ApiError::invalid_request)
}

fn content_api_portal_form(
    request: &CreateActivityRequest,
) -> Result<PortalActivityForm, ApiError> {
    let mode = PortalMode::parse(request.portal_mode.as_deref().unwrap_or("output"))
        .ok_or_else(ApiError::invalid_request)?;
    let assets = request
        .portal_assets
        .as_ref()
        .map(|assets| {
            assets
                .iter()
                .enumerate()
                .map(|(index, asset)| {
                    let generated_id = format!("portal-asset-{}", index + 1);
                    let generated_label = format!("Asset {}", index + 1);
                    PortalAssetForm::parse(
                        asset.id.as_deref().unwrap_or(&generated_id),
                        asset.image_dark.as_deref().unwrap_or_default(),
                        asset.image_light.as_deref().unwrap_or_default(),
                        asset.label.as_deref().unwrap_or(&generated_label),
                        asset.layer.as_deref().unwrap_or("above-background"),
                        asset.mirrored.unwrap_or(false),
                        asset.opacity.unwrap_or(100.0),
                        asset.width.unwrap_or(28.0),
                        asset.x.unwrap_or(50.0),
                        asset.y.unwrap_or(50.0),
                    )
                    .ok_or_else(ApiError::invalid_request)
                })
                .collect::<Result<Vec<_>, _>>()
        })
        .transpose()?
        .unwrap_or_default();
    let target_portal_activity_id = request
        .target_portal_activity_id
        .as_deref()
        .filter(|id| !id.is_empty())
        .map(|id| Uuid::parse_str(id).map_err(|_| ApiError::invalid_request()))
        .transpose()?;
    PortalActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        mode,
        request
            .portal_background_dark
            .as_deref()
            .unwrap_or_default(),
        request
            .portal_background_light
            .as_deref()
            .unwrap_or_default(),
        request.portal_background_mirrored.unwrap_or(false),
        assets,
        request.portal_duration_seconds.unwrap_or(1.5),
        request
            .portal_foreground_dark
            .as_deref()
            .unwrap_or_default(),
        request
            .portal_foreground_light
            .as_deref()
            .unwrap_or_default(),
        request.portal_foreground_mirrored.unwrap_or(false),
        request.portal_foreground_width.unwrap_or(28.0),
        request.portal_foreground_x.unwrap_or(50.0),
        request.portal_foreground_y.unwrap_or(50.0),
        request.portal_show_on_arrival.unwrap_or(true),
        request.portal_swirl_enabled.unwrap_or(true),
        request.portal_bubble_text.as_deref().unwrap_or_default(),
        request.portal_bubble_typing_speed.unwrap_or(24.0),
        request
            .portal_bubble_color_dark
            .as_deref()
            .unwrap_or("#0f172a"),
        request
            .portal_bubble_color_light
            .as_deref()
            .unwrap_or("#ffffff"),
        request
            .portal_bubble_border_color_dark
            .as_deref()
            .unwrap_or("#2dd4bf"),
        request
            .portal_bubble_border_color_light
            .as_deref()
            .unwrap_or("#0891b2"),
        request
            .portal_bubble_text_color_dark
            .as_deref()
            .unwrap_or("#f8fafc"),
        request
            .portal_bubble_text_color_light
            .as_deref()
            .unwrap_or("#0f172a"),
        request.portal_wait_for_enter.unwrap_or(false),
        target_portal_activity_id,
    )
    .map(|form| form.with_graph_position(request.graph_position_x, request.graph_position_y))
    .ok_or_else(ApiError::invalid_request)
}

fn content_api_message_form(
    request: &CreateActivityRequest,
) -> Result<MessageActivityForm, ApiError> {
    let topic_id = request
        .message_topic_id
        .as_deref()
        .filter(|id| !id.is_empty())
        .map(|id| Uuid::parse_str(id).map_err(|_| ApiError::invalid_request()))
        .transpose()?;
    let ui = MessageUi::parse(
        request
            .message_surface_color_dark
            .as_deref()
            .unwrap_or("#071018"),
        request
            .message_surface_color_light
            .as_deref()
            .unwrap_or("#e6f5f2"),
        request
            .message_card_color_dark
            .as_deref()
            .unwrap_or("#13262d"),
        request
            .message_card_color_light
            .as_deref()
            .unwrap_or("#ffffff"),
        request
            .message_card_border_color_dark
            .as_deref()
            .unwrap_or("#2dd4bf"),
        request
            .message_card_border_color_light
            .as_deref()
            .unwrap_or("#0f766e"),
        request
            .message_text_color_dark
            .as_deref()
            .unwrap_or("#f1f5f9"),
        request
            .message_text_color_light
            .as_deref()
            .unwrap_or("#0f172a"),
        request
            .message_accent_color_dark
            .as_deref()
            .unwrap_or("#5eead4"),
        request
            .message_accent_color_light
            .as_deref()
            .unwrap_or("#0f766e"),
    )
    .ok_or_else(ApiError::invalid_request)?;
    MessageActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        &request.activity_type,
        topic_id,
        request.message_topic_title.as_deref().unwrap_or_default(),
        request.message_audience.as_deref().unwrap_or("peers"),
        request.message_allow_responses.unwrap_or(false),
        request
            .message_response_prompt
            .as_deref()
            .unwrap_or_default(),
        request
            .message_prompt_text
            .as_deref()
            .unwrap_or("Leave a helpful note or an encouraging thought for the next learner."),
        request
            .message_input_label
            .as_deref()
            .unwrap_or("Your message"),
        ui,
    )
    .map(|form| form.with_graph_position(request.graph_position_x, request.graph_position_y))
    .ok_or_else(ApiError::invalid_request)
}

fn bounded_position(value: f64, minimum: f64, maximum: f64) -> bool {
    value.is_finite() && (minimum..=maximum).contains(&value)
}

#[derive(FromRow)]
struct MapAssetActivityCount {
    asset_id: Uuid,
    activity_count: i64,
}

async fn load_map_asset_activity_counts(
    database: &PgPool,
    assets: &[AdminEditableMapAsset],
) -> Result<HashMap<Uuid, i64>, sqlx::Error> {
    let asset_ids = assets.iter().map(|asset| asset.id).collect::<Vec<_>>();
    if asset_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let counts = sqlx::query_as::<_, MapAssetActivityCount>(
        "SELECT routes.map_asset_id AS asset_id, COUNT(activities.id)::BIGINT AS activity_count \
         FROM learning_routes AS routes \
         LEFT JOIN learning_activities AS activities ON activities.route_id = routes.id \
         WHERE routes.map_asset_id = ANY($1) \
         GROUP BY routes.map_asset_id",
    )
    .bind(asset_ids)
    .fetch_all(database)
    .await?;

    Ok(counts
        .into_iter()
        .map(|count| (count.asset_id, count.activity_count))
        .collect())
}

fn serialize_map_assets(
    map_id: Uuid,
    assets: &[AdminEditableMapAsset],
    nodes: &[AdminNodeSummary],
    activity_counts: &HashMap<Uuid, i64>,
) -> Vec<Value> {
    let nodes_by_id = nodes
        .iter()
        .map(|node| (node.id, node))
        .collect::<HashMap<_, _>>();

    assets
        .iter()
        .map(|asset| {
            let node = asset
                .node_id
                .and_then(|node_id| nodes_by_id.get(&node_id).copied());

            json!({
                "id": asset.id,
                "mapId": map_id,
                "title": node.map(|node| &node.title),
                "description": node.map(|node| &node.description),
                "imageUrl": asset.image_url,
                "text": asset.text,
                "position": { "x": asset.x, "y": asset.y, "z": asset.z },
                "width": asset.width,
                "opacity": asset.opacity,
                "locked": asset.locked,
                "interactionMode": asset.interaction_mode,
                "interactionConfig": asset.interaction_config,
                "visualConfig": asset.visual_config,
                "soundConfig": asset.sound_config,
                "activityCount": activity_counts.get(&asset.id).copied().unwrap_or_default(),
            })
        })
        .collect()
}

fn serialize_created_map_asset(map_id: Uuid, asset_id: Uuid, form: &WorldMapAssetForm) -> Value {
    json!({
        "id": asset_id,
        "mapId": map_id,
        "title": form.content_title,
        "description": form.content_description,
        "imageUrl": form.image_url,
        "text": form.text,
        "position": { "x": form.position_x, "y": form.position_y, "z": form.position_z },
        "width": form.width,
        "opacity": form.opacity,
        "locked": form.locked,
        "interactionMode": form.interaction_mode,
        "interactionConfig": form.interaction_config,
        "visualConfig": form.visual_config,
        "soundConfig": form.sound_config,
        "activityCount": 0,
    })
}

fn serialize_activity(map_asset_id: Uuid, activity: &ContentApiActivity) -> Value {
    json!({
        "id": activity.id,
        "mapAssetId": map_asset_id,
        "slug": activity.slug,
        "type": activity.activity_type,
        "title": activity.title,
        "introduction": activity.introduction,
        "config": activity.config,
        "position": { "x": activity.position_x, "y": activity.position_y },
    })
}

fn serialize_created_reflective_activity(
    map_asset_id: Uuid,
    created: CreatedReflectionActivity,
    form: &ReflectionActivityForm,
    activity_type: &str,
) -> Value {
    json!({
        "id": created.activity_id,
        "mapAssetId": map_asset_id,
        "slug": created.slug,
        "type": activity_type,
        "title": form.title,
        "introduction": form.introduction,
        "config": {
            "prompt": form.prompt,
            "note": form.note,
            "topic": form.topic,
            "subtopic": form.subtopic,
        },
        "position": { "x": form.graph_position_x, "y": form.graph_position_y },
    })
}

fn serialize_created_open_practice(
    map_asset_id: Uuid,
    created: CreatedOpenPracticeActivity,
    form: &OpenPracticeActivityForm,
) -> Value {
    json!({
        "id": created.activity_id,
        "mapAssetId": map_asset_id,
        "slug": created.slug,
        "type": "open_practice",
        "title": form.title,
        "introduction": form.introduction,
        "config": { "nextStep": form.next_step },
        "position": { "x": form.graph_position_x, "y": form.graph_position_y },
    })
}

fn serialize_created_markdown(
    map_asset_id: Uuid,
    created: CreatedMarkdownActivity,
    form: &wicked_learning_application::admin_world_markdown::MarkdownActivityForm,
) -> Value {
    json!({
        "id": created.activity_id,
        "mapAssetId": map_asset_id,
        "slug": created.slug,
        "type": "markdown",
        "title": form.title,
        "introduction": form.introduction,
        "config": markdown_config(form),
        "position": { "x": form.graph_position_x, "y": form.graph_position_y },
    })
}

fn serialize_created_question(
    map_asset_id: Uuid,
    created: CreatedQuestionActivity,
    form: &QuestionActivityForm,
) -> Value {
    json!({
        "id": created.activity_id,
        "mapAssetId": map_asset_id,
        "slug": created.slug,
        "type": "question",
        "title": form.title,
        "introduction": form.introduction,
        "config": question_config(form),
        "position": { "x": form.graph_position_x, "y": form.graph_position_y },
    })
}

fn serialize_created_shared_task(
    map_asset_id: Uuid,
    created: CreatedSharedTaskActivity,
    form: &SharedTaskActivityForm,
) -> Value {
    json!({
        "id": created.activity_id,
        "mapAssetId": map_asset_id,
        "slug": created.slug,
        "type": "shared_task",
        "title": form.title,
        "introduction": form.introduction,
        "config": shared_task_config(form),
        "position": { "x": form.graph_position_x, "y": form.graph_position_y },
    })
}

fn serialize_created_item_grant(
    map_asset_id: Uuid,
    created: CreatedItemGrantActivity,
    form: &ItemGrantActivityForm,
) -> Value {
    json!({
        "id": created.activity_id,
        "mapAssetId": map_asset_id,
        "slug": created.slug,
        "type": "item_grant",
        "title": form.title,
        "introduction": form.introduction,
        "config": created.config,
        "position": { "x": form.graph_position_x, "y": form.graph_position_y },
    })
}

fn serialize_created_tool_grant(
    map_asset_id: Uuid,
    created: CreatedToolGrantActivity,
    form: &ToolGrantActivityForm,
) -> Value {
    json!({
        "id": created.activity_id, "mapAssetId": map_asset_id, "slug": created.slug,
        "type": "tool_grant", "title": form.title, "introduction": form.introduction,
        "config": created.config,
        "position": { "x": form.graph_position_x, "y": form.graph_position_y },
    })
}

fn serialize_created_item_obstacle(
    map_asset_id: Uuid,
    created: CreatedItemObstacleActivity,
    form: &ItemObstacleActivityForm,
) -> Value {
    json!({
        "id": created.activity_id,
        "mapAssetId": map_asset_id,
        "slug": created.slug,
        "type": "item_obstacle",
        "title": form.title,
        "introduction": form.introduction,
        "config": created.config,
        "position": { "x": form.graph_position_x, "y": form.graph_position_y },
    })
}

fn serialize_created_obstacle(
    map_asset_id: Uuid,
    created: CreatedObstacleActivity,
    form: &ObstacleActivityForm,
) -> Value {
    json!({ "id": created.activity_id, "mapAssetId": map_asset_id, "slug": created.slug,
        "type": "obstacle", "title": form.title, "introduction": form.introduction,
        "config": created.config, "position": { "x": form.graph_position_x, "y": form.graph_position_y } })
}

fn serialize_created_portal(
    map_asset_id: Uuid,
    created: CreatedPortalActivity,
    form: &PortalActivityForm,
) -> Value {
    json!({
        "id": created.activity_id, "mapAssetId": map_asset_id, "slug": created.slug,
        "type": "portal", "title": form.title, "introduction": form.introduction,
        "config": created.config, "position": { "x": form.graph_position_x, "y": form.graph_position_y },
    })
}

fn serialize_created_npc_dialogue(
    map_asset_id: Uuid,
    created: CreatedNpcDialogueActivity,
    form: &NpcDialogueActivityForm,
) -> Value {
    json!({
        "id": created.activity_id, "mapAssetId": map_asset_id, "slug": created.slug,
        "type": "npc_dialogue", "title": form.title, "introduction": form.introduction,
        "config": created.config, "position": { "x": form.graph_position_x, "y": form.graph_position_y },
    })
}

fn serialize_created_message(
    map_asset_id: Uuid,
    created: CreatedMessageActivity,
    form: &MessageActivityForm,
) -> Value {
    json!({
        "id": created.activity_id, "mapAssetId": map_asset_id, "slug": created.slug,
        "type": form.activity_type, "title": form.title, "introduction": form.introduction,
        "config": created.config, "position": { "x": form.graph_position_x, "y": form.graph_position_y },
    })
}

fn document() -> Value {
    json!({
        "name": "Wicked Learning Content API",
        "version": "1.1",
        "basePath": "/api/content/v1",
        "authentication": {
            "type": "session",
            "description": "Requests use the signed-in administrator session. Mutating requests require the page CSRF token in the X-CSRF-Token header."
        },
        "aiInstructions": [
            "Use only operations listed in this contract.",
            "Treat returned IDs as opaque identifiers and reuse them exactly.",
            "Create or select a map before creating MapAssets, then create Activities through the returned MapAsset ID.",
            "Do not invent uploaded media paths. Reuse an existing path supplied by an administrator or leave image_url null.",
            "Show the planned request body to the administrator before sending a mutating request.",
            "Use the ContentPlan schema for AI-assisted drafts and never apply a generated draft without explicit administrator approval.",
            "If validation fails, repair only the fields named in the 422 response and ask before changing the instructional intent."
        ],
        "activityTypes": [
            {
                "key": "reflection",
                "label": "Reflection",
                "description": "A learner-owned pause for useful notes or synthesis.",
                "inputs": [{ "id": "in", "label": "In" }],
                "outputs": [{ "id": "completed", "label": "Completed" }]
            },
            {
                "key": "review",
                "label": "Review / revisit",
                "description": "A learner-owned return to earlier ideas with optional private comparison.",
                "inputs": [{ "id": "in", "label": "In" }],
                "outputs": [{ "id": "completed", "label": "Completed" }]
            },
            {
                "key": "open_practice",
                "label": "Open practice",
                "description": "A quiet pause where the learner chooses and carries out their own next step.",
                "inputs": [{ "id": "in", "label": "In" }],
                "outputs": [{ "id": "completed", "label": "Completed" }]
            },
            {
                "key": "markdown",
                "label": "Markdown",
                "description": "A connected set of readable Markdown pages with theme-specific page colors.",
                "inputs": [{ "id": "in", "label": "In" }],
                "outputs": [{ "id": "completed", "label": "Completed" }]
            },
            {
                "key": "question",
                "label": "Question",
                "description": "A configurable question that can branch by answer outcome.",
                "inputs": [{ "id": "in", "label": "In" }],
                "outputs": [{ "id": "correct", "label": "Correct" }, { "id": "incorrect", "label": "Incorrect" }, { "id": "outcome", "label": "Outcome" }]
            },
            {
                "key": "shared_task",
                "label": "Shared Task",
                "description": "A bounded shared contribution, project, and optional peer-review activity.",
                "inputs": [{ "id": "in", "label": "In" }],
                "outputs": [{ "id": "completed", "label": "Completed" }]
            },
            {
                "key": "item_grant",
                "label": "Item Grant",
                "description": "A server-authorized probability-based grant of catalog items.",
                "inputs": [{ "id": "in", "label": "In" }],
                "outputs": [{ "id": "completed", "label": "Completed" }]
            },
            {
                "key": "tool_grant",
                "label": "Tool Grant",
                "description": "A server-authorized grant of an optional catalog tool with authored scene presentation.",
                "inputs": [{ "id": "in", "label": "In" }],
                "outputs": [{ "id": "completed", "label": "Completed" }]
            },
            {
                "key": "item_obstacle",
                "label": "Item Obstacle",
                "description": "A configured item-gated obstacle with optional transitions and sound effects.",
                "inputs": [{ "id": "in", "label": "In" }],
                "outputs": [{ "id": "notMet", "label": "Not met" }, { "id": "met", "label": "Met" }, { "id": "transition", "label": "Transition" }]
            },
            {
                "key": "obstacle", "label": "Obstacle",
                "description": "A configured tool-gated obstacle with authored solved and revisit states.",
                "inputs": [{ "id": "in", "label": "In" }],
                "outputs": [{ "id": "completed", "label": "Completed" }]
            },
            {
                "key": "portal", "label": "Portal",
                "description": "A map or node travel activity. Entry portals must end their path.",
                "inputs": [{ "id": "in", "label": "In" }],
                "outputs": [{ "id": "travel", "label": "Travel" }]
            },
            {
                "key": "npc_dialogue", "label": "NPC dialogue",
                "description": "A graph-based NPC conversation with one entry and exits defined by dialogue end nodes.",
                "inputs": [{ "id": "in", "label": "Entry" }],
                "outputs": [{ "id": "dialogue-end-pending", "label": "A End" }]
            },
            {
                "key": "message_prompt", "label": "Message prompt",
                "description": "A topic-bound peer or support message prompt.",
                "inputs": [{ "id": "in", "label": "In" }],
                "outputs": [{ "id": "completed", "label": "Completed" }]
            },
            {
                "key": "message_wall", "label": "Message wall",
                "description": "A peer message wall for a topic-bound conversation.",
                "inputs": [{ "id": "in", "label": "In" }],
                "outputs": [{ "id": "completed", "label": "Completed" }]
            }
        ],
        "contentPlan": content_plan_document(),
        "operations": [
            operation("contract.show", "GET", "/api/content/v1/contract", "Read the machine contract", "Returns this versioned document for API consoles and AI context.", Value::Null, json!({ "data": { "version": "1.1", "operations": [] } })),
            operation("maps.index", "GET", "/api/content/v1/maps", "List editable maps", "Returns only maps within the administrator's editable scope.", Value::Null, json!({ "data": [] })),
            operation("maps.store", "POST", "/api/content/v1/maps", "Create a map", "Creates a new map in the current learning world.", json!({ "title": "Engine Bay", "slug": "engine-bay", "description": "An exploratory map of connected vehicle systems." }), json!({ "data": { "id": "opaque-map-id", "slug": "engine-bay", "title": "Engine Bay" } })),
            operation("map-assets.index", "GET", "/api/content/v1/maps/{map}/map-assets", "List MapAssets", "Returns MapAssets and their linked activity counts for one editable map.", Value::Null, json!({ "data": [{ "id": "opaque-map-asset-id", "title": "Alternator", "activityCount": 2 }] })),
            operation("map-assets.store", "POST", "/api/content/v1/maps/{map}/map-assets", "Create a MapAsset", "Creates the learner-facing MapAsset and its internal content node as one authoring operation.", json!({ "title": "Alternator", "description": "Converts mechanical energy into electrical energy.", "image_url": Value::Null, "text": "Alternator", "position_x": 50, "position_y": 50, "position_z": 0, "width": 14, "opacity": 1, "locked": false, "interaction_mode": "focusable", "interaction_config": {}, "visual_config": {}, "sound_config": {} }), json!({ "data": { "id": "opaque-map-asset-id", "mapId": "opaque-map-id", "title": "Alternator", "activityCount": 0 } })),
            operation("activities.index", "GET", "/api/content/v1/map-assets/{mapAsset}/activities", "List MapAsset Activities", "Returns the Activities that form the routes of one editable MapAsset.", Value::Null, json!({ "data": [{ "id": "opaque-activity-id", "type": "reflection", "title": "Explain the energy conversion" }] })),
            operation("activities.store", "POST", "/api/content/v1/map-assets/{mapAsset}/activities", "Create a MapAsset Activity", "Creates a Reflection, Review, Open Practice, Markdown, Question, Shared Task, Item Grant, Tool Grant, Item Obstacle, Obstacle, Portal, NPC dialogue, Message Prompt, or Message Wall Activity through its matching scoped World Builder command.", json!({ "type": "npc_dialogue", "title": "Ask the archive guide", "introduction": "Follow the guide's questions.", "graph_position_x": 120, "graph_position_y": 80 }), json!({ "data": { "id": "opaque-activity-id", "type": "npc_dialogue", "title": "Ask the archive guide" } })),
        ],
        "errors": {
            "401": "No authenticated administration session.",
            "403": "The current role or map scope does not allow this operation.",
            "404": "The requested content object does not exist.",
            "422": "The request body does not satisfy the documented contract."
        }
    })
}

fn content_plan_document() -> Value {
    json!({
        "version": "1.5",
        "purpose": "A reviewable draft for one MapAsset and a short linear learning route.",
        "humanApprovalRequired": true,
        "supportedActivityTypes": ["markdown", "reflection", "message_prompt", "shared_task", "open_practice"],
        "placementDefaults": { "positionX": 50, "positionY": 50, "width": 14 },
        "schema": {
            "type": "object",
            "additionalProperties": false,
            "required": ["summary", "mapAsset", "activities"],
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "A short rationale for the proposed learning route.",
                    "maxLength": 1200,
                },
                "mapAsset": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["title", "description", "label"],
                    "properties": {
                        "title": { "type": "string", "maxLength": 120 },
                        "description": { "type": ["string", "null"], "maxLength": 1000 },
                        "label": { "type": ["string", "null"], "maxLength": 80 },
                    },
                },
                "activities": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 3,
                    "items": {
                        "type": "object",
                        "additionalProperties": false,
                        "required": ["type", "title", "introduction", "body", "prompt", "note", "topic", "inputLabel", "competenceTopics", "learningIntent", "sourceRecordIds"],
                        "properties": {
                            "type": { "type": "string", "enum": ["markdown", "reflection", "message_prompt", "shared_task", "open_practice"] },
                            "title": { "type": "string", "maxLength": 120 },
                            "introduction": { "type": ["string", "null"], "maxLength": 1000 },
                            "body": { "type": ["string", "null"], "description": "Markdown body for markdown activities; null for interactive activities.", "maxLength": 12000 },
                            "prompt": { "type": ["string", "null"], "description": "Learner prompt for reflections, message prompts, shared tasks and open practice; null for markdown activities.", "maxLength": 4000 },
                            "note": { "type": ["string", "null"], "description": "Optional reflection guidance or shared-task instructions; null for markdown activities.", "maxLength": 2000 },
                            "topic": { "type": ["string", "null"], "description": "Shared message topic for message prompts; null for other activity types, including shared tasks.", "maxLength": 120 },
                            "inputLabel": { "type": ["string", "null"], "description": "Optional learner message or shared-task input label; null for other activity types.", "maxLength": 120 },
                            "competenceTopics": { "type": "array", "description": "One to three short competence topic labels this activity intentionally nourishes.", "minItems": 1, "maxItems": 3, "items": { "type": "string", "maxLength": 120 } },
                            "learningIntent": { "type": "string", "description": "The primary learning purpose of this activity, not a grade or performance judgment.", "enum": ["apply", "explain", "participate", "reflect", "retrieve", "review", "transfer"] },
                            "sourceRecordIds": { "type": "array", "description": "IDs of selected source records that directly support this activity; use an empty array when none are directly attributed.", "maxItems": 5, "items": { "type": "integer" } },
                        },
                    },
                },
            },
        },
    })
}

fn operation(
    id: &str,
    method: &str,
    path: &str,
    summary: &str,
    description: &str,
    request_example: Value,
    response_example: Value,
) -> Value {
    json!({
        "id": id,
        "method": method,
        "path": path,
        "summary": summary,
        "description": description,
        "requestExample": request_example,
        "responseExample": response_example,
    })
}

#[cfg(test)]
mod tests {
    use std::collections::{BTreeMap, HashMap};

    use serde_json::json;
    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal,
        world_content::{AdminEditableMapAsset, AdminNodePosition, AdminNodeSummary},
    };

    use super::{
        content_api_item_grant_form, content_api_item_obstacle_form, content_api_message_form,
        content_api_obstacle_form, content_api_portal_form, content_api_shared_task_form,
        content_api_tool_grant_form, document, is_supported_content_api_activity_type,
        require_content_permission, serialize_activity, serialize_created_item_grant,
        serialize_created_item_obstacle, serialize_created_map_asset, serialize_created_markdown,
        serialize_created_message, serialize_created_npc_dialogue, serialize_created_obstacle,
        serialize_created_open_practice, serialize_created_portal, serialize_created_question,
        serialize_created_reflective_activity, serialize_created_shared_task,
        serialize_created_tool_grant, serialize_map_assets,
    };

    #[test]
    fn contract_lists_only_the_available_bounded_authoring_operations() {
        let document = document();
        let operations = document["operations"].as_array().expect("operations array");

        assert_eq!(document["basePath"], "/api/content/v1");
        assert_eq!(operations.len(), 7);
        assert_eq!(operations[0]["id"], "contract.show");
        assert_eq!(operations[2]["id"], "maps.store");
        assert_eq!(operations[3]["id"], "map-assets.index");
        assert_eq!(operations[4]["id"], "map-assets.store");
        assert_eq!(operations[5]["id"], "activities.index");
        assert_eq!(operations[6]["id"], "activities.store");
        assert_eq!(document["activityTypes"][0]["key"], "reflection");
        assert_eq!(document["activityTypes"][1]["key"], "review");
        assert_eq!(document["activityTypes"][3]["key"], "markdown");
        assert_eq!(document["activityTypes"][4]["key"], "question");
        assert_eq!(document["activityTypes"][5]["key"], "shared_task");
        assert_eq!(document["activityTypes"][6]["key"], "item_grant");
        assert_eq!(document["activityTypes"][7]["key"], "tool_grant");
        assert_eq!(document["activityTypes"][8]["key"], "item_obstacle");
        assert_eq!(document["activityTypes"][9]["key"], "obstacle");
        assert_eq!(document["activityTypes"][10]["key"], "portal");
        assert_eq!(document["activityTypes"][11]["key"], "npc_dialogue");
        assert_eq!(document["activityTypes"][12]["key"], "message_prompt");
        assert_eq!(document["activityTypes"][13]["key"], "message_wall");
        assert_eq!(document["contentPlan"]["version"], "1.5");
        assert_eq!(
            document["contentPlan"]["supportedActivityTypes"],
            json!([
                "markdown",
                "reflection",
                "message_prompt",
                "shared_task",
                "open_practice"
            ])
        );
        assert_eq!(
            document["contentPlan"]["schema"]["properties"]["activities"]["items"]["properties"]["learningIntent"]
                ["enum"],
            json!([
                "apply",
                "explain",
                "participate",
                "reflect",
                "retrieve",
                "review",
                "transfer"
            ])
        );
    }

    #[test]
    fn content_api_permission_is_distinct_from_world_builder_permission() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:rud:all".to_owned()],
        };

        assert!(require_content_permission(&principal, "ro").is_err());
    }

    #[test]
    fn content_api_advertises_only_its_typed_activity_creators() {
        assert!(is_supported_content_api_activity_type("reflection"));
        assert!(is_supported_content_api_activity_type("review"));
        assert!(is_supported_content_api_activity_type("open_practice"));
        assert!(is_supported_content_api_activity_type("markdown"));
        assert!(is_supported_content_api_activity_type("question"));
        assert!(is_supported_content_api_activity_type("shared_task"));
        assert!(is_supported_content_api_activity_type("item_grant"));
        assert!(is_supported_content_api_activity_type("tool_grant"));
        assert!(is_supported_content_api_activity_type("item_obstacle"));
        assert!(is_supported_content_api_activity_type("obstacle"));
        assert!(is_supported_content_api_activity_type("portal"));
        assert!(is_supported_content_api_activity_type("npc_dialogue"));
        assert!(is_supported_content_api_activity_type("message_prompt"));
        assert!(is_supported_content_api_activity_type("message_wall"));
        assert!(!is_supported_content_api_activity_type("missing_type"));
    }

    #[test]
    fn map_assets_keep_the_source_shape_and_default_missing_activity_counts() {
        let map_id = Uuid::new_v4();
        let asset_id = Uuid::new_v4();
        let node_id = Uuid::new_v4();
        let assets = vec![AdminEditableMapAsset {
            id: asset_id,
            node_id: Some(node_id),
            image_url: Some("/media/alternator.png".to_owned()),
            text: Some("Alternator".to_owned()),
            x: 50.0,
            y: 40.0,
            z: 2,
            width: 14.0,
            opacity: 1.0,
            locked: false,
            focusable: true,
            interaction_mode: "focusable".to_owned(),
            interaction_config: json!({ "open": "node" }),
            visual_config: json!({ "color": "yellow" }),
            sound_config: json!({}),
        }];
        let nodes = vec![AdminNodeSummary {
            id: node_id,
            slug: "alternator".to_owned(),
            title: "Alternator".to_owned(),
            description: "Converts energy.".to_owned(),
            activity_review_count: 0,
            position: AdminNodePosition { q: 0, r: 0 },
            state: "published".to_owned(),
            visual_config: json!({}),
            unlock_diagnostics: vec![],
        }];

        let data = serialize_map_assets(map_id, &assets, &nodes, &HashMap::new());

        assert_eq!(data[0]["mapId"], map_id.to_string());
        assert_eq!(data[0]["title"], "Alternator");
        assert_eq!(data[0]["description"], "Converts energy.");
        assert_eq!(data[0]["position"], json!({ "x": 50.0, "y": 40.0, "z": 2 }));
        assert_eq!(data[0]["activityCount"], 0);
    }

    #[test]
    fn created_map_asset_keeps_the_content_metadata_and_surface_shape() {
        let map_id = Uuid::new_v4();
        let asset_id = Uuid::new_v4();
        let form = wicked_learning_application::admin_world_map_asset::WorldMapAssetForm::parse(
            None,
            Some("Alternator"),
            50.0,
            40.0,
            2,
            14.0,
            1.0,
            false,
            "focusable",
            json!({}),
            json!({}),
            json!({}),
        )
        .expect("valid map asset form")
        .with_content_metadata("Alternator", Some("Converts energy."))
        .expect("valid content metadata");

        let data = serialize_created_map_asset(map_id, asset_id, &form);

        assert_eq!(data["id"], asset_id.to_string());
        assert_eq!(data["mapId"], map_id.to_string());
        assert_eq!(data["title"], "Alternator");
        assert_eq!(data["description"], "Converts energy.");
        assert_eq!(data["activityCount"], 0);
    }

    #[test]
    fn activities_keep_the_source_shape_for_reads_and_reflective_creates() {
        let map_asset_id = Uuid::new_v4();
        let activity_id = Uuid::new_v4();
        let activity = wicked_learning_application::content_api_activity::ContentApiActivity {
            id: activity_id,
            slug: "energy-reflection".to_owned(),
            activity_type: "reflection".to_owned(),
            title: "Explain energy".to_owned(),
            introduction: Some("Connect the flow.".to_owned()),
            config: json!({ "prompt": "What changed?" }),
            position_x: Some(120.0),
            position_y: Some(80.0),
        };
        let listed = serialize_activity(map_asset_id, &activity);
        let form =
            wicked_learning_application::admin_world_reflection::ReflectionActivityForm::parse(
                "Explain energy",
                None,
                Some("Connect the flow."),
                "What changed?",
                "Name the change.",
                "Vehicle electrics",
                "Alternator",
            )
            .expect("valid reflection")
            .with_graph_position(Some(120), Some(80));
        let created = serialize_created_reflective_activity(
            map_asset_id,
            wicked_learning_application::admin_world_reflection::CreatedReflectionActivity {
                activity_id,
                slug: "energy-reflection-2".to_owned(),
            },
            &form,
            "review",
        );

        assert_eq!(listed["mapAssetId"], map_asset_id.to_string());
        assert_eq!(listed["position"], json!({ "x": 120.0, "y": 80.0 }));
        assert_eq!(created["type"], "review");
        assert_eq!(created["slug"], "energy-reflection-2");
        assert_eq!(created["config"]["prompt"], "What changed?");
        assert_eq!(created["position"], json!({ "x": 120, "y": 80 }));
    }

    #[test]
    fn open_practice_creates_keep_the_source_configuration_shape() {
        let map_asset_id = Uuid::new_v4();
        let activity_id = Uuid::new_v4();
        let form = wicked_learning_application::admin_world_open_practice::OpenPracticeActivityForm::parse(
            "Choose the next repair step",
            None,
            Some("Apply the idea in your own work."),
            Some("Inspect one nearby component and explain why it matters."),
        )
        .expect("valid open practice")
        .with_graph_position(Some(120), None);
        let created = serialize_created_open_practice(
            map_asset_id,
            wicked_learning_application::admin_world_open_practice::CreatedOpenPracticeActivity {
                activity_id,
                slug: "choose-the-next-repair-step-2".to_owned(),
            },
            &form,
        );

        assert_eq!(created["type"], "open_practice");
        assert_eq!(created["slug"], "choose-the-next-repair-step-2");
        assert_eq!(
            created["config"]["nextStep"],
            "Inspect one nearby component and explain why it matters."
        );
        assert_eq!(created["position"], json!({ "x": 120, "y": null }));
    }

    #[test]
    fn markdown_creates_keep_the_source_page_graph_shape() {
        use wicked_learning_application::admin_world_markdown::{
            MarkdownActivityForm, MarkdownGraphLayout, MarkdownPageForm, MarkdownPageVisual,
            MarkdownPosition, MarkdownTransitionForm,
        };

        let map_asset_id = Uuid::new_v4();
        let activity_id = Uuid::new_v4();
        let visual = MarkdownPageVisual::parse(
            "#0f172a", "#ffffff", "#2dd4bf", "#0891b2", "#67e8f9", "#0e7490", "#f8fafc", "#0f172a",
        )
        .expect("valid source colors");
        let page = MarkdownPageForm::parse(
            "briefing",
            "Alternator",
            "# Alternator",
            MarkdownPosition::parse(140.0, 80.0).expect("finite position"),
            visual,
        )
        .expect("valid page");
        let form = MarkdownActivityForm::parse(
            "Read the alternator briefing",
            None,
            Some("Trace the energy conversion."),
            vec![page],
            vec![
                MarkdownTransitionForm::parse("start-briefing", "start", "briefing")
                    .expect("valid transition"),
                MarkdownTransitionForm::parse("briefing-end", "briefing", "end")
                    .expect("valid transition"),
            ],
            MarkdownGraphLayout::default(),
        )
        .expect("valid markdown activity")
        .with_graph_position(Some(120), Some(80));
        let created = serialize_created_markdown(
            map_asset_id,
            wicked_learning_application::admin_world_markdown::CreatedMarkdownActivity {
                activity_id,
                slug: "read-the-alternator-briefing-2".to_owned(),
            },
            &form,
        );

        assert_eq!(created["type"], "markdown");
        assert_eq!(created["slug"], "read-the-alternator-briefing-2");
        assert_eq!(created["config"]["markdownPages"][0]["id"], "briefing");
        assert_eq!(created["position"], json!({ "x": 120, "y": 80 }));
    }

    #[test]
    fn question_creates_keep_the_source_option_configuration_shape() {
        use wicked_learning_application::admin_world_question::{
            QuestionActivityForm, QuestionOptionForm,
        };

        let map_asset_id = Uuid::new_v4();
        let activity_id = Uuid::new_v4();
        let form = QuestionActivityForm::parse(
            "Check the alternator flow",
            None,
            Some("Choose the conversion that fits."),
            "Which conversion best describes an alternator?",
            "Correct.",
            "Try again.",
            "An alternator generates electricity.",
            false,
            vec![
                QuestionOptionForm::parse(
                    "A",
                    "Mechanical energy becomes electrical energy.",
                    true,
                    None,
                    "correct",
                    "Correct.",
                    BTreeMap::new(),
                )
                .expect("valid option"),
                QuestionOptionForm::parse(
                    "B",
                    "Electrical energy becomes mechanical energy.",
                    false,
                    None,
                    "incorrect",
                    "Try again.",
                    BTreeMap::new(),
                )
                .expect("valid option"),
            ],
        )
        .expect("valid question")
        .with_graph_position(Some(120), None);
        let created = serialize_created_question(
            map_asset_id,
            wicked_learning_application::admin_world_question::CreatedQuestionActivity {
                activity_id,
                slug: "check-the-alternator-flow-2".to_owned(),
            },
            &form,
        );

        assert_eq!(created["type"], "question");
        assert_eq!(created["slug"], "check-the-alternator-flow-2");
        assert_eq!(created["config"]["options"][0]["isCorrect"], true);
        assert_eq!(created["position"], json!({ "x": 120, "y": null }));
    }

    #[test]
    fn shared_task_creates_keep_the_source_configuration_shape() {
        use wicked_learning_application::admin_world_shared_task::SharedTaskActivityForm;

        let map_asset_id = Uuid::new_v4();
        let activity_id = Uuid::new_v4();
        let form = SharedTaskActivityForm::parse(
            "Compare repair observations",
            None,
            Some("Add one evidence-based observation."),
            "reflection",
            true,
            "What did you notice during the repair?",
            "Use one concrete detail.",
            "Your reflection",
            "Build a repair record.",
            "One clear observation.",
            vec!["Observe".to_owned(), "Explain".to_owned()],
            true,
            "What does this observation help you notice?",
            3,
            20,
            "once_per_user",
            "minimum_length",
            "none",
        )
        .expect("valid Shared Task")
        .with_graph_position(Some(120), None);
        let created = serialize_created_shared_task(
            map_asset_id,
            wicked_learning_application::admin_world_shared_task::CreatedSharedTaskActivity {
                activity_id,
                slug: "compare-repair-observations-2".to_owned(),
            },
            &form,
        );

        assert_eq!(created["type"], "shared_task");
        assert_eq!(created["slug"], "compare-repair-observations-2");
        assert_eq!(created["config"]["taskKind"], "reflection");
        assert_eq!(
            created["config"]["projectSteps"],
            json!(["Observe", "Explain"])
        );
        assert_eq!(created["position"], json!({ "x": 120, "y": null }));
    }

    #[test]
    fn shared_task_create_defaults_match_the_source_configuration() {
        let request = serde_json::from_value(json!({
            "type": "shared_task",
            "title": "Add one repair observation",
        }))
        .expect("valid partial Shared Task Content API request");
        let Ok(form) = content_api_shared_task_form(&request) else {
            panic!("source defaults are valid");
        };

        assert_eq!(form.task_kind, "text");
        assert_eq!(form.prompt, "Add a useful contribution.");
        assert_eq!(form.input_label, "Your contribution");
        assert_eq!(
            form.peer_review_prompt,
            "What does this contribution help you notice, question, or extend?"
        );
        assert_eq!(form.threshold, 3);
        assert_eq!(form.minimum_length, 20);
    }

    #[test]
    fn item_grant_creates_keep_the_resolved_source_configuration_shape() {
        use wicked_learning_application::admin_world_item_grant::ItemGrantActivityForm;

        let map_asset_id = Uuid::new_v4();
        let activity_id = Uuid::new_v4();
        let form = ItemGrantActivityForm::parse(
            "Collect inspection tags",
            None,
            Some("Collect the configured tools."),
            Some("/api/v1/admin/media-assets/example/content"),
            None,
            false,
            vec![],
            100.0,
        )
        .expect("valid Item Grant")
        .with_graph_position(Some(120), None);
        let created = serialize_created_item_grant(
            map_asset_id,
            wicked_learning_application::admin_world_item_grant::CreatedItemGrantActivity {
                activity_id,
                config: json!({
                    "backgroundDark": "/api/v1/admin/media-assets/example/content",
                    "backgroundLight": "",
                    "backgroundMirrored": false,
                    "items": [{ "itemId": "inspection-tag", "quantity": 1 }],
                    "probabilityPercent": 100.0,
                }),
                slug: "collect-inspection-tags-2".to_owned(),
            },
            &form,
        );

        assert_eq!(created["type"], "item_grant");
        assert_eq!(created["slug"], "collect-inspection-tags-2");
        assert_eq!(created["config"]["items"][0]["itemId"], "inspection-tag");
        assert_eq!(created["position"], json!({ "x": 120, "y": null }));
    }

    #[test]
    fn item_grant_create_defaults_and_catalog_identifiers_are_checked() {
        let request = serde_json::from_value(json!({
            "type": "item_grant",
            "title": "Collect inspection tags",
        }))
        .expect("valid partial Item Grant Content API request");
        let Ok(form) = content_api_item_grant_form(&request) else {
            panic!("source defaults are valid");
        };
        assert!(form.items.is_empty());
        assert_eq!(form.probability_percent, 100.0);

        let invalid = serde_json::from_value(json!({
            "type": "item_grant",
            "title": "Collect inspection tags",
            "item_grant_items": [{ "item_id": "not-a-uuid", "quantity": 1 }],
        }))
        .expect("request itself can be deserialized");
        assert!(content_api_item_grant_form(&invalid).is_err());
    }

    #[test]
    fn tool_grant_create_defaults_and_resolved_configuration_are_preserved() {
        let request = serde_json::from_value(json!({
            "type": "tool_grant",
            "title": "Receive the circuit probe",
        }))
        .expect("valid partial Tool Grant Content API request");
        let Ok(form) = content_api_tool_grant_form(&request) else {
            panic!("source defaults are valid");
        };
        assert_eq!(form.slide_direction, "left");
        assert_eq!(form.typing_speed, 24.0);

        let created = serialize_created_tool_grant(
            Uuid::new_v4(),
            wicked_learning_application::admin_world_tool_grant::CreatedToolGrantActivity {
                activity_id: Uuid::new_v4(),
                config: json!({ "toolId": "circuit-probe", "typingSpeed": 24.0 }),
                slug: "receive-the-circuit-probe".to_owned(),
            },
            &form.with_graph_position(Some(120), None),
        );
        assert_eq!(created["config"]["toolId"], "circuit-probe");
        assert_eq!(created["position"], json!({ "x": 120, "y": null }));
    }

    #[test]
    fn item_obstacle_defaults_and_resolved_configuration_are_preserved() {
        let request = serde_json::from_value(json!({
            "type": "item_obstacle",
            "title": "Open the service bay",
        }))
        .expect("valid partial Item Obstacle Content API request");
        let Ok(form) = content_api_item_obstacle_form(&request) else {
            panic!("source defaults are valid");
        };
        assert_eq!(form.overlay_width, 30.0);
        assert!(form.slots.is_empty());

        let created = serialize_created_item_obstacle(
            Uuid::new_v4(),
            wicked_learning_application::admin_world_item_obstacle::CreatedItemObstacleActivity {
                activity_id: Uuid::new_v4(),
                config: json!({ "slots": [{ "itemId": "service-key", "x": 50.0, "y": 50.0, "width": 10.0 }], "sounds": {} }),
                slug: "open-the-service-bay".to_owned(),
            },
            &form.with_graph_position(Some(120), None),
        );
        assert_eq!(created["config"]["slots"][0]["itemId"], "service-key");
        assert_eq!(created["position"], json!({ "x": 120, "y": null }));
    }

    #[test]
    fn obstacle_defaults_and_resolved_configuration_are_preserved() {
        let request = serde_json::from_value(
            json!({ "type": "obstacle", "title": "Inspect the relay cabinet" }),
        )
        .expect("valid partial Obstacle Content API request");
        let Ok(form) = content_api_obstacle_form(&request) else {
            panic!("source defaults are valid");
        };
        assert!(form.persist_after_solved);
        assert_eq!(form.obstacle_width, 28.0);
        let created = serialize_created_obstacle(
            Uuid::new_v4(),
            wicked_learning_application::admin_world_obstacle::CreatedObstacleActivity {
                activity_id: Uuid::new_v4(),
                config: json!({ "allowedToolIds": ["circuit-probe"], "successAnimation": "zoom" }),
                slug: "inspect-the-relay-cabinet".to_owned(),
            },
            &form.with_graph_position(Some(120), None),
        );
        assert_eq!(created["config"]["allowedToolIds"][0], "circuit-probe");
        assert_eq!(created["position"], json!({ "x": 120, "y": null }));
    }

    #[test]
    fn portal_creates_preserve_source_defaults_target_and_graph_position() {
        let target_portal_activity_id = Uuid::new_v4();
        let request = serde_json::from_value(json!({
            "type": "portal",
            "title": "Enter the relay archive",
            "target_portal_activity_id": target_portal_activity_id,
            "portal_assets": [{ "image_dark": "/media/archive.png" }],
        }))
        .expect("valid partial Portal Content API request");
        let Ok(form) = content_api_portal_form(&request) else {
            panic!("source defaults are valid");
        };
        assert_eq!(form.mode.as_str(), "output");
        assert_eq!(form.assets[0].id, "portal-asset-1");
        assert_eq!(form.assets[0].label, "Asset 1");
        assert_eq!(
            form.target_portal_activity_id,
            Some(target_portal_activity_id)
        );
        assert_eq!(form.duration_seconds, 1.5);

        let created = serialize_created_portal(
            Uuid::new_v4(),
            wicked_learning_application::admin_world_portal::CreatedPortalActivity {
                activity_id: Uuid::new_v4(),
                config: json!({
                    "portalMode": "output",
                    "portalAssets": [{ "id": "portal-asset-1", "imageDark": "/media/archive.png" }],
                    "portalDurationSeconds": 1.5,
                }),
                slug: "enter-the-relay-archive".to_owned(),
            },
            &form.with_graph_position(Some(120), None),
        );
        assert_eq!(created["type"], "portal");
        assert_eq!(created["config"]["portalMode"], "output");
        assert_eq!(
            created["config"]["portalAssets"][0]["imageDark"],
            "/media/archive.png"
        );
        assert_eq!(created["position"], json!({ "x": 120, "y": null }));
    }

    #[test]
    fn npc_dialogue_creates_preserve_its_scaffolded_graph_configuration() {
        let form =
            wicked_learning_application::admin_world_npc_dialogue::NpcDialogueActivityForm::parse(
                "Ask the archive guide",
                None,
                Some("Follow the guide's questions."),
            )
            .expect("valid NPC dialogue")
            .with_graph_position(Some(120), None);
        let created = serialize_created_npc_dialogue(
            Uuid::new_v4(),
            wicked_learning_application::admin_world_npc_dialogue::CreatedNpcDialogueActivity {
                activity_id: Uuid::new_v4(),
                config: json!({ "dialogueGraphLayout": {} }),
                slug: "ask-the-archive-guide".to_owned(),
            },
            &form,
        );
        assert_eq!(created["type"], "npc_dialogue");
        assert_eq!(created["config"]["dialogueGraphLayout"], json!({}));
        assert_eq!(created["position"], json!({ "x": 120, "y": null }));
    }

    #[test]
    fn message_creates_preserve_topic_configuration_and_source_defaults() {
        let request = serde_json::from_value(json!({
            "type": "message_prompt", "title": "Leave a repair note", "message_topic_title": "Relay cabinet notes",
        })).expect("valid partial Message Content API request");
        let Ok(form) = content_api_message_form(&request) else {
            panic!("source defaults are valid");
        };
        assert_eq!(
            form.prompt,
            "Leave a helpful note or an encouraging thought for the next learner."
        );
        assert_eq!(form.ui.surface_color_dark, "#071018");
        let created = serialize_created_message(
            Uuid::new_v4(),
            wicked_learning_application::admin_world_message::CreatedMessageActivity {
                activity_id: Uuid::new_v4(),
                config: json!({ "messageTopicId": Uuid::new_v4(), "messageAudience": "peers" }),
                slug: "leave-a-repair-note".to_owned(),
            },
            &form.with_graph_position(Some(120), None),
        );
        assert_eq!(created["type"], "message_prompt");
        assert_eq!(created["config"]["messageAudience"], "peers");
        assert_eq!(created["position"], json!({ "x": 120, "y": null }));
    }
}
