use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use wicked_learning_application::admin_public_presentation::{
    AdminPublicPresentationQuery, UpdateAdminPublicPresentation, valid_public_presentation,
};
use wicked_learning_domain::platform_presentation::PublicPresentation;
use wicked_learning_persistence::admin_public_presentation::PostgresAdminPublicPresentationRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<PublicPresentation>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminPublicPresentationRepository::new(&state.application_database);

    AdminPublicPresentationQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(presentation): Json<PublicPresentation>,
) -> Result<Json<PublicPresentation>, ApiError> {
    if !valid_public_presentation(&presentation) {
        return Err(ApiError::invalid_request());
    }
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminPublicPresentationRepository::new(&state.application_database);

    UpdateAdminPublicPresentation::new(&repository)
        .execute(&principal, presentation)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
