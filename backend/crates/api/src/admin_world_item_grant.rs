use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_application::admin_world_item_grant::{
    AdminWorldItemGrantCommand, AdminWorldItemGrantError, ItemGrantActivityForm, ItemGrantItem,
};
use wicked_learning_persistence::admin_world_item_grant::PostgresAdminWorldItemGrantRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct ItemGrantItemRequest {
    item_id: String,
    quantity: u16,
}

#[derive(Deserialize)]
pub struct CreateItemGrantRequest {
    title: String,
    slug: Option<String>,
    introduction: Option<String>,
    background_dark: Option<String>,
    background_light: Option<String>,
    background_mirrored: Option<bool>,
    items: Option<Vec<ItemGrantItemRequest>>,
    probability_percent: Option<f64>,
}

#[derive(Serialize)]
pub struct CreateItemGrantResponse {
    pub activity_id: Uuid,
}

#[derive(Deserialize)]
pub struct UpdateItemGrantRequest {
    title: String,
    slug: NullableString,
    introduction: NullableString,
    background_dark: NullableString,
    background_light: NullableString,
    background_mirrored: bool,
    items: Vec<ItemGrantItemRequest>,
    probability_percent: f64,
    updated_at: String,
}

#[derive(Serialize)]
pub struct UpdateItemGrantResponse {
    pub activity_id: Uuid,
    pub updated_at: String,
}

/// A required JSON field that may intentionally contain `null`. Complete
/// source-shaped updates must not accidentally inherit an omitted field.
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
    Json(request): Json<CreateItemGrantRequest>,
) -> Result<(StatusCode, Json<CreateItemGrantResponse>), ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let form = ItemGrantActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request.background_dark.as_deref(),
        request.background_light.as_deref(),
        request.background_mirrored.unwrap_or(false),
        request
            .items
            .unwrap_or_default()
            .into_iter()
            .map(parse_item)
            .collect::<Result<_, _>>()?,
        request.probability_percent.unwrap_or(100.0),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldItemGrantRepository::new(&state.application_database);
    let activity_id = AdminWorldItemGrantCommand::new(&repository)
        .create(&principal, node_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateItemGrantResponse { activity_id }),
    ))
}

pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateItemGrantRequest>,
) -> Result<Json<UpdateItemGrantResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let form = ItemGrantActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request.background_dark.as_deref(),
        request.background_light.as_deref(),
        request.background_mirrored,
        request
            .items
            .into_iter()
            .map(parse_item)
            .collect::<Result<_, _>>()?,
        request.probability_percent,
    )
    .ok_or_else(ApiError::invalid_request)?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldItemGrantRepository::new(&state.application_database);
    let updated = AdminWorldItemGrantCommand::new(&repository)
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateItemGrantResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}

fn parse_item(item: ItemGrantItemRequest) -> Result<ItemGrantItem, ApiError> {
    Ok(ItemGrantItem {
        item_id: Uuid::parse_str(&item.item_id).map_err(|_| ApiError::invalid_request())?,
        quantity: item.quantity,
    })
}

fn map_error(error: AdminWorldItemGrantError) -> ApiError {
    match error {
        AdminWorldItemGrantError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldItemGrantError::Conflict => ApiError::conflict(),
        AdminWorldItemGrantError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::{ItemGrantItemRequest, UpdateItemGrantRequest, parse_item};

    #[test]
    fn update_requires_the_complete_source_item_grant_form() {
        let complete = serde_json::from_str::<UpdateItemGrantRequest>(
            r#"{"title":"A grant","slug":null,"introduction":null,"background_dark":null,"background_light":null,"background_mirrored":false,"items":[],"probability_percent":100,"updated_at":"2026-11-07T17:00:00.000000Z"}"#,
        );
        assert!(complete.is_ok());

        let missing_items = serde_json::from_str::<UpdateItemGrantRequest>(
            r#"{"title":"A grant","slug":null,"introduction":null,"background_dark":null,"background_light":null,"background_mirrored":false,"probability_percent":100,"updated_at":"2026-11-07T17:00:00.000000Z"}"#,
        );
        assert!(missing_items.is_err());
    }

    #[test]
    fn rejects_non_catalog_uuid_item_references_before_persistence() {
        assert!(
            parse_item(ItemGrantItemRequest {
                item_id: "not-a-catalog-uuid".to_owned(),
                quantity: 1,
            })
            .is_err()
        );
    }
}
