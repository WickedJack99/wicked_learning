use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_application::admin_world_portal::{
    AdminWorldPortalCommand, AdminWorldPortalError, PortalActivityForm, PortalAssetForm, PortalMode,
};
use wicked_learning_persistence::admin_world_portal::PostgresAdminWorldPortalRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct PortalAssetRequest {
    id: String,
    image_dark: String,
    image_light: String,
    label: String,
    layer: String,
    mirrored: bool,
    opacity: f64,
    width: f64,
    x: f64,
    y: f64,
}

#[derive(Deserialize)]
pub struct PortalActivityRequest {
    title: String,
    slug: NullableString,
    introduction: NullableString,
    portal_mode: String,
    portal_background_dark: String,
    portal_background_light: String,
    portal_background_mirrored: bool,
    portal_assets: Vec<PortalAssetRequest>,
    portal_duration_seconds: f64,
    portal_foreground_dark: String,
    portal_foreground_light: String,
    portal_foreground_mirrored: bool,
    portal_foreground_width: f64,
    portal_foreground_x: f64,
    portal_foreground_y: f64,
    portal_show_on_arrival: bool,
    portal_swirl_enabled: bool,
    portal_bubble_text: String,
    portal_bubble_typing_speed: f64,
    portal_bubble_color_dark: String,
    portal_bubble_color_light: String,
    portal_bubble_border_color_dark: String,
    portal_bubble_border_color_light: String,
    portal_bubble_text_color_dark: String,
    portal_bubble_text_color_light: String,
    portal_wait_for_enter: bool,
    target_portal_activity_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct CreatePortalActivityRequest {
    title: String,
    slug: Option<String>,
    introduction: Option<String>,
    portal_mode: String,
    portal_background_dark: String,
    portal_background_light: String,
    portal_background_mirrored: bool,
    portal_assets: Vec<PortalAssetRequest>,
    portal_duration_seconds: f64,
    portal_foreground_dark: String,
    portal_foreground_light: String,
    portal_foreground_mirrored: bool,
    portal_foreground_width: f64,
    portal_foreground_x: f64,
    portal_foreground_y: f64,
    portal_show_on_arrival: bool,
    portal_swirl_enabled: bool,
    portal_bubble_text: String,
    portal_bubble_typing_speed: f64,
    portal_bubble_color_dark: String,
    portal_bubble_color_light: String,
    portal_bubble_border_color_dark: String,
    portal_bubble_border_color_light: String,
    portal_bubble_text_color_dark: String,
    portal_bubble_text_color_light: String,
    portal_wait_for_enter: bool,
    target_portal_activity_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct UpdatePortalActivityRequest {
    #[serde(flatten)]
    form: PortalActivityRequest,
    updated_at: String,
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

#[derive(Serialize)]
pub struct CreatePortalActivityResponse {
    pub activity_id: Uuid,
}

#[derive(Serialize)]
pub struct UpdatePortalActivityResponse {
    pub activity_id: Uuid,
    pub updated_at: String,
}

fn asset(request: PortalAssetRequest) -> Result<PortalAssetForm, ApiError> {
    PortalAssetForm::parse(
        &request.id,
        &request.image_dark,
        &request.image_light,
        &request.label,
        &request.layer,
        request.mirrored,
        request.opacity,
        request.width,
        request.x,
        request.y,
    )
    .ok_or_else(ApiError::invalid_request)
}

#[allow(clippy::too_many_arguments)]
fn form(
    title: &str,
    slug: Option<&str>,
    introduction: Option<&str>,
    portal_mode: &str,
    portal_background_dark: &str,
    portal_background_light: &str,
    portal_background_mirrored: bool,
    portal_assets: Vec<PortalAssetRequest>,
    portal_duration_seconds: f64,
    portal_foreground_dark: &str,
    portal_foreground_light: &str,
    portal_foreground_mirrored: bool,
    portal_foreground_width: f64,
    portal_foreground_x: f64,
    portal_foreground_y: f64,
    portal_show_on_arrival: bool,
    portal_swirl_enabled: bool,
    portal_bubble_text: &str,
    portal_bubble_typing_speed: f64,
    portal_bubble_color_dark: &str,
    portal_bubble_color_light: &str,
    portal_bubble_border_color_dark: &str,
    portal_bubble_border_color_light: &str,
    portal_bubble_text_color_dark: &str,
    portal_bubble_text_color_light: &str,
    portal_wait_for_enter: bool,
    target_portal_activity_id: Option<Uuid>,
) -> Result<PortalActivityForm, ApiError> {
    let portal_mode = PortalMode::parse(portal_mode).ok_or_else(ApiError::invalid_request)?;
    let portal_assets = portal_assets
        .into_iter()
        .map(asset)
        .collect::<Result<Vec<_>, _>>()?;
    PortalActivityForm::parse(
        title,
        slug,
        introduction,
        portal_mode,
        portal_background_dark,
        portal_background_light,
        portal_background_mirrored,
        portal_assets,
        portal_duration_seconds,
        portal_foreground_dark,
        portal_foreground_light,
        portal_foreground_mirrored,
        portal_foreground_width,
        portal_foreground_x,
        portal_foreground_y,
        portal_show_on_arrival,
        portal_swirl_enabled,
        portal_bubble_text,
        portal_bubble_typing_speed,
        portal_bubble_color_dark,
        portal_bubble_color_light,
        portal_bubble_border_color_dark,
        portal_bubble_border_color_light,
        portal_bubble_text_color_dark,
        portal_bubble_text_color_light,
        portal_wait_for_enter,
        target_portal_activity_id,
    )
    .ok_or_else(ApiError::invalid_request)
}

pub async fn create(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreatePortalActivityRequest>,
) -> Result<(StatusCode, Json<CreatePortalActivityResponse>), ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let form = form(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        &request.portal_mode,
        &request.portal_background_dark,
        &request.portal_background_light,
        request.portal_background_mirrored,
        request.portal_assets,
        request.portal_duration_seconds,
        &request.portal_foreground_dark,
        &request.portal_foreground_light,
        request.portal_foreground_mirrored,
        request.portal_foreground_width,
        request.portal_foreground_x,
        request.portal_foreground_y,
        request.portal_show_on_arrival,
        request.portal_swirl_enabled,
        &request.portal_bubble_text,
        request.portal_bubble_typing_speed,
        &request.portal_bubble_color_dark,
        &request.portal_bubble_color_light,
        &request.portal_bubble_border_color_dark,
        &request.portal_bubble_border_color_light,
        &request.portal_bubble_text_color_dark,
        &request.portal_bubble_text_color_light,
        request.portal_wait_for_enter,
        request.target_portal_activity_id,
    )?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldPortalRepository::new(&state.application_database);
    let created = AdminWorldPortalCommand::new(&repository)
        .create(&principal, node_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreatePortalActivityResponse {
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
    Json(request): Json<UpdatePortalActivityRequest>,
) -> Result<Json<UpdatePortalActivityResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let form = form(
        &request.form.title,
        request.form.slug.as_deref(),
        request.form.introduction.as_deref(),
        &request.form.portal_mode,
        &request.form.portal_background_dark,
        &request.form.portal_background_light,
        request.form.portal_background_mirrored,
        request.form.portal_assets,
        request.form.portal_duration_seconds,
        &request.form.portal_foreground_dark,
        &request.form.portal_foreground_light,
        request.form.portal_foreground_mirrored,
        request.form.portal_foreground_width,
        request.form.portal_foreground_x,
        request.form.portal_foreground_y,
        request.form.portal_show_on_arrival,
        request.form.portal_swirl_enabled,
        &request.form.portal_bubble_text,
        request.form.portal_bubble_typing_speed,
        &request.form.portal_bubble_color_dark,
        &request.form.portal_bubble_color_light,
        &request.form.portal_bubble_border_color_dark,
        &request.form.portal_bubble_border_color_light,
        &request.form.portal_bubble_text_color_dark,
        &request.form.portal_bubble_text_color_light,
        request.form.portal_wait_for_enter,
        request.form.target_portal_activity_id,
    )?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldPortalRepository::new(&state.application_database);
    let updated = AdminWorldPortalCommand::new(&repository)
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdatePortalActivityResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}

fn map_error(error: AdminWorldPortalError) -> ApiError {
    match error {
        AdminWorldPortalError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldPortalError::Conflict => ApiError::conflict(),
        AdminWorldPortalError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::UpdatePortalActivityRequest;

    #[test]
    fn update_requires_the_complete_source_portal_form() {
        let complete = r##"{"title":"Gate","slug":null,"introduction":null,"portal_mode":"output","portal_background_dark":"","portal_background_light":"","portal_background_mirrored":false,"portal_assets":[],"portal_duration_seconds":1.5,"portal_foreground_dark":"","portal_foreground_light":"","portal_foreground_mirrored":false,"portal_foreground_width":28,"portal_foreground_x":50,"portal_foreground_y":50,"portal_show_on_arrival":true,"portal_swirl_enabled":true,"portal_bubble_text":"","portal_bubble_typing_speed":24,"portal_bubble_color_dark":"#0f172a","portal_bubble_color_light":"#ffffff","portal_bubble_border_color_dark":"#2dd4bf","portal_bubble_border_color_light":"#0891b2","portal_bubble_text_color_dark":"#f8fafc","portal_bubble_text_color_light":"#0f172a","portal_wait_for_enter":false,"target_portal_activity_id":null,"updated_at":"2026-11-08T00:00:00Z"}"##;
        assert!(serde_json::from_str::<UpdatePortalActivityRequest>(complete).is_ok());
        assert!(
            serde_json::from_str::<UpdatePortalActivityRequest>(
                r#"{"title":"Gate","updated_at":"2026-11-08T00:00:00Z"}"#
            )
            .is_err()
        );
    }
}
