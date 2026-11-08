use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::admin_source_records::{
    AdminSourceRecordsCommand, SourceRecordForm, SourceRecordPageRequest,
    SourceRecordVersionPageRequest,
};
use wicked_learning_domain::world_content::{
    AdminSourceRecord, AdminSourceRecordPage, AdminSourceRecordVersionPage,
};
use wicked_learning_persistence::admin_source_records::PostgresAdminSourceRecordsRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct SourceRecordQuery {
    page: Option<i64>,
    per_page: Option<i64>,
    search: Option<String>,
    concept: Option<String>,
}
#[derive(Deserialize)]
pub struct SourceRecordVersionQuery {
    page: Option<i64>,
    per_page: Option<i64>,
}
#[derive(Deserialize)]
pub struct SourceRecordRequest {
    title: String,
    url: String,
    publisher: Option<String>,
    published_at: Option<String>,
    rights: Option<String>,
    anchor: Option<String>,
    excerpt: Option<String>,
    #[serde(default)]
    concepts: Vec<String>,
}
#[derive(Serialize)]
pub struct SourceRecordResponse {
    pub source_record: AdminSourceRecord,
}

/// Lists the source editor's bounded, searchable reusable citation catalog.
pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<SourceRecordQuery>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminSourceRecordPage>, ApiError> {
    let page = SourceRecordPageRequest::parse(query.page, query.per_page)
        .ok_or_else(ApiError::invalid_request)?;
    if query
        .search
        .as_ref()
        .is_some_and(|value| value.chars().count() > 160)
        || query
            .concept
            .as_ref()
            .is_some_and(|value| value.chars().count() > 120)
    {
        return Err(ApiError::invalid_request());
    }
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminSourceRecordsRepository::new(&state.application_database);
    AdminSourceRecordsCommand::new(&repository)
        .list(
            &principal,
            page,
            query.search.as_deref(),
            query.concept.as_deref(),
        )
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
    Json(request): Json<SourceRecordRequest>,
) -> Result<(StatusCode, Json<SourceRecordResponse>), ApiError> {
    let form = form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminSourceRecordsRepository::new(&state.application_database);
    let source_record = AdminSourceRecordsCommand::new(&repository)
        .create(&principal, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(SourceRecordResponse { source_record }),
    ))
}

pub async fn update(
    State(state): State<AppState>,
    Path(source_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SourceRecordRequest>,
) -> Result<Json<SourceRecordResponse>, ApiError> {
    let source_id = Uuid::parse_str(&source_id).map_err(|_| ApiError::not_found())?;
    let form = form(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminSourceRecordsRepository::new(&state.application_database);
    let source_record = AdminSourceRecordsCommand::new(&repository)
        .update(&principal, source_id, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(SourceRecordResponse { source_record }))
}

pub async fn versions(
    State(state): State<AppState>,
    Path(source_id): Path<String>,
    Query(query): Query<SourceRecordVersionQuery>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminSourceRecordVersionPage>, ApiError> {
    let source_id = Uuid::parse_str(&source_id).map_err(|_| ApiError::not_found())?;
    let page = SourceRecordVersionPageRequest::parse(query.page, query.per_page)
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminSourceRecordsRepository::new(&state.application_database);
    AdminSourceRecordsCommand::new(&repository)
        .versions(&principal, source_id, page)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn restore(
    State(state): State<AppState>,
    Path((source_id, version_id)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<SourceRecordResponse>, ApiError> {
    let source_id = Uuid::parse_str(&source_id).map_err(|_| ApiError::not_found())?;
    let version_id = Uuid::parse_str(&version_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminSourceRecordsRepository::new(&state.application_database);
    let source_record = AdminSourceRecordsCommand::new(&repository)
        .restore(&principal, source_id, version_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(SourceRecordResponse { source_record }))
}

pub async fn delete(
    State(state): State<AppState>,
    Path(source_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let source_id = Uuid::parse_str(&source_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminSourceRecordsRepository::new(&state.application_database);
    if !AdminSourceRecordsCommand::new(&repository)
        .delete(&principal, source_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
    {
        return Err(ApiError::not_found());
    }
    Ok(StatusCode::NO_CONTENT)
}

fn form(request: SourceRecordRequest) -> Result<SourceRecordForm, ApiError> {
    SourceRecordForm::parse(
        &request.title,
        &request.url,
        request.publisher.as_deref(),
        request.published_at.as_deref(),
        request.rights.as_deref(),
        request.anchor.as_deref(),
        request.excerpt.as_deref(),
        &request.concepts,
    )
    .ok_or_else(ApiError::invalid_request)
}

#[cfg(test)]
mod tests {
    use super::SourceRecordRequest;
    #[test]
    fn source_catalog_request_defaults_its_optional_concept_list() {
        let request = serde_json::from_str::<SourceRecordRequest>(
            r#"{"title":"A source","url":"https://example.test"}"#,
        )
        .expect("request");
        assert!(request.concepts.is_empty());
    }
}
