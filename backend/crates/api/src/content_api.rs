use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{FromRow, PgPool};
use std::collections::HashMap;
use uuid::Uuid;
use wicked_learning_application::{
    admin_world_graph::AdminWorldGraphQuery,
    admin_world_map::AdminWorldMapQuery,
    admin_world_map_asset::{AdminWorldMapAssetCommand, WorldMapAssetForm},
    admin_world_map_create::{AdminWorldMapCreateCommand, CreateWorldMapForm},
    admin_world_markdown::{
        AdminWorldMarkdownCommand, AdminWorldMarkdownError, CreatedMarkdownActivity,
    },
    admin_world_open_practice::{
        AdminWorldOpenPracticeCommand, AdminWorldOpenPracticeError, CreatedOpenPracticeActivity,
        OpenPracticeActivityForm,
    },
    admin_world_reflection::{
        AdminWorldReflectionCommand, AdminWorldReflectionError, AdminWorldReviewCommand,
        CreatedReflectionActivity, DEFAULT_REFLECTION_PROMPT, ReflectionActivityForm,
    },
    content_api_activity::{
        ContentApiActivity, ContentApiActivityListQuery, ContentApiActivityNodeQuery,
    },
};
use wicked_learning_domain::world_content::{AdminEditableMapAsset, AdminNodeSummary};
use wicked_learning_persistence::{
    admin_world_graph::PostgresAdminWorldGraphRepository,
    admin_world_map::PostgresAdminWorldMapRepository,
    admin_world_map_asset::PostgresAdminWorldMapAssetRepository,
    admin_world_map_create::PostgresAdminWorldMapCreateRepository,
    admin_world_markdown::{PostgresAdminWorldMarkdownRepository, markdown_config},
    admin_world_open_practice::PostgresAdminWorldOpenPracticeRepository,
    admin_world_reflection::PostgresAdminWorldReflectionRepository,
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
    graph_position_x: Option<i32>,
    graph_position_y: Option<i32>,
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
        "reflection" | "review" | "open_practice" | "markdown"
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
            }
        ],
        "contentPlan": {
            "humanApprovalRequired": true,
            "placementDefaults": { "positionX": 50, "positionY": 50, "width": 14 },
            "purpose": "Structured AI-assisted authoring drafts require administrator review before content is created.",
            "schema": {},
            "supportedActivityTypes": [],
            "version": "1.5"
        },
        "operations": [
            operation("contract.show", "GET", "/api/content/v1/contract", "Read the machine contract", "Returns this versioned document for API consoles and AI context.", Value::Null, json!({ "data": { "version": "1.1", "operations": [] } })),
            operation("maps.index", "GET", "/api/content/v1/maps", "List editable maps", "Returns only maps within the administrator's editable scope.", Value::Null, json!({ "data": [] })),
            operation("maps.store", "POST", "/api/content/v1/maps", "Create a map", "Creates a new map in the current learning world.", json!({ "title": "Engine Bay", "slug": "engine-bay", "description": "An exploratory map of connected vehicle systems." }), json!({ "data": { "id": "opaque-map-id", "slug": "engine-bay", "title": "Engine Bay" } })),
            operation("map-assets.index", "GET", "/api/content/v1/maps/{map}/map-assets", "List MapAssets", "Returns MapAssets and their linked activity counts for one editable map.", Value::Null, json!({ "data": [{ "id": "opaque-map-asset-id", "title": "Alternator", "activityCount": 2 }] })),
            operation("map-assets.store", "POST", "/api/content/v1/maps/{map}/map-assets", "Create a MapAsset", "Creates the learner-facing MapAsset and its internal content node as one authoring operation.", json!({ "title": "Alternator", "description": "Converts mechanical energy into electrical energy.", "image_url": Value::Null, "text": "Alternator", "position_x": 50, "position_y": 50, "position_z": 0, "width": 14, "opacity": 1, "locked": false, "interaction_mode": "focusable", "interaction_config": {}, "visual_config": {}, "sound_config": {} }), json!({ "data": { "id": "opaque-map-asset-id", "mapId": "opaque-map-id", "title": "Alternator", "activityCount": 0 } })),
            operation("activities.index", "GET", "/api/content/v1/map-assets/{mapAsset}/activities", "List MapAsset Activities", "Returns the Activities that form the routes of one editable MapAsset.", Value::Null, json!({ "data": [{ "id": "opaque-activity-id", "type": "reflection", "title": "Explain the energy conversion" }] })),
            operation("activities.store", "POST", "/api/content/v1/map-assets/{mapAsset}/activities", "Create a MapAsset Activity", "Creates a Reflection, Review, Open Practice, or Markdown Activity through its matching scoped World Builder command.", json!({ "type": "markdown", "title": "Read the alternator briefing", "slug": "alternator-briefing", "introduction": "Trace the energy conversion before inspecting the component.", "markdown_pages": [{ "id": "briefing", "title": "Alternator", "body": "# Alternator\n\nFollow the energy flow.", "position": { "x": 140, "y": 80 }, "visual": { "page_color_dark": "#0f172a", "page_color_light": "#ffffff", "border_color_dark": "#2dd4bf", "border_color_light": "#0891b2", "heading_color_dark": "#67e8f9", "heading_color_light": "#0e7490", "text_color_dark": "#f8fafc", "text_color_light": "#0f172a" } }], "markdown_transitions": [{ "id": "start-briefing", "from": "start", "to": "briefing" }, { "id": "briefing-end", "from": "briefing", "to": "end" }], "markdown_graph_layout": {}, "graph_position_x": 120, "graph_position_y": 80 }), json!({ "data": { "id": "opaque-activity-id", "type": "markdown", "title": "Read the alternator briefing" } })),
        ],
        "errors": {
            "401": "No authenticated administration session.",
            "403": "The current role or map scope does not allow this operation.",
            "404": "The requested content object does not exist.",
            "422": "The request body does not satisfy the documented contract."
        }
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
    use std::collections::HashMap;

    use serde_json::json;
    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal,
        world_content::{AdminEditableMapAsset, AdminNodePosition, AdminNodeSummary},
    };

    use super::{
        document, is_supported_content_api_activity_type, require_content_permission,
        serialize_activity, serialize_created_map_asset, serialize_created_markdown,
        serialize_created_open_practice, serialize_created_reflective_activity,
        serialize_map_assets,
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
        assert!(!is_supported_content_api_activity_type("question"));
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
}
