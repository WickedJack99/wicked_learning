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
use wicked_learning_application::admin_world_shared_task::{
    AdminWorldSharedTaskCommand, AdminWorldSharedTaskError, SharedTaskActivityForm,
};
use wicked_learning_persistence::admin_world_shared_task::PostgresAdminWorldSharedTaskRepository;

#[derive(Deserialize)]
pub struct SharedTaskRequest {
    title: String,
    slug: Option<String>,
    introduction: Option<String>,
    task_kind: String,
    show_contributions: bool,
    prompt: String,
    instructions: String,
    input_label: String,
    project_goal: String,
    project_deliverable: String,
    project_steps: Vec<String>,
    peer_review_enabled: bool,
    peer_review_prompt: String,
    threshold: u16,
    minimum_length: u16,
    repeat_policy: String,
    validation_mode: String,
    cycle_mode: String,
}
#[derive(Deserialize)]
pub struct UpdateSharedTaskRequest {
    #[serde(flatten)]
    form: SharedTaskRequest,
    updated_at: String,
}
#[derive(Serialize)]
pub struct CreateSharedTaskResponse {
    pub activity_id: Uuid,
}
#[derive(Serialize)]
pub struct UpdateSharedTaskResponse {
    pub activity_id: Uuid,
    pub updated_at: String,
}

fn form(request: SharedTaskRequest) -> Result<SharedTaskActivityForm, ApiError> {
    SharedTaskActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        &request.task_kind,
        request.show_contributions,
        &request.prompt,
        &request.instructions,
        &request.input_label,
        &request.project_goal,
        &request.project_deliverable,
        request.project_steps,
        request.peer_review_enabled,
        &request.peer_review_prompt,
        request.threshold,
        request.minimum_length,
        &request.repeat_policy,
        &request.validation_mode,
        &request.cycle_mode,
    )
    .ok_or_else(ApiError::invalid_request)
}
pub async fn create(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SharedTaskRequest>,
) -> Result<(StatusCode, Json<CreateSharedTaskResponse>), ApiError> {
    let form = form(request)?;
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldSharedTaskRepository::new(&state.application_database);
    let activity_id = AdminWorldSharedTaskCommand::new(&repository)
        .create(&principal, node_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateSharedTaskResponse { activity_id }),
    ))
}
pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateSharedTaskRequest>,
) -> Result<Json<UpdateSharedTaskResponse>, ApiError> {
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let form = form(request.form)?;
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldSharedTaskRepository::new(&state.application_database);
    let updated = AdminWorldSharedTaskCommand::new(&repository)
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateSharedTaskResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}
fn map_error(error: AdminWorldSharedTaskError) -> ApiError {
    match error {
        AdminWorldSharedTaskError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldSharedTaskError::Conflict => ApiError::conflict(),
        AdminWorldSharedTaskError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateSharedTaskRequest;
    #[test]
    fn update_requires_all_shared_task_controls() {
        assert!(serde_json::from_str::<UpdateSharedTaskRequest>(r#"{"title":"Task","slug":null,"introduction":null,"task_kind":"text","show_contributions":false,"prompt":"Prompt","instructions":"","input_label":"Your contribution","project_goal":"","project_deliverable":"","project_steps":[],"peer_review_enabled":false,"peer_review_prompt":"Review","threshold":3,"minimum_length":20,"repeat_policy":"once_per_user","validation_mode":"minimum_length","cycle_mode":"none","updated_at":"2026-11-08T00:00:00Z"}"#).is_ok());
        assert!(
            serde_json::from_str::<UpdateSharedTaskRequest>(
                r#"{"title":"Task","updated_at":"2026-11-08T00:00:00Z"}"#
            )
            .is_err()
        );
    }
}
