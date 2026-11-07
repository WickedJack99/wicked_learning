use std::collections::BTreeMap;

use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use wicked_learning_application::admin_role::{
    AdminRoleDeletion, AdminRoleForm, AdminRolesCommand, AdminRolesQuery,
};
use wicked_learning_domain::identity_access::{AdminRole, AdminRoles};
use wicked_learning_persistence::admin_role::PostgresAdminRoleRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct SaveAdminRoleRequest {
    pub description: Option<String>,
    pub level: i32,
    pub name: String,
    pub permission_scopes: BTreeMap<String, String>,
    pub permissions: BTreeMap<String, String>,
    pub role_key: Option<String>,
}

#[derive(Serialize)]
pub struct AdminRoleResponse {
    pub role: AdminRole,
}

pub async fn index(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminRoles>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminRoleRepository::new(&state.application_database);
    AdminRolesQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveAdminRoleRequest>,
) -> Result<(StatusCode, Json<AdminRoleResponse>), ApiError> {
    let role_key = request
        .role_key
        .clone()
        .ok_or_else(ApiError::invalid_request)?;
    let form = form_from_request(&role_key, request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    if !principal.has_permission("roles", "ru") {
        return Err(ApiError::not_found());
    }
    let repository = PostgresAdminRoleRepository::new(&state.application_database);
    let role = AdminRolesCommand::new(&repository)
        .create(&principal, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::invalid_request)?;
    Ok((StatusCode::CREATED, Json(AdminRoleResponse { role })))
}

pub async fn update(
    State(state): State<AppState>,
    Path(role_key): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveAdminRoleRequest>,
) -> Result<Json<AdminRoleResponse>, ApiError> {
    let form = form_from_request(&role_key, request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminRoleRepository::new(&state.application_database);
    let role = AdminRolesCommand::new(&repository)
        .update(&principal, &role_key, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(AdminRoleResponse { role }))
}

pub async fn destroy(
    State(state): State<AppState>,
    Path(role_key): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminRoleRepository::new(&state.application_database);
    match AdminRolesCommand::new(&repository)
        .delete(&principal, &role_key)
        .await
        .map_err(|_| ApiError::service_unavailable())?
    {
        AdminRoleDeletion::Deleted => Ok(StatusCode::NO_CONTENT),
        AdminRoleDeletion::Missing => Err(ApiError::not_found()),
        AdminRoleDeletion::Protected => Err(ApiError::invalid_request()),
    }
}

fn form_from_request(
    role_key: &str,
    request: SaveAdminRoleRequest,
) -> Result<AdminRoleForm, ApiError> {
    AdminRoleForm::parse(
        role_key,
        &request.name,
        request.description.as_deref(),
        request.level,
        request.permissions,
        request.permission_scopes,
    )
    .ok_or_else(ApiError::invalid_request)
}
