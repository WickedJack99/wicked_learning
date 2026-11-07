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
use wicked_learning_application::admin_world_tool_grant::{
    AdminWorldToolGrantCommand, AdminWorldToolGrantError, ToolGrantActivityForm,
};
use wicked_learning_persistence::admin_world_tool_grant::PostgresAdminWorldToolGrantRepository;

#[derive(Deserialize)]
pub struct CreateToolGrantRequest {
    title: String,
    slug: Option<String>,
    introduction: Option<String>,
    background_dark: Option<String>,
    background_light: Option<String>,
    background_mirrored: Option<bool>,
    bubble_border_color_dark: Option<String>,
    bubble_border_color_light: Option<String>,
    bubble_color_dark: Option<String>,
    bubble_color_light: Option<String>,
    bubble_opacity_dark: Option<f64>,
    bubble_opacity_light: Option<f64>,
    fade_duration_seconds: Option<f64>,
    slide_direction: Option<String>,
    slide_duration_seconds: Option<f64>,
    text: Option<String>,
    tool_id: Option<String>,
    tool_mirrored: Option<bool>,
    tool_x: Option<f64>,
    tool_y: Option<f64>,
    typing_speed: Option<f64>,
}
#[derive(Deserialize)]
pub struct UpdateToolGrantRequest {
    title: String,
    slug: NullableString,
    introduction: NullableString,
    background_dark: NullableString,
    background_light: NullableString,
    background_mirrored: bool,
    bubble_border_color_dark: NullableString,
    bubble_border_color_light: NullableString,
    bubble_color_dark: NullableString,
    bubble_color_light: NullableString,
    bubble_opacity_dark: f64,
    bubble_opacity_light: f64,
    fade_duration_seconds: f64,
    slide_direction: NullableString,
    slide_duration_seconds: f64,
    text: NullableString,
    tool_id: NullableString,
    tool_mirrored: bool,
    tool_x: f64,
    tool_y: f64,
    typing_speed: f64,
    updated_at: String,
}
#[derive(Serialize)]
pub struct CreateToolGrantResponse {
    pub activity_id: Uuid,
}
#[derive(Serialize)]
pub struct UpdateToolGrantResponse {
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
    Json(request): Json<CreateToolGrantRequest>,
) -> Result<(StatusCode, Json<CreateToolGrantResponse>), ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let form = ToolGrantActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request.background_dark.as_deref(),
        request.background_light.as_deref(),
        request.background_mirrored.unwrap_or(false),
        request.bubble_border_color_dark.as_deref(),
        request.bubble_border_color_light.as_deref(),
        request.bubble_color_dark.as_deref(),
        request.bubble_color_light.as_deref(),
        request.bubble_opacity_dark.unwrap_or(92.0),
        request.bubble_opacity_light.unwrap_or(94.0),
        request.fade_duration_seconds.unwrap_or(0.4),
        request.slide_direction.as_deref(),
        request.slide_duration_seconds.unwrap_or(0.6),
        request.text.as_deref(),
        parse_uuid(request.tool_id.as_deref())?,
        request.tool_mirrored.unwrap_or(false),
        request.tool_x.unwrap_or(50.0),
        request.tool_y.unwrap_or(50.0),
        request.typing_speed.unwrap_or(24.0),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldToolGrantRepository::new(&state.application_database);
    let activity_id = AdminWorldToolGrantCommand::new(&repository)
        .create(&principal, node_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateToolGrantResponse { activity_id }),
    ))
}
pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateToolGrantRequest>,
) -> Result<Json<UpdateToolGrantResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let form = ToolGrantActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request.background_dark.as_deref(),
        request.background_light.as_deref(),
        request.background_mirrored,
        request.bubble_border_color_dark.as_deref(),
        request.bubble_border_color_light.as_deref(),
        request.bubble_color_dark.as_deref(),
        request.bubble_color_light.as_deref(),
        request.bubble_opacity_dark,
        request.bubble_opacity_light,
        request.fade_duration_seconds,
        request.slide_direction.as_deref(),
        request.slide_duration_seconds,
        request.text.as_deref(),
        parse_uuid(request.tool_id.as_deref())?,
        request.tool_mirrored,
        request.tool_x,
        request.tool_y,
        request.typing_speed,
    )
    .ok_or_else(ApiError::invalid_request)?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldToolGrantRepository::new(&state.application_database);
    let updated = AdminWorldToolGrantCommand::new(&repository)
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateToolGrantResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}
fn parse_uuid(value: Option<&str>) -> Result<Option<Uuid>, ApiError> {
    value
        .map(|value| Uuid::parse_str(value).map_err(|_| ApiError::invalid_request()))
        .transpose()
}
fn map_error(error: AdminWorldToolGrantError) -> ApiError {
    match error {
        AdminWorldToolGrantError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldToolGrantError::Conflict => ApiError::conflict(),
        AdminWorldToolGrantError::Unavailable => ApiError::service_unavailable(),
    }
}
#[cfg(test)]
mod tests {
    use super::UpdateToolGrantRequest;

    #[test]
    fn update_requires_the_complete_source_form() {
        assert!(serde_json::from_str::<UpdateToolGrantRequest>(r#"{"title":"Grant","slug":null,"introduction":null,"background_dark":null,"background_light":null,"background_mirrored":false,"bubble_border_color_dark":null,"bubble_border_color_light":null,"bubble_color_dark":null,"bubble_color_light":null,"bubble_opacity_dark":92,"bubble_opacity_light":94,"fade_duration_seconds":0.4,"slide_direction":"left","slide_duration_seconds":0.6,"text":null,"tool_id":null,"tool_mirrored":false,"tool_x":50,"tool_y":50,"typing_speed":24,"updated_at":"2026-11-07T17:00:00.000000Z"}"#).is_ok());
        assert!(serde_json::from_str::<UpdateToolGrantRequest>(r#"{"title":"Grant"}"#).is_err());
    }
}
