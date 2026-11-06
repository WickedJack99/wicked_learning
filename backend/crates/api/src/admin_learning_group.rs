use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::admin_learning_group::{
    AdminLearningGroupsCommand, AdminLearningGroupsQuery, LearningGroupForm,
};
use wicked_learning_domain::learner_state::{AdminLearningGroup, AdminLearningGroups};
use wicked_learning_persistence::admin_learning_group::PostgresAdminLearningGroupRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct SaveLearningGroupRequest {
    pub description: Option<String>,
    pub name: String,
    pub slug: Option<String>,
    pub study_topic: Option<String>,
}

#[derive(Deserialize)]
pub struct SyncLearningGroupMembersRequest {
    pub member_ids: Vec<String>,
}

#[derive(Serialize)]
pub struct LearningGroupResponse {
    pub group: AdminLearningGroup,
}

pub async fn index(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminLearningGroups>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminLearningGroupRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    AdminLearningGroupsQuery::new(&repository)
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
    Json(request): Json<SaveLearningGroupRequest>,
) -> Result<(StatusCode, Json<LearningGroupResponse>), ApiError> {
    let form = form_from_request(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminLearningGroupRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    let group = AdminLearningGroupsCommand::new(&repository)
        .create(&principal, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok((StatusCode::CREATED, Json(LearningGroupResponse { group })))
}

pub async fn update(
    State(state): State<AppState>,
    Path(group_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveLearningGroupRequest>,
) -> Result<Json<LearningGroupResponse>, ApiError> {
    let group_id = Uuid::parse_str(&group_id).map_err(|_| ApiError::not_found())?;
    let form = form_from_request(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminLearningGroupRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    AdminLearningGroupsCommand::new(&repository)
        .update(&principal, group_id, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|group| Json(LearningGroupResponse { group }))
        .ok_or_else(ApiError::not_found)
}

pub async fn sync_members(
    State(state): State<AppState>,
    Path(group_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SyncLearningGroupMembersRequest>,
) -> Result<Json<LearningGroupResponse>, ApiError> {
    let group_id = Uuid::parse_str(&group_id).map_err(|_| ApiError::not_found())?;
    let member_subject_ids = request
        .member_ids
        .iter()
        .map(|value| Uuid::parse_str(value).map_err(|_| ApiError::invalid_request()))
        .collect::<Result<Vec<_>, _>>()?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminLearningGroupRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    AdminLearningGroupsCommand::new(&repository)
        .sync_members(&principal, group_id, &member_subject_ids)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|group| Json(LearningGroupResponse { group }))
        .ok_or_else(ApiError::not_found)
}

fn form_from_request(request: SaveLearningGroupRequest) -> Result<LearningGroupForm, ApiError> {
    LearningGroupForm::parse(
        &request.name,
        request.slug.as_deref(),
        request.description.as_deref(),
        request.study_topic.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)
}
