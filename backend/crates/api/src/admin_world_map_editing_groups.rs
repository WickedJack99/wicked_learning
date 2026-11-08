use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::admin_world_map_editing_groups::{
    AdminWorldMapEditingGroupsCommand, AdminWorldMapEditingGroupsError,
    UpdateWorldMapEditingGroupsForm,
};
use wicked_learning_persistence::admin_world_map_editing_groups::PostgresAdminWorldMapEditingGroupsRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdateMapEditingGroupsRequest {
    group_ids: Vec<Uuid>,
}

pub async fn update(
    State(state): State<AppState>,
    Path(map_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateMapEditingGroupsRequest>,
) -> Result<StatusCode, ApiError> {
    let map_id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let form = UpdateWorldMapEditingGroupsForm::new(request.group_ids)
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapEditingGroupsRepository::new(&state.application_database);
    AdminWorldMapEditingGroupsCommand::new(&repository)
        .execute(&principal, map_id, &form)
        .await
        .map_err(|error| match error {
            AdminWorldMapEditingGroupsError::InvalidGroup => ApiError::invalid_request(),
            AdminWorldMapEditingGroupsError::Unavailable => ApiError::service_unavailable(),
        })?
        .ok_or_else(ApiError::not_found)?;
    Ok(StatusCode::NO_CONTENT)
}
