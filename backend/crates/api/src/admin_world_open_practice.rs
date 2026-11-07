use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_application::admin_world_open_practice::{
    AdminWorldOpenPracticeCommand, AdminWorldOpenPracticeError, OpenPracticeActivityForm,
    UpdatedOpenPracticeActivity,
};
use wicked_learning_persistence::admin_world_open_practice::PostgresAdminWorldOpenPracticeRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct CreateOpenPracticeRequest {
    title: String,
    slug: Option<String>,
    introduction: Option<String>,
    next_step: Option<String>,
}

#[derive(Serialize)]
pub struct CreateOpenPracticeResponse {
    pub activity_id: Uuid,
}

#[derive(Deserialize)]
pub struct UpdateOpenPracticeRequest {
    title: String,
    slug: NullableString,
    introduction: NullableString,
    next_step: NullableString,
    updated_at: String,
}

#[derive(Serialize)]
pub struct UpdateOpenPracticeResponse {
    pub activity_id: Uuid,
    pub updated_at: String,
}

/// A required JSON field that may intentionally contain `null`. Unlike an
/// `Option<String>`, this keeps an omitted field invalid for complete edits.
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

/// Adds the first source-compatible Open practice creation contract. The
/// original World Builder will refetch its selected node before rendering the
/// new graph card when its complete adapter is ready.
pub async fn create(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateOpenPracticeRequest>,
) -> Result<(StatusCode, Json<CreateOpenPracticeResponse>), ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let form = OpenPracticeActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request.next_step.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldOpenPracticeRepository::new(&state.application_database);
    let activity_id = AdminWorldOpenPracticeCommand::new(&repository)
        .create(&principal, node_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateOpenPracticeResponse { activity_id }),
    ))
}

/// Updates the source's Open practice fields under the selected activity's
/// authoring scope. A stale editor gets a conflict instead of overwriting a
/// newer saved activity.
pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateOpenPracticeRequest>,
) -> Result<Json<UpdateOpenPracticeResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let form = OpenPracticeActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request.next_step.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldOpenPracticeRepository::new(&state.application_database);
    let updated = AdminWorldOpenPracticeCommand::new(&repository)
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(update_response(updated)))
}

fn update_response(updated: UpdatedOpenPracticeActivity) -> UpdateOpenPracticeResponse {
    UpdateOpenPracticeResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }
}

fn map_error(error: AdminWorldOpenPracticeError) -> ApiError {
    match error {
        AdminWorldOpenPracticeError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldOpenPracticeError::Conflict => ApiError::conflict(),
        AdminWorldOpenPracticeError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateOpenPracticeRequest;

    #[test]
    fn update_requires_every_source_form_field_but_allows_explicit_nulls() {
        let complete = serde_json::from_str::<UpdateOpenPracticeRequest>(
            r#"{"title":"A practice","slug":null,"introduction":null,"next_step":null,"updated_at":"2026-11-07T17:00:00.000000Z"}"#,
        );
        assert!(complete.is_ok());

        let missing_introduction = serde_json::from_str::<UpdateOpenPracticeRequest>(
            r#"{"title":"A practice","slug":null,"next_step":null,"updated_at":"2026-11-07T17:00:00.000000Z"}"#,
        );
        assert!(missing_introduction.is_err());
    }
}
