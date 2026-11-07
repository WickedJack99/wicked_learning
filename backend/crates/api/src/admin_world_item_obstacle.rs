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
use wicked_learning_application::admin_world_item_obstacle::{
    AdminWorldItemObstacleCommand, AdminWorldItemObstacleError, ItemObstacleActivityForm,
    ItemObstacleSlot, ItemObstacleSound,
};
use wicked_learning_persistence::admin_world_item_obstacle::PostgresAdminWorldItemObstacleRepository;

#[derive(Deserialize)]
pub struct ItemObstacleSlotRequest {
    item_id: Option<String>,
    x: Option<f64>,
    y: Option<f64>,
    width: Option<f64>,
}

#[derive(Deserialize)]
pub struct CreateItemObstacleRequest {
    title: String,
    slug: Option<String>,
    introduction: Option<String>,
    background_dark: Option<String>,
    background_light: Option<String>,
    background_mirrored: Option<bool>,
    met_background_dark: Option<String>,
    met_background_light: Option<String>,
    met_background_mirrored: Option<bool>,
    overlay_dark: Option<String>,
    overlay_light: Option<String>,
    overlay_mirrored: Option<bool>,
    overlay_x: Option<f64>,
    overlay_y: Option<f64>,
    overlay_width: Option<f64>,
    slots: Option<Vec<ItemObstacleSlotRequest>>,
    consume_on_each_entry: Option<bool>,
    lock_minutes: Option<i32>,
    sound_not_met_enabled: Option<bool>,
    sound_not_met_id: Option<String>,
    sound_met_enabled: Option<bool>,
    sound_met_id: Option<String>,
    sound_transition_enabled: Option<bool>,
    sound_transition_id: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateItemObstacleRequest {
    title: String,
    slug: NullableString,
    introduction: NullableString,
    background_dark: NullableString,
    background_light: NullableString,
    background_mirrored: bool,
    met_background_dark: NullableString,
    met_background_light: NullableString,
    met_background_mirrored: bool,
    overlay_dark: NullableString,
    overlay_light: NullableString,
    overlay_mirrored: bool,
    overlay_x: f64,
    overlay_y: f64,
    overlay_width: f64,
    slots: Vec<ItemObstacleSlotRequest>,
    consume_on_each_entry: bool,
    lock_minutes: i32,
    sound_not_met_enabled: bool,
    sound_not_met_id: NullableString,
    sound_met_enabled: bool,
    sound_met_id: NullableString,
    sound_transition_enabled: bool,
    sound_transition_id: NullableString,
    updated_at: String,
}

#[derive(Serialize)]
pub struct CreateItemObstacleResponse {
    pub activity_id: Uuid,
}

#[derive(Serialize)]
pub struct UpdateItemObstacleResponse {
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
    Json(request): Json<CreateItemObstacleRequest>,
) -> Result<(StatusCode, Json<CreateItemObstacleResponse>), ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let form = ItemObstacleActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request.background_dark.as_deref(),
        request.background_light.as_deref(),
        request.background_mirrored.unwrap_or(false),
        request.met_background_dark.as_deref(),
        request.met_background_light.as_deref(),
        request.met_background_mirrored.unwrap_or(false),
        request.overlay_dark.as_deref(),
        request.overlay_light.as_deref(),
        request.overlay_mirrored.unwrap_or(false),
        request.overlay_x.unwrap_or(50.0),
        request.overlay_y.unwrap_or(50.0),
        request.overlay_width.unwrap_or(30.0),
        parse_slots(request.slots.unwrap_or_default())?,
        request.consume_on_each_entry.unwrap_or(false),
        request.lock_minutes.unwrap_or(0),
        ItemObstacleSound {
            enabled: request.sound_not_met_enabled.unwrap_or(false),
            sound_id: parse_uuid(request.sound_not_met_id.as_deref())?,
        },
        ItemObstacleSound {
            enabled: request.sound_met_enabled.unwrap_or(false),
            sound_id: parse_uuid(request.sound_met_id.as_deref())?,
        },
        ItemObstacleSound {
            enabled: request.sound_transition_enabled.unwrap_or(false),
            sound_id: parse_uuid(request.sound_transition_id.as_deref())?,
        },
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldItemObstacleRepository::new(&state.application_database);
    let activity_id = AdminWorldItemObstacleCommand::new(&repository)
        .create(&principal, node_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateItemObstacleResponse { activity_id }),
    ))
}

pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateItemObstacleRequest>,
) -> Result<Json<UpdateItemObstacleResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let form = ItemObstacleActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request.background_dark.as_deref(),
        request.background_light.as_deref(),
        request.background_mirrored,
        request.met_background_dark.as_deref(),
        request.met_background_light.as_deref(),
        request.met_background_mirrored,
        request.overlay_dark.as_deref(),
        request.overlay_light.as_deref(),
        request.overlay_mirrored,
        request.overlay_x,
        request.overlay_y,
        request.overlay_width,
        parse_slots(request.slots)?,
        request.consume_on_each_entry,
        request.lock_minutes,
        ItemObstacleSound {
            enabled: request.sound_not_met_enabled,
            sound_id: parse_uuid(request.sound_not_met_id.as_deref())?,
        },
        ItemObstacleSound {
            enabled: request.sound_met_enabled,
            sound_id: parse_uuid(request.sound_met_id.as_deref())?,
        },
        ItemObstacleSound {
            enabled: request.sound_transition_enabled,
            sound_id: parse_uuid(request.sound_transition_id.as_deref())?,
        },
    )
    .ok_or_else(ApiError::invalid_request)?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldItemObstacleRepository::new(&state.application_database);
    let updated = AdminWorldItemObstacleCommand::new(&repository)
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateItemObstacleResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}

fn parse_slots(requests: Vec<ItemObstacleSlotRequest>) -> Result<Vec<ItemObstacleSlot>, ApiError> {
    if requests.len() > 10 {
        return Err(ApiError::invalid_request());
    }
    requests
        .into_iter()
        .map(|request| {
            let x = request.x.unwrap_or(50.0);
            let y = request.y.unwrap_or(50.0);
            let width = request.width.unwrap_or(10.0);
            if !bounded(x, 0.0, 100.0) || !bounded(y, 0.0, 100.0) || !bounded(width, 1.0, 100.0) {
                return Err(ApiError::invalid_request());
            }
            Ok(
                parse_uuid(request.item_id.as_deref())?.map(|item_id| ItemObstacleSlot {
                    item_id,
                    x,
                    y,
                    width,
                }),
            )
        })
        .filter_map(Result::transpose)
        .collect()
}

fn parse_uuid(value: Option<&str>) -> Result<Option<Uuid>, ApiError> {
    value
        .map(|value| Uuid::parse_str(value).map_err(|_| ApiError::invalid_request()))
        .transpose()
}

fn bounded(value: f64, minimum: f64, maximum: f64) -> bool {
    value.is_finite() && (minimum..=maximum).contains(&value)
}

fn map_error(error: AdminWorldItemObstacleError) -> ApiError {
    match error {
        AdminWorldItemObstacleError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldItemObstacleError::Conflict => ApiError::conflict(),
        AdminWorldItemObstacleError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateItemObstacleRequest;

    #[test]
    fn update_requires_the_complete_source_form() {
        assert!(serde_json::from_str::<UpdateItemObstacleRequest>(r#"{"title":"Obstacle","slug":null,"introduction":null,"background_dark":null,"background_light":null,"background_mirrored":false,"met_background_dark":null,"met_background_light":null,"met_background_mirrored":false,"overlay_dark":null,"overlay_light":null,"overlay_mirrored":false,"overlay_x":50,"overlay_y":50,"overlay_width":30,"slots":[],"consume_on_each_entry":false,"lock_minutes":0,"sound_not_met_enabled":false,"sound_not_met_id":null,"sound_met_enabled":false,"sound_met_id":null,"sound_transition_enabled":false,"sound_transition_id":null,"updated_at":"2026-11-07T17:00:00.000000Z"}"#).is_ok());
        assert!(
            serde_json::from_str::<UpdateItemObstacleRequest>(r#"{"title":"Obstacle"}"#).is_err()
        );
    }
}
