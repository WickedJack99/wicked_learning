use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use wicked_learning_application::{
    admin_world_map_layout::HexPosition,
    admin_world_node::AdminWorldNodeQuery,
    admin_world_node_write::{AdminWorldNodeWriteCommand, WorldNodeForm},
};
use wicked_learning_domain::world_content::AdminEditableNode;
use wicked_learning_persistence::{
    admin_world_node::PostgresAdminWorldNodeRepository,
    admin_world_node_write::PostgresAdminWorldNodeWriteRepository,
};

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct NodeRequest {
    title: String,
    slug: Option<String>,
    description: Option<String>,
    position_q: i32,
    position_r: i32,
    state: String,
    #[serde(default = "empty_object")]
    visual_config: Value,
}

#[derive(Deserialize)]
pub struct InsertNodeRequest {
    direction: DirectionRequest,
    node: NodeRequest,
}

#[derive(Deserialize)]
pub struct DirectionRequest {
    q: i32,
    r: i32,
}

#[derive(Serialize)]
pub struct CreateNodeResponse {
    pub node_id: Uuid,
    pub asset_id: Uuid,
}

fn empty_object() -> Value {
    Value::Object(Default::default())
}

fn form(request: NodeRequest) -> Result<WorldNodeForm, ApiError> {
    WorldNodeForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.description.as_deref(),
        HexPosition {
            q: request.position_q,
            r: request.position_r,
        },
        &request.state,
        request.visual_config,
    )
    .ok_or_else(ApiError::invalid_request)
}

/// Reads the original World Builder's selected-node activity graph. This is a
/// read-only prerequisite for lifting its existing React editor; no authoring
/// mutation is enabled by this route.
pub async fn show(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminEditableNode>, ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminWorldNodeRepository::new(&state.application_database);

    AdminWorldNodeQuery::new(&repository)
        .execute(&principal, node_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

/// Creates the source node, its default MapAsset and its draft route in one
/// command. Activity authoring stays on the selected-node contract.
pub async fn create(
    State(state): State<AppState>,
    Path(map_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<NodeRequest>,
) -> Result<(StatusCode, Json<CreateNodeResponse>), ApiError> {
    let map_id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let form = form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNodeWriteRepository::new(&state.application_database);
    let created = AdminWorldNodeWriteCommand::new(&repository)
        .create(&principal, map_id, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateNodeResponse {
            node_id: created.node_id,
            asset_id: created.asset_id,
        }),
    ))
}

pub async fn insert(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<InsertNodeRequest>,
) -> Result<(StatusCode, Json<CreateNodeResponse>), ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let direction = HexPosition {
        q: request.direction.q,
        r: request.direction.r,
    };
    if !direction.is_neighbor_direction() {
        return Err(ApiError::invalid_request());
    }
    let form = form(request.node)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNodeWriteRepository::new(&state.application_database);
    let created = AdminWorldNodeWriteCommand::new(&repository)
        .insert(&principal, node_id, direction, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateNodeResponse {
            node_id: created.node_id,
            asset_id: created.asset_id,
        }),
    ))
}

pub async fn update(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<NodeRequest>,
) -> Result<StatusCode, ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let form = form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNodeWriteRepository::new(&state.application_database);
    AdminWorldNodeWriteCommand::new(&repository)
        .update(&principal, node_id, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .then_some(StatusCode::NO_CONTENT)
        .ok_or_else(ApiError::not_found)
}

pub async fn delete(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNodeWriteRepository::new(&state.application_database);
    AdminWorldNodeWriteCommand::new(&repository)
        .delete(&principal, node_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .then_some(StatusCode::NO_CONTENT)
        .ok_or_else(ApiError::not_found)
}

#[cfg(test)]
mod tests {
    use super::NodeRequest;

    #[test]
    fn source_node_request_defaults_its_optional_visual_config() {
        let request = serde_json::from_str::<NodeRequest>(
            r#"{"title":"Tile","position_q":0,"position_r":0,"state":"available"}"#,
        )
        .expect("source node request");
        assert!(request.visual_config.is_object());
    }
}
