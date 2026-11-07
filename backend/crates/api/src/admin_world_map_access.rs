use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::admin_world_map_access::{
    AdminWorldMapAccessCommand, AdminWorldMapAccessError, UpdateWorldMapAccessForm,
};
use wicked_learning_persistence::admin_world_map_access::PostgresAdminWorldMapAccessRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdateMapAccessRequest {
    access_roles: Vec<String>,
}

/// Replaces the source map's viewer groups without changing its editable-group
/// assignments or any learner state.
pub async fn update(
    State(state): State<AppState>,
    Path(map_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateMapAccessRequest>,
) -> Result<StatusCode, ApiError> {
    let map_id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let form = UpdateWorldMapAccessForm::parse(&request.access_roles)
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapAccessRepository::new(&state.application_database);
    AdminWorldMapAccessCommand::new(&repository)
        .execute(&principal, map_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(StatusCode::NO_CONTENT)
}

fn map_error(error: AdminWorldMapAccessError) -> ApiError {
    match error {
        AdminWorldMapAccessError::InvalidAccessRole => ApiError::invalid_request(),
        AdminWorldMapAccessError::Unavailable => ApiError::service_unavailable(),
    }
}
