use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::admin_topics::{
    AdminTopicsCommand, AdminTopicsQuery, TopicAreaForm, TopicForm,
};
use wicked_learning_domain::world_content::{AdminTopic, AdminTopicAdministration, AdminTopicArea};
use wicked_learning_persistence::admin_topics::PostgresAdminTopicsRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct SaveTopicAreaRequest {
    title: String,
    description: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateTopicAreaRequest {
    #[serde(flatten)]
    form: SaveTopicAreaRequest,
    after_area_id: Option<String>,
}

#[derive(Deserialize)]
pub struct ReorderTopicAreasRequest {
    area_ids: Vec<String>,
}

#[derive(Deserialize)]
pub struct SaveTopicRequest {
    title: String,
    description: Option<String>,
    content: Option<String>,
    parent_id: Option<String>,
    is_published: Option<bool>,
}

#[derive(Serialize)]
pub struct TopicAreaResponse {
    pub area: AdminTopicArea,
}

#[derive(Serialize)]
pub struct TopicResponse {
    pub topic: AdminTopic,
}

pub async fn index(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminTopicAdministration>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminTopicsRepository::new(&state.application_database);
    AdminTopicsQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn create_area(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateTopicAreaRequest>,
) -> Result<(StatusCode, Json<TopicAreaResponse>), ApiError> {
    let form = topic_area_form(request.form)?;
    let after_area_id = optional_uuid(request.after_area_id)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminTopicsRepository::new(&state.application_database);
    let area = AdminTopicsCommand::new(&repository)
        .create_area(&principal, &form, after_area_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok((StatusCode::CREATED, Json(TopicAreaResponse { area })))
}

pub async fn update_area(
    State(state): State<AppState>,
    Path(area_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveTopicAreaRequest>,
) -> Result<Json<TopicAreaResponse>, ApiError> {
    let area_id = required_uuid(&area_id)?;
    let form = topic_area_form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminTopicsRepository::new(&state.application_database);
    AdminTopicsCommand::new(&repository)
        .update_area(&principal, area_id, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|area| Json(TopicAreaResponse { area }))
        .ok_or_else(ApiError::not_found)
}

pub async fn reorder_areas(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<ReorderTopicAreasRequest>,
) -> Result<StatusCode, ApiError> {
    let area_ids = request
        .area_ids
        .iter()
        .map(|id| required_uuid(id))
        .collect::<Result<Vec<_>, _>>()?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminTopicsRepository::new(&state.application_database);
    let reordered = AdminTopicsCommand::new(&repository)
        .reorder_areas(&principal, &area_ids)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    if !reordered {
        return Err(ApiError::invalid_request());
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn create_topic(
    State(state): State<AppState>,
    Path(area_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveTopicRequest>,
) -> Result<(StatusCode, Json<TopicResponse>), ApiError> {
    let area_id = required_uuid(&area_id)?;
    let form = topic_form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminTopicsRepository::new(&state.application_database);
    let topic = AdminTopicsCommand::new(&repository)
        .create_topic(&principal, area_id, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::invalid_request)?;
    Ok((StatusCode::CREATED, Json(TopicResponse { topic })))
}

pub async fn update_topic(
    State(state): State<AppState>,
    Path((area_id, topic_id)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveTopicRequest>,
) -> Result<Json<TopicResponse>, ApiError> {
    let area_id = required_uuid(&area_id)?;
    let topic_id = required_uuid(&topic_id)?;
    let form = topic_form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminTopicsRepository::new(&state.application_database);
    AdminTopicsCommand::new(&repository)
        .update_topic(&principal, area_id, topic_id, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|topic| Json(TopicResponse { topic }))
        .ok_or_else(ApiError::not_found)
}

fn topic_area_form(request: SaveTopicAreaRequest) -> Result<TopicAreaForm, ApiError> {
    TopicAreaForm::parse(&request.title, request.description.as_deref())
        .ok_or_else(ApiError::invalid_request)
}

fn topic_form(request: SaveTopicRequest) -> Result<TopicForm, ApiError> {
    TopicForm::parse(
        &request.title,
        request.description.as_deref(),
        request.content.as_deref(),
        optional_uuid(request.parent_id)?,
        request.is_published,
    )
    .ok_or_else(ApiError::invalid_request)
}

fn required_uuid(value: &str) -> Result<Uuid, ApiError> {
    Uuid::parse_str(value).map_err(|_| ApiError::not_found())
}

fn optional_uuid(value: Option<String>) -> Result<Option<Uuid>, ApiError> {
    value
        .filter(|value| !value.trim().is_empty())
        .map(|value| Uuid::parse_str(&value).map_err(|_| ApiError::invalid_request()))
        .transpose()
}
