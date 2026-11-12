use std::collections::BTreeMap;

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
use wicked_learning_application::admin_world_question::{
    AdminWorldQuestionCommand, AdminWorldQuestionError, QuestionActivityForm, QuestionOptionForm,
};
use wicked_learning_persistence::admin_world_question::PostgresAdminWorldQuestionRepository;

#[derive(Deserialize)]
pub struct QuestionOptionRequest {
    label: String,
    body: String,
    is_correct: bool,
    key: NullableString,
    outcome_key: String,
    feedback: String,
    weights: BTreeMap<String, f64>,
}

#[derive(Deserialize)]
pub struct QuestionActivityRequest {
    title: String,
    slug: NullableString,
    introduction: NullableString,
    prompt: String,
    feedback_correct: String,
    feedback_incorrect: String,
    explanation: String,
    allow_multiple: bool,
    options: Vec<QuestionOptionRequest>,
}

#[derive(Deserialize)]
pub struct UpdateQuestionActivityRequest {
    #[serde(flatten)]
    form: QuestionActivityRequest,
    updated_at: String,
}

/// A required JSON field that may intentionally contain `null`. The complete
/// World Builder form must not silently turn into a partial update.
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
pub struct CreateQuestionActivityResponse {
    pub activity_id: Uuid,
}

#[derive(Serialize)]
pub struct UpdateQuestionActivityResponse {
    pub activity_id: Uuid,
    pub updated_at: String,
}

fn form(request: QuestionActivityRequest) -> Result<QuestionActivityForm, ApiError> {
    let options = request
        .options
        .into_iter()
        .map(|option| {
            QuestionOptionForm::parse(
                &option.label,
                &option.body,
                option.is_correct,
                option.key.as_deref(),
                &option.outcome_key,
                &option.feedback,
                option.weights,
            )
            .ok_or_else(ApiError::invalid_request)
        })
        .collect::<Result<Vec<_>, _>>()?;
    QuestionActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        &request.prompt,
        &request.feedback_correct,
        &request.feedback_incorrect,
        &request.explanation,
        request.allow_multiple,
        options,
    )
    .ok_or_else(ApiError::invalid_request)
}

pub async fn create(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
    Json(request): Json<QuestionActivityRequest>,
) -> Result<(StatusCode, Json<CreateQuestionActivityResponse>), ApiError> {
    let form = form(request)?;
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldQuestionRepository::new(&state.application_database);
    let created = AdminWorldQuestionCommand::new(&repository)
        .create(&principal, node_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateQuestionActivityResponse {
            activity_id: created.activity_id,
        }),
    ))
}

pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateQuestionActivityRequest>,
) -> Result<Json<UpdateQuestionActivityResponse>, ApiError> {
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let form = form(request.form)?;
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldQuestionRepository::new(&state.application_database);
    let updated = AdminWorldQuestionCommand::new(&repository)
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateQuestionActivityResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}

fn map_error(error: AdminWorldQuestionError) -> ApiError {
    match error {
        AdminWorldQuestionError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldQuestionError::Conflict => ApiError::conflict(),
        AdminWorldQuestionError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateQuestionActivityRequest;

    #[test]
    fn update_requires_the_complete_source_question_form_and_allows_decimal_weights() {
        assert!(serde_json::from_str::<UpdateQuestionActivityRequest>(r#"{"title":"Question","slug":null,"introduction":null,"prompt":"Which choice?","feedback_correct":"","feedback_incorrect":"","explanation":"","allow_multiple":false,"options":[{"label":"A","body":"Keep options visible.","is_correct":true,"key":null,"outcome_key":"","feedback":"","weights":{"recall":0.5}},{"label":"B","body":"Hide routes.","is_correct":false,"key":null,"outcome_key":"","feedback":"","weights":{}}],"updated_at":"2026-11-08T00:00:00Z"}"#).is_ok());
        assert!(serde_json::from_str::<UpdateQuestionActivityRequest>(
            r#"{"title":"Question","prompt":"Which choice?","updated_at":"2026-11-08T00:00:00Z"}"#,
        )
        .is_err());
    }
}
