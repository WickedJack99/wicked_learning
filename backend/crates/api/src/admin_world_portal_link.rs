use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::admin_world_portal_link::{
    AdminWorldPortalLinkCommand, AdminWorldPortalLinkError, CreateWorldPortalLinkForm,
};
use wicked_learning_persistence::admin_world_portal_link::PostgresAdminWorldPortalLinkRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct CreateWorldPortalLinkRequest {
    source_node_id: Uuid,
    target_node_id: Uuid,
    label: Option<String>,
    description: Option<String>,
}

#[derive(Serialize)]
pub struct CreateWorldPortalLinkResponse {
    pub portal_link_id: Uuid,
}

/// Creates the source World Builder's node-to-node portal link. Activity
/// portal configuration remains a distinct route because it owns learner
/// arrival scenes and target activities.
pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateWorldPortalLinkRequest>,
) -> Result<(StatusCode, Json<CreateWorldPortalLinkResponse>), ApiError> {
    let form = CreateWorldPortalLinkForm::parse(
        request.source_node_id,
        request.target_node_id,
        request.label.as_deref(),
        request.description.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldPortalLinkRepository::new(&state.application_database);
    let portal_link_id = AdminWorldPortalLinkCommand::new(&repository)
        .create(&principal, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateWorldPortalLinkResponse { portal_link_id }),
    ))
}

/// Deletes one source-shaped graph link only when at least one endpoint is in
/// the caller's current editable-world projection.
pub async fn delete(
    State(state): State<AppState>,
    Path(portal_link_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let portal_link_id = Uuid::parse_str(&portal_link_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldPortalLinkRepository::new(&state.application_database);
    AdminWorldPortalLinkCommand::new(&repository)
        .delete(&principal, portal_link_id)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(StatusCode::NO_CONTENT)
}

fn map_error(error: AdminWorldPortalLinkError) -> ApiError {
    match error {
        AdminWorldPortalLinkError::Conflict => ApiError::conflict(),
        AdminWorldPortalLinkError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::CreateWorldPortalLinkRequest;

    #[test]
    fn request_requires_both_node_endpoints() {
        assert!(serde_json::from_str::<CreateWorldPortalLinkRequest>(
            r#"{"source_node_id":"00000000-0000-4000-8000-000000000001","target_node_id":"00000000-0000-4000-8000-000000000002","label":null,"description":null}"#,
        )
        .is_ok());
        assert!(
            serde_json::from_str::<CreateWorldPortalLinkRequest>(
                r#"{"source_node_id":"00000000-0000-4000-8000-000000000001"}"#,
            )
            .is_err()
        );
    }
}
