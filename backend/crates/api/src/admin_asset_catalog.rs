use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::admin_asset_catalog::{
    AdminAssetCatalogCommand, AdminAssetCatalogError, ItemForm, ToolForm,
};
use wicked_learning_domain::world_content::{AdminEditableItem, AdminEditableTool};
use wicked_learning_persistence::admin_asset_catalog::PostgresAdminAssetCatalogRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct ItemRequest {
    title: String,
    slug: Option<String>,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
}

#[derive(Deserialize)]
pub struct ToolRequest {
    title: String,
    slug: Option<String>,
    description: Option<String>,
    image_dark: Option<String>,
    image_light: Option<String>,
    animation_dark: Option<String>,
    animation_light: Option<String>,
    animation_duration_seconds: Option<f64>,
    animation_width_percent: Option<f64>,
    image_width_percent: Option<f64>,
}

#[derive(Serialize)]
pub struct ItemListResponse {
    pub items: Vec<AdminEditableItem>,
}
#[derive(Serialize)]
pub struct ItemResponse {
    pub item: AdminEditableItem,
}
#[derive(Serialize)]
pub struct ToolListResponse {
    pub tools: Vec<AdminEditableTool>,
}
#[derive(Serialize)]
pub struct ToolResponse {
    pub tool: AdminEditableTool,
}

pub async fn list_items(
    State(state): State<AppState>,
    session: AuthSession<IdentityBackend>,
) -> Result<Json<ItemListResponse>, ApiError> {
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminAssetCatalogRepository::new(&state.application_database);
    let items = AdminAssetCatalogCommand::new(&repository)
        .list_items(&principal)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(ItemListResponse { items }))
}

pub async fn create_item(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<ItemRequest>,
) -> Result<(StatusCode, Json<ItemResponse>), ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let form = item_form(request)?;
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminAssetCatalogRepository::new(&state.application_database);
    let item = AdminAssetCatalogCommand::new(&repository)
        .create_item(&principal, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((StatusCode::CREATED, Json(ItemResponse { item })))
}

pub async fn update_item(
    State(state): State<AppState>,
    Path(item_id): Path<Uuid>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<ItemRequest>,
) -> Result<Json<ItemResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let form = item_form(request)?;
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminAssetCatalogRepository::new(&state.application_database);
    let item = AdminAssetCatalogCommand::new(&repository)
        .update_item(&principal, item_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(ItemResponse { item }))
}

pub async fn list_tools(
    State(state): State<AppState>,
    session: AuthSession<IdentityBackend>,
) -> Result<Json<ToolListResponse>, ApiError> {
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminAssetCatalogRepository::new(&state.application_database);
    let tools = AdminAssetCatalogCommand::new(&repository)
        .list_tools(&principal)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(ToolListResponse { tools }))
}

pub async fn create_tool(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<ToolRequest>,
) -> Result<(StatusCode, Json<ToolResponse>), ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let form = tool_form(request)?;
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminAssetCatalogRepository::new(&state.application_database);
    let tool = AdminAssetCatalogCommand::new(&repository)
        .create_tool(&principal, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((StatusCode::CREATED, Json(ToolResponse { tool })))
}

pub async fn update_tool(
    State(state): State<AppState>,
    Path(tool_id): Path<Uuid>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<ToolRequest>,
) -> Result<Json<ToolResponse>, ApiError> {
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let form = tool_form(request)?;
    let principal = authenticated_principal(&state, session).await?;
    let repository = PostgresAdminAssetCatalogRepository::new(&state.application_database);
    let tool = AdminAssetCatalogCommand::new(&repository)
        .update_tool(&principal, tool_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(ToolResponse { tool }))
}

fn item_form(request: ItemRequest) -> Result<ItemForm, ApiError> {
    ItemForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.description.as_deref(),
        request.image_dark.as_deref(),
        request.image_light.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)
}

fn tool_form(request: ToolRequest) -> Result<ToolForm, ApiError> {
    ToolForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.description.as_deref(),
        request.image_dark.as_deref(),
        request.image_light.as_deref(),
        request.animation_dark.as_deref(),
        request.animation_light.as_deref(),
        request.animation_duration_seconds,
        request.animation_width_percent,
        request.image_width_percent,
    )
    .ok_or_else(ApiError::invalid_request)
}

fn map_error(error: AdminAssetCatalogError) -> ApiError {
    match error {
        AdminAssetCatalogError::Conflict => ApiError::conflict(),
        AdminAssetCatalogError::Invalid => ApiError::invalid_request(),
        AdminAssetCatalogError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::{ItemRequest, ToolRequest, item_form, tool_form};

    #[test]
    fn rejects_invalid_catalog_forms_before_persistence() {
        let item: ItemRequest = serde_json::from_str(
            r#"{"title":"","slug":null,"description":null,"image_dark":null,"image_light":null}"#,
        )
        .expect("item request");
        assert!(item_form(item).is_err());
        let tool: ToolRequest = serde_json::from_str(r#"{"title":"Lens","slug":null,"description":null,"image_dark":null,"image_light":null,"animation_dark":null,"animation_light":null,"animation_duration_seconds":0,"animation_width_percent":101,"image_width_percent":16}"#).expect("tool request");
        assert!(tool_form(tool).is_err());
    }
}
