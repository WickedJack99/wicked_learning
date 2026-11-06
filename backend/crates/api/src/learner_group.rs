use axum::{
    Json,
    extract::{Path, Query, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::learner_group::{
    LearnerGroupCommand, LearnerGroupsQuery, valid_message_body,
};
use wicked_learning_domain::learner_state::{LearnerGroup, LearnerGroupPage};
use wicked_learning_persistence::learner_group::PostgresLearnerGroupRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct GroupsQuery {
    page: Option<i64>,
    per_page: Option<i64>,
}

#[derive(Deserialize)]
pub struct SendGroupMessage {
    body: String,
    #[serde(default)]
    is_help_request: bool,
}

#[derive(Serialize)]
pub struct GroupResponse {
    group: LearnerGroup,
}

pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<GroupsQuery>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerGroupPage>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository =
        PostgresLearnerGroupRepository::new(&state.application_database, &state.identity_database);
    LearnerGroupsQuery::new(&repository)
        .execute(
            &principal,
            query.page.unwrap_or(1),
            query.per_page.unwrap_or(1),
        )
        .await
        .map(Json)
        .map_err(|_| ApiError::service_unavailable())
}

pub async fn send_message(
    State(state): State<AppState>,
    Path(group_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SendGroupMessage>,
) -> Result<Json<GroupResponse>, ApiError> {
    if valid_message_body(&request.body).is_none() {
        return Err(ApiError::invalid_request());
    }
    let group_id = Uuid::parse_str(&group_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresLearnerGroupRepository::new(&state.application_database, &state.identity_database);
    LearnerGroupCommand::new(&repository)
        .send_message(&principal, group_id, &request.body, request.is_help_request)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|group| Json(GroupResponse { group }))
        .ok_or_else(ApiError::not_found)
}

pub async fn resolve_help_request(
    State(state): State<AppState>,
    Path((group_id, message_id)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<GroupResponse>, ApiError> {
    let group_id = Uuid::parse_str(&group_id).map_err(|_| ApiError::not_found())?;
    let message_id = Uuid::parse_str(&message_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresLearnerGroupRepository::new(&state.application_database, &state.identity_database);
    LearnerGroupCommand::new(&repository)
        .resolve_help_request(&principal, group_id, message_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|group| Json(GroupResponse { group }))
        .ok_or_else(ApiError::not_found)
}

pub async fn vote_for_admin_chat_access(
    State(state): State<AppState>,
    Path(group_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<GroupResponse>, ApiError> {
    let group_id = Uuid::parse_str(&group_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresLearnerGroupRepository::new(&state.application_database, &state.identity_database);
    LearnerGroupCommand::new(&repository)
        .vote_for_admin_chat_access(&principal, group_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|group| Json(GroupResponse { group }))
        .ok_or_else(ApiError::not_found)
}
