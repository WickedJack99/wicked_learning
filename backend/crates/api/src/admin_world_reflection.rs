use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_application::admin_world_reflection::{
    AdminWorldReflectionCommand, AdminWorldReflectionError, DEFAULT_REFLECTION_PROMPT,
    ReflectionActivityForm,
};
use wicked_learning_persistence::admin_world_reflection::PostgresAdminWorldReflectionRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct CreateReflectionRequest {
    title: String,
    slug: Option<String>,
    introduction: Option<String>,
    prompt: Option<String>,
    note: Option<String>,
    topic: Option<String>,
    subtopic: Option<String>,
}

#[derive(Serialize)]
pub struct CreateReflectionResponse {
    pub activity_id: Uuid,
}

#[derive(Deserialize)]
pub struct UpdateReflectionRequest {
    title: String,
    slug: NullableString,
    introduction: NullableString,
    prompt: NullableString,
    note: NullableString,
    topic: NullableString,
    subtopic: NullableString,
    updated_at: String,
}

#[derive(Serialize)]
pub struct UpdateReflectionResponse {
    pub activity_id: Uuid,
    pub updated_at: String,
}

/// A required JSON field that may intentionally contain `null`. This keeps a
/// complete source-shaped edit distinguishable from an accidental partial one.
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
    Json(request): Json<CreateReflectionRequest>,
) -> Result<(StatusCode, Json<CreateReflectionResponse>), ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let form = ReflectionActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request
            .prompt
            .as_deref()
            .unwrap_or(DEFAULT_REFLECTION_PROMPT),
        request.note.as_deref().unwrap_or_default(),
        request.topic.as_deref().unwrap_or_default(),
        request.subtopic.as_deref().unwrap_or_default(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldReflectionRepository::new(&state.application_database);
    let created = AdminWorldReflectionCommand::new(&repository)
        .create(&principal, node_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateReflectionResponse {
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
    Json(request): Json<UpdateReflectionRequest>,
) -> Result<Json<UpdateReflectionResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let form = ReflectionActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request.prompt.as_deref().unwrap_or_default(),
        request.note.as_deref().unwrap_or_default(),
        request.topic.as_deref().unwrap_or_default(),
        request.subtopic.as_deref().unwrap_or_default(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldReflectionRepository::new(&state.application_database);
    let updated = AdminWorldReflectionCommand::new(&repository)
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateReflectionResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}

fn map_error(error: AdminWorldReflectionError) -> ApiError {
    match error {
        AdminWorldReflectionError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldReflectionError::Conflict => ApiError::conflict(),
        AdminWorldReflectionError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateReflectionRequest;

    #[test]
    fn update_requires_the_complete_reflection_form() {
        let complete = serde_json::from_str::<UpdateReflectionRequest>(
            r#"{"title":"A reflection","slug":null,"introduction":null,"prompt":null,"note":null,"topic":null,"subtopic":null,"updated_at":"2026-11-07T17:00:00.000000Z"}"#,
        );
        assert!(complete.is_ok());
        let missing_prompt = serde_json::from_str::<UpdateReflectionRequest>(
            r#"{"title":"A reflection","slug":null,"introduction":null,"note":null,"topic":null,"subtopic":null,"updated_at":"2026-11-07T17:00:00.000000Z"}"#,
        );
        assert!(missing_prompt.is_err());
    }
}
