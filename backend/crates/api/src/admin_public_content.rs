use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use serde::Deserialize;
use wicked_learning_application::{
    admin_public_content::{
        AdminPublicContentQuery, UpdateAdminPublicInformationPage, UpdateAdminPublicSourceLinks,
        editable_page, valid_markdown, valid_source_links,
    },
    public_page::PublicPageSlug,
};
use wicked_learning_domain::platform_presentation::{PublicPage, PublicSourceLinks};
use wicked_learning_persistence::admin_public_content::PostgresAdminPublicContentRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdatePublicInformationPageRequest {
    body: String,
}

pub async fn pages(
    State(state): State<AppState>,
    auth_session: axum_login::AuthSession<IdentityBackend>,
) -> Result<Json<Vec<PublicPage>>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminPublicContentRepository::new(&state.application_database);

    AdminPublicContentQuery::new(&repository)
        .pages(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn update_page(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: axum_login::AuthSession<IdentityBackend>,
    Json(request): Json<UpdatePublicInformationPageRequest>,
) -> Result<Json<PublicPage>, ApiError> {
    let slug = PublicPageSlug::parse(&slug).ok_or_else(ApiError::not_found)?;
    if !editable_page(&slug) {
        return Err(ApiError::not_found());
    }
    if !valid_markdown(&request.body) {
        return Err(ApiError::invalid_request());
    }
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminPublicContentRepository::new(&state.application_database);

    UpdateAdminPublicInformationPage::new(&repository)
        .execute(&principal, &slug, request.body)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn source_links(
    State(state): State<AppState>,
    auth_session: axum_login::AuthSession<IdentityBackend>,
) -> Result<Json<PublicSourceLinks>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminPublicContentRepository::new(&state.application_database);

    AdminPublicContentQuery::new(&repository)
        .source_links(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn update_source_links(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: axum_login::AuthSession<IdentityBackend>,
    Json(links): Json<PublicSourceLinks>,
) -> Result<Json<PublicSourceLinks>, ApiError> {
    if !valid_source_links(&links) {
        return Err(ApiError::invalid_request());
    }
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminPublicContentRepository::new(&state.application_database);

    UpdateAdminPublicSourceLinks::new(&repository)
        .execute(&principal, links)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
