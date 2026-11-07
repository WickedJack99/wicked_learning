use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::admin_world_map_create::{
    AdminWorldMapCreateCommand, CreateWorldMapForm,
};
use wicked_learning_persistence::admin_world_map_create::PostgresAdminWorldMapCreateRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct CreateWorldMapRequest {
    title: String,
    slug: Option<String>,
    description: Option<String>,
}

#[derive(Serialize)]
pub struct CreateWorldMapResponse {
    pub map_id: Uuid,
}

/// Creates a draft map in the current source-shaped authoring World. The
/// browser refetches the graph before selecting it, as Laravel redirects to
/// the World Builder after creation.
pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateWorldMapRequest>,
) -> Result<(StatusCode, Json<CreateWorldMapResponse>), ApiError> {
    let form = CreateWorldMapForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.description.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapCreateRepository::new(&state.application_database);
    let map_id = AdminWorldMapCreateCommand::new(&repository)
        .execute(&principal, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok((StatusCode::CREATED, Json(CreateWorldMapResponse { map_id })))
}
