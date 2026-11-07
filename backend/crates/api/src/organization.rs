use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::organization::{
    OrganizationCommand, OrganizationForm, OrganizationsQuery, valid_message_body,
};
use wicked_learning_domain::organization::{OrganizationDetail, OrganizationDirectory};
use wicked_learning_persistence::organization::PostgresOrganizationRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct DirectoryQuery {
    page: Option<i64>,
    search: Option<String>,
}
#[derive(Deserialize)]
pub struct DetailQuery {
    members_page: Option<i64>,
    messages_page: Option<i64>,
    join_requests_page: Option<i64>,
}
#[derive(Deserialize)]
pub struct SaveOrganizationRequest {
    pub name: String,
    pub slogan: Option<String>,
    pub description: Option<String>,
    pub governance_type: Option<String>,
}
#[derive(Deserialize)]
pub struct JoinRequest {
    pub message: Option<String>,
}
#[derive(Deserialize)]
pub struct JoinDecision {
    pub approved: bool,
}
#[derive(Deserialize)]
pub struct MessageRequest {
    pub body: String,
}
#[derive(Serialize)]
pub struct OrganizationResponse {
    pub organization: OrganizationDetail,
}

pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<DirectoryQuery>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<OrganizationDirectory>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository =
        PostgresOrganizationRepository::new(&state.application_database, &state.identity_database);
    OrganizationsQuery::new(&repository)
        .list(&principal, query.page.unwrap_or(1), query.search.as_deref())
        .await
        .map(Json)
        .map_err(|_| ApiError::service_unavailable())
}
pub async fn show(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Query(query): Query<DetailQuery>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<OrganizationResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository =
        PostgresOrganizationRepository::new(&state.application_database, &state.identity_database);
    OrganizationsQuery::new(&repository)
        .show(
            &principal,
            &slug,
            query.members_page.unwrap_or(1),
            query.messages_page.unwrap_or(1),
            query.join_requests_page.unwrap_or(1),
        )
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|organization| Json(OrganizationResponse { organization }))
        .ok_or_else(ApiError::not_found)
}
pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveOrganizationRequest>,
) -> Result<(StatusCode, Json<OrganizationResponse>), ApiError> {
    let form = form_from_request(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresOrganizationRepository::new(&state.application_database, &state.identity_database);
    OrganizationCommand::new(&repository)
        .create(&principal, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|organization| {
            (
                StatusCode::CREATED,
                Json(OrganizationResponse { organization }),
            )
        })
        .ok_or_else(ApiError::invalid_request)
}
pub async fn update(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveOrganizationRequest>,
) -> Result<Json<OrganizationResponse>, ApiError> {
    let form = form_from_request(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresOrganizationRepository::new(&state.application_database, &state.identity_database);
    OrganizationCommand::new(&repository)
        .update(&principal, &slug, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|organization| Json(OrganizationResponse { organization }))
        .ok_or_else(ApiError::not_found)
}
pub async fn delete(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresOrganizationRepository::new(&state.application_database, &state.identity_database);
    OrganizationCommand::new(&repository)
        .delete(&principal, &slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .then_some(StatusCode::NO_CONTENT)
        .ok_or_else(ApiError::not_found)
}
pub async fn request_join(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<JoinRequest>,
) -> Result<Json<OrganizationResponse>, ApiError> {
    if request
        .message
        .as_deref()
        .is_some_and(|value| value.trim().chars().count() > 1_000)
    {
        return Err(ApiError::invalid_request());
    }
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresOrganizationRepository::new(&state.application_database, &state.identity_database);
    OrganizationCommand::new(&repository)
        .request_join(&principal, &slug, request.message.as_deref())
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|organization| Json(OrganizationResponse { organization }))
        .ok_or_else(ApiError::not_found)
}
pub async fn respond_to_join_request(
    State(state): State<AppState>,
    Path(request_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<JoinDecision>,
) -> Result<Json<OrganizationResponse>, ApiError> {
    let request_id = Uuid::parse_str(&request_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresOrganizationRepository::new(&state.application_database, &state.identity_database);
    OrganizationCommand::new(&repository)
        .respond_to_join_request(&principal, request_id, request.approved)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|organization| Json(OrganizationResponse { organization }))
        .ok_or_else(ApiError::not_found)
}
pub async fn leave(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<OrganizationResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresOrganizationRepository::new(&state.application_database, &state.identity_database);
    OrganizationCommand::new(&repository)
        .leave(&principal, &slug)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|organization| Json(OrganizationResponse { organization }))
        .ok_or_else(ApiError::not_found)
}
pub async fn promote_member(
    State(state): State<AppState>,
    Path(membership_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<OrganizationResponse>, ApiError> {
    let membership_id = Uuid::parse_str(&membership_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresOrganizationRepository::new(&state.application_database, &state.identity_database);
    OrganizationCommand::new(&repository)
        .promote_member(&principal, membership_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|organization| Json(OrganizationResponse { organization }))
        .ok_or_else(ApiError::not_found)
}
pub async fn remove_member(
    State(state): State<AppState>,
    Path(membership_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<OrganizationResponse>, ApiError> {
    let membership_id = Uuid::parse_str(&membership_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresOrganizationRepository::new(&state.application_database, &state.identity_database);
    OrganizationCommand::new(&repository)
        .remove_member(&principal, membership_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|organization| Json(OrganizationResponse { organization }))
        .ok_or_else(ApiError::not_found)
}
pub async fn send_message(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<MessageRequest>,
) -> Result<Json<OrganizationResponse>, ApiError> {
    if valid_message_body(&request.body).is_none() {
        return Err(ApiError::invalid_request());
    }
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresOrganizationRepository::new(&state.application_database, &state.identity_database);
    OrganizationCommand::new(&repository)
        .send_message(&principal, &slug, &request.body)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|organization| Json(OrganizationResponse { organization }))
        .ok_or_else(ApiError::not_found)
}
pub async fn delete_message(
    State(state): State<AppState>,
    Path(message_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<OrganizationResponse>, ApiError> {
    let message_id = Uuid::parse_str(&message_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresOrganizationRepository::new(&state.application_database, &state.identity_database);
    OrganizationCommand::new(&repository)
        .delete_message(&principal, message_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|organization| Json(OrganizationResponse { organization }))
        .ok_or_else(ApiError::not_found)
}
pub async fn hide_message(
    State(state): State<AppState>,
    Path(message_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<OrganizationResponse>, ApiError> {
    let message_id = Uuid::parse_str(&message_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresOrganizationRepository::new(&state.application_database, &state.identity_database);
    OrganizationCommand::new(&repository)
        .hide_message(&principal, message_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|organization| Json(OrganizationResponse { organization }))
        .ok_or_else(ApiError::not_found)
}
fn form_from_request(request: SaveOrganizationRequest) -> Result<OrganizationForm, ApiError> {
    OrganizationForm::parse(
        &request.name,
        request.slogan.as_deref(),
        request.description.as_deref(),
        request.governance_type.as_deref().unwrap_or("monarchy"),
    )
    .ok_or_else(ApiError::invalid_request)
}
