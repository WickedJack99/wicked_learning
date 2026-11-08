use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;
use wicked_learning_application::admin_learning_companion_dialogue::{
    AdminLearningCompanionDialogueCommand, AdminLearningCompanionDialogueError,
    AdminLearningCompanionDialogueQuery, CompanionDialogueAssignmentForm, CompanionDialogueForm,
    CompanionDialoguePageRequest,
};
use wicked_learning_domain::learning_companion::{
    LearningCompanionAssignment, LearningCompanionAssignmentPage, LearningCompanionDialogue,
    LearningCompanionDialoguePage,
};
use wicked_learning_persistence::admin_learning_companion_dialogue::PostgresAdminLearningCompanionDialogueRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct DialoguePageQuery {
    page: Option<i64>,
    per_page: Option<i64>,
    search: Option<String>,
}

#[derive(Deserialize)]
pub struct SaveLearningCompanionDialogueRequest {
    dialogue_graph: Option<Value>,
    name: String,
}

#[derive(Deserialize)]
pub struct SyncLearningCompanionDialogueAssignmentsRequest {
    assignments: Vec<LearningCompanionAssignment>,
}

#[derive(serde::Serialize)]
pub struct AssignmentSyncResponse {
    assignments: Vec<LearningCompanionAssignment>,
    assignments_count: i64,
}

pub async fn index(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
    Query(query): Query<DialoguePageQuery>,
) -> Result<Json<LearningCompanionDialoguePage>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository =
        PostgresAdminLearningCompanionDialogueRepository::new(&state.application_database);
    AdminLearningCompanionDialogueQuery::new(&repository)
        .list(&principal, &page(query))
        .await
        .map_err(map_error)?
        .map(Json)
        .ok_or_else(ApiError::forbidden)
}

pub async fn show(
    State(state): State<AppState>,
    Path(dialogue_id): Path<String>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearningCompanionDialogue>, ApiError> {
    let dialogue_id = parse_id(&dialogue_id)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository =
        PostgresAdminLearningCompanionDialogueRepository::new(&state.application_database);
    AdminLearningCompanionDialogueQuery::new(&repository)
        .show(&principal, dialogue_id)
        .await
        .map_err(map_error)?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveLearningCompanionDialogueRequest>,
) -> Result<(StatusCode, Json<LearningCompanionDialogue>), ApiError> {
    let form = form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresAdminLearningCompanionDialogueRepository::new(&state.application_database);
    let dialogue = AdminLearningCompanionDialogueCommand::new(&repository)
        .create(&principal, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::forbidden)?;
    Ok((StatusCode::CREATED, Json(dialogue)))
}

pub async fn update(
    State(state): State<AppState>,
    Path(dialogue_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveLearningCompanionDialogueRequest>,
) -> Result<Json<LearningCompanionDialogue>, ApiError> {
    let dialogue_id = parse_id(&dialogue_id)?;
    let form = form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresAdminLearningCompanionDialogueRepository::new(&state.application_database);
    AdminLearningCompanionDialogueCommand::new(&repository)
        .update(&principal, dialogue_id, &form)
        .await
        .map_err(map_error)?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn delete(
    State(state): State<AppState>,
    Path(dialogue_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let dialogue_id = parse_id(&dialogue_id)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresAdminLearningCompanionDialogueRepository::new(&state.application_database);
    if !AdminLearningCompanionDialogueCommand::new(&repository)
        .delete(&principal, dialogue_id)
        .await
        .map_err(map_error)?
    {
        return Err(ApiError::not_found());
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn assignments(
    State(state): State<AppState>,
    Path(dialogue_id): Path<String>,
    auth_session: AuthSession<IdentityBackend>,
    Query(query): Query<DialoguePageQuery>,
) -> Result<Json<LearningCompanionAssignmentPage>, ApiError> {
    let dialogue_id = parse_id(&dialogue_id)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository =
        PostgresAdminLearningCompanionDialogueRepository::new(&state.application_database);
    AdminLearningCompanionDialogueCommand::new(&repository)
        .assignments(&principal, dialogue_id, &page(query))
        .await
        .map_err(map_error)?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn sync_assignments(
    State(state): State<AppState>,
    Path(dialogue_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SyncLearningCompanionDialogueAssignmentsRequest>,
) -> Result<Json<AssignmentSyncResponse>, ApiError> {
    let dialogue_id = parse_id(&dialogue_id)?;
    let form = CompanionDialogueAssignmentForm::parse(request.assignments)
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresAdminLearningCompanionDialogueRepository::new(&state.application_database);
    let assignments_count = AdminLearningCompanionDialogueCommand::new(&repository)
        .sync_assignments(&principal, dialogue_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(AssignmentSyncResponse {
        assignments: form.assignments,
        assignments_count,
    }))
}

fn page(query: DialoguePageQuery) -> CompanionDialoguePageRequest {
    CompanionDialoguePageRequest::parse(query.page, query.per_page, query.search.as_deref())
}

fn form(request: SaveLearningCompanionDialogueRequest) -> Result<CompanionDialogueForm, ApiError> {
    CompanionDialogueForm::parse(&request.name, request.dialogue_graph)
        .ok_or_else(ApiError::invalid_request)
}

fn parse_id(value: &str) -> Result<Uuid, ApiError> {
    Uuid::parse_str(value).map_err(|_| ApiError::not_found())
}

fn map_error(error: AdminLearningCompanionDialogueError) -> ApiError {
    match error {
        AdminLearningCompanionDialogueError::Invalid => ApiError::invalid_request(),
        AdminLearningCompanionDialogueError::Unavailable => ApiError::service_unavailable(),
    }
}
