use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::admin_activity_templates::{
    ActivityTemplateName, ActivityTemplatePageRequest, ActivityTemplateRevisionPageRequest,
    AdminActivityTemplatesCommand,
};
use wicked_learning_domain::world_content::{
    AdminActivityTemplateDetails, AdminActivityTemplatePage, AdminActivityTemplateRevisionDetails,
    AdminActivityTemplateRevisionPage, AdminActivityTemplateSummary,
};
use wicked_learning_persistence::admin_activity_templates::PostgresAdminActivityTemplatesRepository;
#[derive(Deserialize)]
pub struct PageQuery {
    page: Option<i64>,
    per_page: Option<i64>,
    search: Option<String>,
}
#[derive(Deserialize)]
pub struct RevisionQuery {
    page: Option<i64>,
    per_page: Option<i64>,
}
#[derive(Deserialize)]
pub struct NameRequest {
    name: String,
}
#[derive(Deserialize)]
pub struct ShareRequest {
    organization_id: Option<String>,
}
#[derive(Serialize)]
pub struct TemplateResponse {
    pub template: AdminActivityTemplateSummary,
}
#[derive(Serialize)]
pub struct DetailsResponse {
    pub template: AdminActivityTemplateDetails,
}
#[derive(Serialize)]
pub struct RevisionDetailsResponse {
    pub revision: AdminActivityTemplateRevisionDetails,
}
fn repo(state: &AppState) -> PostgresAdminActivityTemplatesRepository<'_> {
    PostgresAdminActivityTemplatesRepository::new(&state.application_database)
}
fn id(value: String) -> Result<Uuid, ApiError> {
    Uuid::parse_str(&value).map_err(|_| ApiError::not_found())
}
async fn actor(
    state: &AppState,
    session: AuthSession<IdentityBackend>,
) -> Result<wicked_learning_domain::identity_access::AuthorizedPrincipal, ApiError> {
    authenticated_principal(state, session).await
}
pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<PageQuery>,
    session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminActivityTemplatePage>, ApiError> {
    let page = ActivityTemplatePageRequest::parse(query.page, query.per_page)
        .ok_or_else(ApiError::invalid_request)?;
    if query
        .search
        .as_ref()
        .is_some_and(|v| v.chars().count() > 120)
    {
        return Err(ApiError::invalid_request());
    }
    let principal = actor(&state, session).await?;
    AdminActivityTemplatesCommand::new(&repo(&state))
        .list(&principal, page, query.search.as_deref())
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
pub async fn create(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<NameRequest>,
) -> Result<(StatusCode, Json<TemplateResponse>), ApiError> {
    let name = ActivityTemplateName::parse(&request.name).ok_or_else(ApiError::invalid_request)?;
    let principal = actor(&state, session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let template = AdminActivityTemplatesCommand::new(&repo(&state))
        .create_from_activity(&principal, id(activity_id)?, &name)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok((StatusCode::CREATED, Json(TemplateResponse { template })))
}
pub async fn show(
    State(state): State<AppState>,
    Path(template_id): Path<String>,
    session: AuthSession<IdentityBackend>,
) -> Result<Json<DetailsResponse>, ApiError> {
    let principal = actor(&state, session).await?;
    let template = AdminActivityTemplatesCommand::new(&repo(&state))
        .details(&principal, id(template_id)?)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(DetailsResponse { template }))
}
pub async fn rename(
    State(state): State<AppState>,
    Path(template_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<NameRequest>,
) -> Result<Json<TemplateResponse>, ApiError> {
    let name = ActivityTemplateName::parse(&request.name).ok_or_else(ApiError::invalid_request)?;
    let principal = actor(&state, session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let template = AdminActivityTemplatesCommand::new(&repo(&state))
        .rename(&principal, id(template_id)?, &name)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(TemplateResponse { template }))
}
pub async fn update_from_activity(
    State(state): State<AppState>,
    Path((template_id, activity_id)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
) -> Result<Json<TemplateResponse>, ApiError> {
    let principal = actor(&state, session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let template = AdminActivityTemplatesCommand::new(&repo(&state))
        .update_from_activity(&principal, id(template_id)?, id(activity_id)?)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(TemplateResponse { template }))
}
pub async fn share(
    State(state): State<AppState>,
    Path(template_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
    Json(request): Json<ShareRequest>,
) -> Result<Json<TemplateResponse>, ApiError> {
    let organization_id = request.organization_id.map(id).transpose()?;
    let principal = actor(&state, session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let template = AdminActivityTemplatesCommand::new(&repo(&state))
        .share(&principal, id(template_id)?, organization_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(TemplateResponse { template }))
}
pub async fn revisions(
    State(state): State<AppState>,
    Path(template_id): Path<String>,
    Query(query): Query<RevisionQuery>,
    session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminActivityTemplateRevisionPage>, ApiError> {
    let page = ActivityTemplateRevisionPageRequest::parse(query.page, query.per_page)
        .ok_or_else(ApiError::invalid_request)?;
    let principal = actor(&state, session).await?;
    AdminActivityTemplatesCommand::new(&repo(&state))
        .revisions(&principal, id(template_id)?, page)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
pub async fn revision(
    State(state): State<AppState>,
    Path((template_id, revision_id)): Path<(String, String)>,
    session: AuthSession<IdentityBackend>,
) -> Result<Json<RevisionDetailsResponse>, ApiError> {
    let principal = actor(&state, session).await?;
    let revision = AdminActivityTemplatesCommand::new(&repo(&state))
        .revision_details(&principal, id(template_id)?, id(revision_id)?)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(RevisionDetailsResponse { revision }))
}
pub async fn restore(
    State(state): State<AppState>,
    Path((template_id, revision_id)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
) -> Result<Json<TemplateResponse>, ApiError> {
    let principal = actor(&state, session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let template = AdminActivityTemplatesCommand::new(&repo(&state))
        .restore(&principal, id(template_id)?, id(revision_id)?)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(TemplateResponse { template }))
}
pub async fn delete(
    State(state): State<AppState>,
    Path(template_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let principal = actor(&state, session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    if !AdminActivityTemplatesCommand::new(&repo(&state))
        .delete(&principal, id(template_id)?)
        .await
        .map_err(|_| ApiError::service_unavailable())?
    {
        return Err(ApiError::not_found());
    }
    Ok(StatusCode::NO_CONTENT)
}
