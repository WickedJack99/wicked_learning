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
    admin_world_map_create::{AdminWorldMapCreateCommand, CreateWorldMapForm},
};
use wicked_learning_domain::world_content::{AdminEditableMapAsset, AdminNodeSummary};
use wicked_learning_persistence::{
    admin_world_graph::PostgresAdminWorldGraphRepository,
    admin_world_map::PostgresAdminWorldMapRepository,
    admin_world_map_create::PostgresAdminWorldMapCreateRepository,
};

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
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
        "activityTypes": [],
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

    use super::{document, require_content_permission, serialize_map_assets};

    #[test]
    fn contract_lists_only_the_available_bounded_authoring_operations() {
        let document = document();
        let operations = document["operations"].as_array().expect("operations array");

        assert_eq!(document["basePath"], "/api/content/v1");
        assert_eq!(operations.len(), 4);
        assert_eq!(operations[0]["id"], "contract.show");
        assert_eq!(operations[2]["id"], "maps.store");
        assert_eq!(operations[3]["id"], "map-assets.index");
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
}
