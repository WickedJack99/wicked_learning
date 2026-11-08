use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::admin_world_map_layout::{
    AdminWorldMapLayoutCommand, AdminWorldMapLayoutHistoryQuery, HexPosition,
};
use wicked_learning_persistence::admin_world_map_layout::PostgresAdminWorldMapLayoutRepository;

#[derive(Deserialize)]
pub struct PositionRequest {
    q: i32,
    r: i32,
}
#[derive(Deserialize)]
pub struct DirectionRequest {
    q: i32,
    r: i32,
}
#[derive(Deserialize)]
pub struct PageQuery {
    #[serde(default = "one")]
    page: u32,
    #[serde(default = "six")]
    per_page: u32,
}
fn one() -> u32 {
    1
}
fn six() -> u32 {
    6
}
fn position(value: PositionRequest) -> HexPosition {
    HexPosition {
        q: value.q,
        r: value.r,
    }
}
fn direction(value: DirectionRequest) -> Result<HexPosition, ApiError> {
    let direction = HexPosition {
        q: value.q,
        r: value.r,
    };
    direction
        .is_neighbor_direction()
        .then_some(direction)
        .ok_or_else(ApiError::invalid_request)
}
pub async fn update_node(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
    Json(body): Json<PositionRequest>,
) -> Result<Json<HexPosition>, ApiError> {
    let id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let p = position(body);
    let principal = authenticated_principal(&state, auth).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repo = PostgresAdminWorldMapLayoutRepository::new(&state.application_database);
    let p = AdminWorldMapLayoutCommand::new(&repo)
        .update_node_position(&principal, id, p)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(p))
}
pub async fn swap_node(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
    Json(body): Json<DirectionRequest>,
) -> Result<StatusCode, ApiError> {
    let id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let direction = direction(body)?;
    let principal = authenticated_principal(&state, auth).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repo = PostgresAdminWorldMapLayoutRepository::new(&state.application_database);
    let swapped = AdminWorldMapLayoutCommand::new(&repo)
        .swap_node_position(&principal, id, direction)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    swapped
        .then_some(StatusCode::NO_CONTENT)
        .ok_or_else(ApiError::not_found)
}
pub async fn versions(
    State(state): State<AppState>,
    Path(map_id): Path<String>,
    auth: AuthSession<IdentityBackend>,
    Query(query): Query<PageQuery>,
) -> Result<Json<wicked_learning_application::admin_world_map_layout::MapLayoutVersionPage>, ApiError>
{
    let id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth).await?;
    let repo = PostgresAdminWorldMapLayoutRepository::new(&state.application_database);
    AdminWorldMapLayoutHistoryQuery::new(&repo)
        .list(&principal, id, query.page, query.per_page)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
pub async fn preview(
    State(state): State<AppState>,
    Path((map_id, version_id)): Path<(String, String)>,
    auth: AuthSession<IdentityBackend>,
    Query(query): Query<PageQuery>,
) -> Result<Json<wicked_learning_application::admin_world_map_layout::MapLayoutPreviewPage>, ApiError>
{
    let map = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let version = Uuid::parse_str(&version_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth).await?;
    let repo = PostgresAdminWorldMapLayoutRepository::new(&state.application_database);
    AdminWorldMapLayoutHistoryQuery::new(&repo)
        .preview(&principal, map, version, query.page, query.per_page)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
pub async fn restore(
    State(state): State<AppState>,
    Path((map_id, version_id)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let map = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let version = Uuid::parse_str(&version_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repo = PostgresAdminWorldMapLayoutRepository::new(&state.application_database);
    AdminWorldMapLayoutCommand::new(&repo)
        .restore(&principal, map, version)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(StatusCode::NO_CONTENT)
}
