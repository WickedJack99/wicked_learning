use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use wicked_learning_application::admin_world_npc_dialogue::{
    AdminWorldNpcDialogueCommand, AdminWorldNpcDialogueError, NpcDialogueActivityForm,
    NpcDialogueNodeForm, NpcDialoguePosition, NpcDialogueTransitionForm,
};
use wicked_learning_domain::world_content::AdminNpcDialogueGraph;
use wicked_learning_persistence::admin_world_npc_dialogue::PostgresAdminWorldNpcDialogueRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct CreateNpcDialogueActivityRequest {
    title: String,
    slug: Option<String>,
    introduction: Option<String>,
}

#[derive(Serialize)]
pub struct CreateNpcDialogueActivityResponse {
    pub activity_id: Uuid,
}

#[derive(Deserialize)]
pub struct DialoguePositionRequest {
    x: f64,
    y: f64,
}

#[derive(Deserialize)]
pub struct DialogueNodeRequest {
    node_type: String,
    title: String,
    body: Option<String>,
    config: Value,
    position: Option<DialoguePositionRequest>,
}

#[derive(Deserialize)]
pub struct DialogueTransitionRequest {
    from_node_id: Option<Uuid>,
    to_node_id: Uuid,
    from_connector: String,
    to_connector: String,
}

#[derive(Serialize)]
pub struct CreatedResource {
    pub id: Uuid,
}

fn node_form(request: DialogueNodeRequest) -> Result<NpcDialogueNodeForm, ApiError> {
    let position = match request.position {
        Some(position) => Some(
            NpcDialoguePosition::parse(position.x, position.y)
                .ok_or_else(ApiError::invalid_request)?,
        ),
        None => None,
    };
    NpcDialogueNodeForm::parse(
        &request.node_type,
        &request.title,
        request.body.as_deref(),
        request.config,
        position,
    )
    .ok_or_else(ApiError::invalid_request)
}

fn transition_form(
    request: DialogueTransitionRequest,
) -> Result<NpcDialogueTransitionForm, ApiError> {
    NpcDialogueTransitionForm::parse(
        request.from_node_id,
        request.to_node_id,
        &request.from_connector,
        &request.to_connector,
    )
    .ok_or_else(ApiError::invalid_request)
}

pub async fn show(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminNpcDialogueGraph>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminWorldNpcDialogueRepository::new(&state.application_database);
    let graph = AdminWorldNpcDialogueCommand::new(&repository)
        .load(&principal, activity_id)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(graph))
}

pub async fn create(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateNpcDialogueActivityRequest>,
) -> Result<(StatusCode, Json<CreateNpcDialogueActivityResponse>), ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let form = NpcDialogueActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNpcDialogueRepository::new(&state.application_database);
    let created = AdminWorldNpcDialogueCommand::new(&repository)
        .create(&principal, node_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateNpcDialogueActivityResponse {
            activity_id: created.activity_id,
        }),
    ))
}

pub async fn create_node(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<DialogueNodeRequest>,
) -> Result<(StatusCode, Json<CreatedResource>), ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let form = node_form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNpcDialogueRepository::new(&state.application_database);
    let id = AdminWorldNpcDialogueCommand::new(&repository)
        .create_node(&principal, activity_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((StatusCode::CREATED, Json(CreatedResource { id })))
}

pub async fn update_node(
    State(state): State<AppState>,
    Path((activity_id, dialogue_node_id)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<DialogueNodeRequest>,
) -> Result<StatusCode, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let dialogue_node_id = Uuid::parse_str(&dialogue_node_id).map_err(|_| ApiError::not_found())?;
    let form = node_form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNpcDialogueRepository::new(&state.application_database);
    AdminWorldNpcDialogueCommand::new(&repository)
        .update_node(&principal, activity_id, dialogue_node_id, &form)
        .await
        .map_err(map_error)?
        .then_some(StatusCode::NO_CONTENT)
        .ok_or_else(ApiError::not_found)
}

pub async fn delete_node(
    State(state): State<AppState>,
    Path((activity_id, dialogue_node_id)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let dialogue_node_id = Uuid::parse_str(&dialogue_node_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNpcDialogueRepository::new(&state.application_database);
    AdminWorldNpcDialogueCommand::new(&repository)
        .delete_node(&principal, activity_id, dialogue_node_id)
        .await
        .map_err(map_error)?
        .then_some(StatusCode::NO_CONTENT)
        .ok_or_else(ApiError::not_found)
}

pub async fn create_transition(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<DialogueTransitionRequest>,
) -> Result<(StatusCode, Json<CreatedResource>), ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let form = transition_form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNpcDialogueRepository::new(&state.application_database);
    let id = AdminWorldNpcDialogueCommand::new(&repository)
        .create_transition(&principal, activity_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((StatusCode::CREATED, Json(CreatedResource { id })))
}

pub async fn delete_transition(
    State(state): State<AppState>,
    Path((activity_id, transition_id)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let transition_id = Uuid::parse_str(&transition_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNpcDialogueRepository::new(&state.application_database);
    AdminWorldNpcDialogueCommand::new(&repository)
        .delete_transition(&principal, activity_id, transition_id)
        .await
        .map_err(map_error)?
        .then_some(StatusCode::NO_CONTENT)
        .ok_or_else(ApiError::not_found)
}

pub async fn update_layout(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<DialoguePositionRequest>,
) -> Result<StatusCode, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let position =
        NpcDialoguePosition::parse(request.x, request.y).ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNpcDialogueRepository::new(&state.application_database);
    AdminWorldNpcDialogueCommand::new(&repository)
        .update_layout(&principal, activity_id, position)
        .await
        .map_err(map_error)?
        .then_some(StatusCode::NO_CONTENT)
        .ok_or_else(ApiError::not_found)
}

fn map_error(error: AdminWorldNpcDialogueError) -> ApiError {
    match error {
        AdminWorldNpcDialogueError::Conflict => ApiError::conflict(),
        AdminWorldNpcDialogueError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldNpcDialogueError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::DialogueNodeRequest;

    #[test]
    fn dialogue_nodes_require_a_source_shaped_config_object() {
        assert!(
            serde_json::from_str::<DialogueNodeRequest>(
                r#"{"node_type":"npc_monologue","title":"Guide","body":"Hello","config":{}}"#
            )
            .is_ok()
        );
        assert!(
            serde_json::from_str::<DialogueNodeRequest>(
                r#"{"node_type":"npc_monologue","title":"Guide"}"#
            )
            .is_err()
        );
    }
}
