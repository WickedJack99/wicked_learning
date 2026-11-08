use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use wicked_learning_application::admin_world_map_asset::{
    AdminWorldMapAssetCommand, WorldMapAssetForm,
};
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
