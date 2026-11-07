use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};
use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::admin_world_node_transition::{
    AdminWorldNodeTransitionCommand, AdminWorldNodeTransitionError, CreateActivityTransition,
    UpdateActivityTransition,
};
use wicked_learning_domain::world_content::AdminActivityTransition;
use wicked_learning_persistence::admin_world_node_transition::PostgresAdminWorldNodeTransitionRepository;

#[derive(Deserialize)]
pub struct CreateTransitionRequest {
    from_activity_id: String,
    to_activity_id: Option<String>,
    from_connector: String,
    to_connector: String,
    label: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateTransitionRequest {
    label: Option<String>,
    trigger_value: Option<String>,
}
#[derive(Serialize)]
pub struct TransitionsResponse {
    pub transitions: Vec<AdminActivityTransition>,
}

pub async fn create(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateTransitionRequest>,
) -> Result<Json<TransitionsResponse>, ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let from_activity_id =
        Uuid::parse_str(&request.from_activity_id).map_err(|_| ApiError::invalid_request())?;
    let to_activity_id = request
        .to_activity_id
        .as_deref()
        .map(Uuid::parse_str)
        .transpose()
        .map_err(|_| ApiError::invalid_request())?;
    let form = CreateActivityTransition::parse(
        from_activity_id,
        to_activity_id,
        &request.from_connector,
        &request.to_connector,
        request.label.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNodeTransitionRepository::new(&state.application_database);
    let transitions = AdminWorldNodeTransitionCommand::new(&repository)
        .create(&principal, node_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(TransitionsResponse { transitions }))
}

/// Mirrors Laravel's transition editor: only the display label and an
/// outcome's optional value can change after a graph edge exists.
pub async fn update(
    State(state): State<AppState>,
    Path(transition_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateTransitionRequest>,
) -> Result<Json<TransitionsResponse>, ApiError> {
    let transition_id = Uuid::parse_str(&transition_id).map_err(|_| ApiError::not_found())?;
    let form =
        UpdateActivityTransition::parse(request.label.as_deref(), request.trigger_value.as_deref())
            .ok_or_else(ApiError::invalid_request)?;
    execute_mutation(
        &state,
        headers,
        csrf_token,
        auth_session,
        TransitionMutation::Update {
            transition_id,
            form,
        },
    )
    .await
}

pub async fn delete(
    State(state): State<AppState>,
    Path(transition_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<TransitionsResponse>, ApiError> {
    let transition_id = Uuid::parse_str(&transition_id).map_err(|_| ApiError::not_found())?;
    execute_mutation(
        &state,
        headers,
        csrf_token,
        auth_session,
        TransitionMutation::Delete { transition_id },
    )
    .await
}

enum TransitionMutation {
    Update {
        transition_id: Uuid,
        form: UpdateActivityTransition,
    },
    Delete {
        transition_id: Uuid,
    },
}

async fn execute_mutation(
    state: &AppState,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    operation: TransitionMutation,
) -> Result<Json<TransitionsResponse>, ApiError> {
    let principal = authenticated_principal(state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNodeTransitionRepository::new(&state.application_database);
    let command = AdminWorldNodeTransitionCommand::new(&repository);
    let transitions = match operation {
        TransitionMutation::Update {
            transition_id,
            form,
        } => command.update(&principal, transition_id, &form).await,
        TransitionMutation::Delete { transition_id } => {
            command.delete(&principal, transition_id).await
        }
    }
    .map_err(map_error)?
    .ok_or_else(ApiError::not_found)?;
    Ok(Json(TransitionsResponse { transitions }))
}

fn map_error(error: AdminWorldNodeTransitionError) -> ApiError {
    match error {
        AdminWorldNodeTransitionError::InvalidTransition => ApiError::invalid_request(),
        AdminWorldNodeTransitionError::Unavailable => ApiError::service_unavailable(),
    }
}
