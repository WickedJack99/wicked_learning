use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use wicked_learning_application::admin_world_map_asset::{
    AdminWorldMapAssetCommand, AdminWorldMapAssetHistoryQuery, MapAssetVersionPage,
    RestoreWorldMapAssetVersionCommand, WorldMapAssetForm,
};
use wicked_learning_application::admin_world_map_layout::HexPosition;
use wicked_learning_persistence::admin_world_map_asset::PostgresAdminWorldMapAssetRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct MapAssetRequest {
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

#[derive(Serialize)]
pub struct CreateMapAssetResponse {
    pub asset_id: Uuid,
    pub node_id: Uuid,
}

#[derive(Deserialize)]
pub struct InsertMapAssetRequest {
    direction: InsertDirectionRequest,
    asset: MapAssetRequest,
}

#[derive(Deserialize)]
pub struct InsertDirectionRequest {
    q: i32,
    r: i32,
}

#[derive(Deserialize)]
pub struct MapAssetVersionsQuery {
    #[serde(default = "default_page")]
    page: u32,
    #[serde(default = "default_per_page")]
    per_page: u32,
}

fn default_page() -> u32 {
    1
}

fn default_per_page() -> u32 {
    4
}

#[derive(Serialize)]
pub struct MapAssetVersionResponse {
    pub id: Uuid,
    pub image_url: Option<String>,
    pub text: Option<String>,
    pub position_x: f64,
    pub position_y: f64,
    pub position_z: i32,
    pub width: f64,
    pub opacity: f64,
    pub locked: bool,
    pub interaction_mode: String,
    pub interaction_config: Value,
    pub visual_config: Value,
    pub sound_config: Value,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct MapAssetVersionsResponse {
    pub items: Vec<MapAssetVersionResponse>,
    pub page: u32,
    pub per_page: u32,
    pub total: u64,
    pub last_page: u32,
}

#[derive(Serialize)]
pub struct RestoreMapAssetVersionResponse {
    pub asset_id: Uuid,
    pub image_url: Option<String>,
    pub text: Option<String>,
    pub position_x: f64,
    pub position_y: f64,
    pub position_z: i32,
    pub width: f64,
    pub opacity: f64,
    pub locked: bool,
    pub interaction_mode: String,
    pub interaction_config: Value,
    pub visual_config: Value,
    pub sound_config: Value,
}

fn empty_object() -> Value {
    Value::Object(Default::default())
}

fn form(request: MapAssetRequest) -> Result<WorldMapAssetForm, ApiError> {
    WorldMapAssetForm::parse(
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
    .ok_or_else(ApiError::invalid_request)
}

/// Adds the source MapAsset and the compatibility node which keeps the current
/// activity editor connected to the new learner-facing place.
pub async fn create(
    State(state): State<AppState>,
    Path(map_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<MapAssetRequest>,
) -> Result<(StatusCode, Json<CreateMapAssetResponse>), ApiError> {
    let map_id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let form = form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapAssetRepository::new(&state.application_database);
    let created = AdminWorldMapAssetCommand::new(&repository)
        .create(&principal, map_id, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateMapAssetResponse {
            asset_id: created.asset_id,
            node_id: created.node_id,
        }),
    ))
}

/// Inserts a new source MapAsset tile between an existing tile and an occupied
/// neighbour, shifting that complete directional chain atomically.
pub async fn insert(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<InsertMapAssetRequest>,
) -> Result<(StatusCode, Json<CreateMapAssetResponse>), ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let direction = HexPosition {
        q: request.direction.q,
        r: request.direction.r,
    };
    if !direction.is_neighbor_direction() {
        return Err(ApiError::invalid_request());
    }
    let form = form(request.asset)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapAssetRepository::new(&state.application_database);
    let created = AdminWorldMapAssetCommand::new(&repository)
        .insert(&principal, node_id, direction, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateMapAssetResponse {
            asset_id: created.asset_id,
            node_id: created.node_id,
        }),
    ))
}

pub async fn update(
    State(state): State<AppState>,
    Path(asset_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<MapAssetRequest>,
) -> Result<StatusCode, ApiError> {
    let asset_id = Uuid::parse_str(&asset_id).map_err(|_| ApiError::not_found())?;
    let form = form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapAssetRepository::new(&state.application_database);
    AdminWorldMapAssetCommand::new(&repository)
        .update(&principal, asset_id, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .then_some(StatusCode::NO_CONTENT)
        .ok_or_else(ApiError::not_found)
}

pub async fn versions(
    State(state): State<AppState>,
    Path(asset_id): Path<String>,
    auth_session: AuthSession<IdentityBackend>,
    Query(query): Query<MapAssetVersionsQuery>,
) -> Result<Json<MapAssetVersionsResponse>, ApiError> {
    let asset_id = Uuid::parse_str(&asset_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminWorldMapAssetRepository::new(&state.application_database);
    let page = AdminWorldMapAssetHistoryQuery::new(&repository)
        .execute(&principal, asset_id, query.page, query.per_page)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(version_response(page)))
}

pub async fn restore(
    State(state): State<AppState>,
    Path((asset_id, version_id)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<RestoreMapAssetVersionResponse>, ApiError> {
    let asset_id = Uuid::parse_str(&asset_id).map_err(|_| ApiError::not_found())?;
    let version_id = Uuid::parse_str(&version_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapAssetRepository::new(&state.application_database);
    let restored = RestoreWorldMapAssetVersionCommand::new(&repository)
        .execute(&principal, asset_id, version_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(RestoreMapAssetVersionResponse {
        asset_id: restored.asset_id,
        image_url: restored.form.image_url,
        text: restored.form.text,
        position_x: restored.form.position_x,
        position_y: restored.form.position_y,
        position_z: restored.form.position_z,
        width: restored.form.width,
        opacity: restored.form.opacity,
        locked: restored.form.locked,
        interaction_mode: restored.form.interaction_mode,
        interaction_config: restored.form.interaction_config,
        visual_config: restored.form.visual_config,
        sound_config: restored.form.sound_config,
    }))
}

fn version_response(page: MapAssetVersionPage) -> MapAssetVersionsResponse {
    let last_page = if page.total == 0 {
        1
    } else {
        page.total.div_ceil(u64::from(page.per_page)) as u32
    };
    MapAssetVersionsResponse {
        items: page
            .items
            .into_iter()
            .map(|version| MapAssetVersionResponse {
                id: version.id,
                image_url: version.image_url,
                text: version.text,
                position_x: version.position_x,
                position_y: version.position_y,
                position_z: version.position_z,
                width: version.width,
                opacity: version.opacity,
                locked: version.locked,
                interaction_mode: version.interaction_mode,
                interaction_config: version.interaction_config,
                visual_config: version.visual_config,
                sound_config: version.sound_config,
                created_at: version.created_at,
            })
            .collect(),
        page: page.page,
        per_page: page.per_page,
        total: page.total,
        last_page,
    }
}

pub async fn delete(
    State(state): State<AppState>,
    Path(asset_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let asset_id = Uuid::parse_str(&asset_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapAssetRepository::new(&state.application_database);
    AdminWorldMapAssetCommand::new(&repository)
        .delete(&principal, asset_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .then_some(StatusCode::NO_CONTENT)
        .ok_or_else(ApiError::not_found)
}

#[cfg(test)]
mod tests {
    use super::MapAssetRequest;

    #[test]
    fn source_geometry_is_required_while_optional_configs_default_to_objects() {
        let request = serde_json::from_str::<MapAssetRequest>(r#"{"position_x":50,"position_y":50,"position_z":0,"width":14,"opacity":1,"interaction_mode":"focusable"}"#).expect("complete source geometry parses");
        assert!(request.visual_config.is_object());
        assert!(serde_json::from_str::<MapAssetRequest>(r#"{"position_x":50,"position_y":50,"width":14,"opacity":1,"interaction_mode":"focusable"}"#).is_err());
    }
}
