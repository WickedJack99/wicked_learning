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
use wicked_learning_application::admin_world_message::{
    AdminWorldMessageCommand, AdminWorldMessageError, MessageActivityForm, MessageUi,
};
use wicked_learning_persistence::admin_world_message::PostgresAdminWorldMessageRepository;

#[derive(Deserialize)]
pub struct MessageActivityRequest {
    title: String,
    slug: Option<String>,
    introduction: Option<String>,
    activity_type: String,
    topic_id: Option<String>,
    topic_title: String,
    audience: String,
    allow_responses: bool,
    response_prompt: String,
    prompt: String,
    input_label: String,
    surface_color_dark: String,
    surface_color_light: String,
    card_color_dark: String,
    card_color_light: String,
    card_border_color_dark: String,
    card_border_color_light: String,
    text_color_dark: String,
    text_color_light: String,
    accent_color_dark: String,
    accent_color_light: String,
}
#[derive(Deserialize)]
pub struct UpdateMessageActivityRequest {
    #[serde(flatten)]
    form: MessageActivityRequest,
    updated_at: String,
}
#[derive(Serialize)]
pub struct CreateMessageActivityResponse {
    pub activity_id: Uuid,
}
#[derive(Serialize)]
pub struct UpdateMessageActivityResponse {
    pub activity_id: Uuid,
    pub updated_at: String,
}
fn form(request: MessageActivityRequest) -> Result<MessageActivityForm, ApiError> {
    let topic_id = request
        .topic_id
        .as_deref()
        .filter(|value| !value.is_empty())
        .map(Uuid::parse_str)
        .transpose()
        .map_err(|_| ApiError::invalid_request())?;
    let ui = MessageUi::parse(
        &request.surface_color_dark,
        &request.surface_color_light,
        &request.card_color_dark,
        &request.card_color_light,
        &request.card_border_color_dark,
        &request.card_border_color_light,
        &request.text_color_dark,
        &request.text_color_light,
        &request.accent_color_dark,
        &request.accent_color_light,
    )
    .ok_or_else(ApiError::invalid_request)?;
    MessageActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        &request.activity_type,
        topic_id,
        &request.topic_title,
        &request.audience,
        request.allow_responses,
        &request.response_prompt,
        &request.prompt,
        &request.input_label,
        ui,
    )
    .ok_or_else(ApiError::invalid_request)
}
pub async fn create(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
    Json(request): Json<MessageActivityRequest>,
) -> Result<(StatusCode, Json<CreateMessageActivityResponse>), ApiError> {
    let form = form(request)?;
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMessageRepository::new(&state.application_database);
    let activity_id = AdminWorldMessageCommand::new(&repository)
        .create(&principal, node_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateMessageActivityResponse { activity_id }),
    ))
}
pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateMessageActivityRequest>,
) -> Result<Json<UpdateMessageActivityResponse>, ApiError> {
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let form = form(request.form)?;
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMessageRepository::new(&state.application_database);
    let updated = AdminWorldMessageCommand::new(&repository)
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateMessageActivityResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}
fn map_error(error: AdminWorldMessageError) -> ApiError {
    match error {
        AdminWorldMessageError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldMessageError::Conflict => ApiError::conflict(),
        AdminWorldMessageError::Unavailable => ApiError::service_unavailable(),
    }
}
#[cfg(test)]
mod tests {
    use super::UpdateMessageActivityRequest;
    #[test]
    fn update_requires_complete_source_message_form() {
        assert!(serde_json::from_str::<UpdateMessageActivityRequest>(r##"{"title":"Prompt","slug":null,"introduction":null,"activity_type":"message_prompt","topic_id":null,"topic_title":"Notes","audience":"peers","allow_responses":false,"response_prompt":"","prompt":"Leave a note","input_label":"Your note","surface_color_dark":"#071018","surface_color_light":"#e6f5f2","card_color_dark":"#13262d","card_color_light":"#ffffff","card_border_color_dark":"#2dd4bf","card_border_color_light":"#0f766e","text_color_dark":"#f1f5f9","text_color_light":"#0f172a","accent_color_dark":"#5eead4","accent_color_light":"#0f766e","updated_at":"2026-11-08T00:00:00Z"}"##).is_ok());
        assert!(
            serde_json::from_str::<UpdateMessageActivityRequest>(
                r#"{"title":"Prompt","updated_at":"2026-11-08T00:00:00Z"}"#
            )
            .is_err()
        );
    }
}
