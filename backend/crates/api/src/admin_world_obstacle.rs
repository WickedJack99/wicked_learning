use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_application::admin_world_obstacle::{
    AdminWorldObstacleCommand, AdminWorldObstacleError, ObstacleActivityForm,
};
use wicked_learning_persistence::admin_world_obstacle::PostgresAdminWorldObstacleRepository;

#[derive(Deserialize)]
pub struct CreateObstacleRequest {
    title: String,
    slug: Option<String>,
    introduction: Option<String>,
    allowed_tool_ids: Option<Vec<String>>,
    background_dark: Option<String>,
    background_light: Option<String>,
    background_mirrored: Option<bool>,
    bubble_border_color_dark: Option<String>,
    bubble_border_color_light: Option<String>,
    bubble_color_dark: Option<String>,
    bubble_color_light: Option<String>,
    bubble_opacity_dark: Option<f64>,
    bubble_opacity_light: Option<f64>,
    obstacle_image_dark: Option<String>,
    obstacle_image_light: Option<String>,
    obstacle_image_mirrored: Option<bool>,
    persist_after_solved: Option<bool>,
    prompt_text: Option<String>,
    obstacle_x: Option<f64>,
    obstacle_y: Option<f64>,
    obstacle_width: Option<f64>,
    revisit_background_dark: Option<String>,
    revisit_background_light: Option<String>,
    revisit_background_mirrored: Option<bool>,
    revisit_image_dark: Option<String>,
    revisit_image_light: Option<String>,
    revisit_image_mirrored: Option<bool>,
    revisit_text: Option<String>,
    success_animation: Option<String>,
    success_text: Option<String>,
    typing_speed: Option<f64>,
}

#[derive(Deserialize)]
pub struct UpdateObstacleRequest {
    title: String,
    slug: NullableString,
    introduction: NullableString,
    allowed_tool_ids: Vec<String>,
    background_dark: NullableString,
    background_light: NullableString,
    background_mirrored: bool,
    bubble_border_color_dark: NullableString,
    bubble_border_color_light: NullableString,
    bubble_color_dark: NullableString,
    bubble_color_light: NullableString,
    bubble_opacity_dark: f64,
    bubble_opacity_light: f64,
    obstacle_image_dark: NullableString,
    obstacle_image_light: NullableString,
    obstacle_image_mirrored: bool,
    persist_after_solved: bool,
    prompt_text: NullableString,
    obstacle_x: f64,
    obstacle_y: f64,
    obstacle_width: f64,
    revisit_background_dark: NullableString,
    revisit_background_light: NullableString,
    revisit_background_mirrored: bool,
    revisit_image_dark: NullableString,
    revisit_image_light: NullableString,
    revisit_image_mirrored: bool,
    revisit_text: NullableString,
    success_animation: NullableString,
    success_text: NullableString,
    typing_speed: f64,
    updated_at: String,
}

#[derive(Serialize)]
pub struct CreateObstacleResponse {
    pub activity_id: Uuid,
}

#[derive(Serialize)]
pub struct UpdateObstacleResponse {
    pub activity_id: Uuid,
    pub updated_at: String,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum NullableString {
    Text(String),
    Null(()),
}

impl NullableString {
    fn as_deref(&self) -> Option<&str> {
        match self {
            Self::Text(value) => Some(value),
            Self::Null(()) => None,
        }
    }
}

pub async fn create(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateObstacleRequest>,
) -> Result<(StatusCode, Json<CreateObstacleResponse>), ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let form = ObstacleActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        parse_uuids(request.allowed_tool_ids.unwrap_or_default())?,
        request.background_dark.as_deref(),
        request.background_light.as_deref(),
        request.background_mirrored.unwrap_or(false),
        request.bubble_border_color_dark.as_deref(),
        request.bubble_border_color_light.as_deref(),
        request.bubble_color_dark.as_deref(),
        request.bubble_color_light.as_deref(),
        request.bubble_opacity_dark.unwrap_or(92.0),
        request.bubble_opacity_light.unwrap_or(94.0),
        request.obstacle_image_dark.as_deref(),
        request.obstacle_image_light.as_deref(),
        request.obstacle_image_mirrored.unwrap_or(false),
        request.persist_after_solved.unwrap_or(true),
        request.prompt_text.as_deref(),
        request.obstacle_x.unwrap_or(50.0),
        request.obstacle_y.unwrap_or(50.0),
        request.obstacle_width.unwrap_or(28.0),
        request.revisit_background_dark.as_deref(),
        request.revisit_background_light.as_deref(),
        request.revisit_background_mirrored.unwrap_or(false),
        request.revisit_image_dark.as_deref(),
        request.revisit_image_light.as_deref(),
        request.revisit_image_mirrored.unwrap_or(false),
        request.revisit_text.as_deref(),
        request.success_animation.as_deref(),
        request.success_text.as_deref(),
        request.typing_speed.unwrap_or(24.0),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldObstacleRepository::new(&state.application_database);
    let created = AdminWorldObstacleCommand::new(&repository)
        .create(&principal, node_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateObstacleResponse {
            activity_id: created.activity_id,
        }),
    ))
}

pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateObstacleRequest>,
) -> Result<Json<UpdateObstacleResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let form = ObstacleActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        parse_uuids(request.allowed_tool_ids)?,
        request.background_dark.as_deref(),
        request.background_light.as_deref(),
        request.background_mirrored,
        request.bubble_border_color_dark.as_deref(),
        request.bubble_border_color_light.as_deref(),
        request.bubble_color_dark.as_deref(),
        request.bubble_color_light.as_deref(),
        request.bubble_opacity_dark,
        request.bubble_opacity_light,
        request.obstacle_image_dark.as_deref(),
        request.obstacle_image_light.as_deref(),
        request.obstacle_image_mirrored,
        request.persist_after_solved,
        request.prompt_text.as_deref(),
        request.obstacle_x,
        request.obstacle_y,
        request.obstacle_width,
        request.revisit_background_dark.as_deref(),
        request.revisit_background_light.as_deref(),
        request.revisit_background_mirrored,
        request.revisit_image_dark.as_deref(),
        request.revisit_image_light.as_deref(),
        request.revisit_image_mirrored,
        request.revisit_text.as_deref(),
        request.success_animation.as_deref(),
        request.success_text.as_deref(),
        request.typing_speed,
    )
    .ok_or_else(ApiError::invalid_request)?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldObstacleRepository::new(&state.application_database);
    let updated = AdminWorldObstacleCommand::new(&repository)
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateObstacleResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}

fn parse_uuids(values: Vec<String>) -> Result<Vec<Uuid>, ApiError> {
    if values.len() > 100 {
        return Err(ApiError::invalid_request());
    }
    values
        .into_iter()
        .map(|value| Uuid::parse_str(&value).map_err(|_| ApiError::invalid_request()))
        .collect()
}

fn map_error(error: AdminWorldObstacleError) -> ApiError {
    match error {
        AdminWorldObstacleError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldObstacleError::Conflict => ApiError::conflict(),
        AdminWorldObstacleError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateObstacleRequest;

    #[test]
    fn update_requires_the_complete_source_form() {
        assert!(serde_json::from_str::<UpdateObstacleRequest>(r#"{"title":"Obstacle","slug":null,"introduction":null,"allowed_tool_ids":[],"background_dark":null,"background_light":null,"background_mirrored":false,"bubble_border_color_dark":null,"bubble_border_color_light":null,"bubble_color_dark":null,"bubble_color_light":null,"bubble_opacity_dark":92,"bubble_opacity_light":94,"obstacle_image_dark":null,"obstacle_image_light":null,"obstacle_image_mirrored":false,"persist_after_solved":true,"prompt_text":null,"obstacle_x":50,"obstacle_y":50,"obstacle_width":28,"revisit_background_dark":null,"revisit_background_light":null,"revisit_background_mirrored":false,"revisit_image_dark":null,"revisit_image_light":null,"revisit_image_mirrored":false,"revisit_text":null,"success_animation":"zoom","success_text":null,"typing_speed":24,"updated_at":"2026-11-07T17:00:00.000000Z"}"#).is_ok());
        assert!(serde_json::from_str::<UpdateObstacleRequest>(r#"{"title":"Obstacle"}"#).is_err());
    }
}
