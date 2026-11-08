use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::{
    admin_world_map_create::CreateWorldMapForm,
    admin_world_map_duplicate::AdminWorldMapDuplicateCommand,
};
use wicked_learning_persistence::admin_world_map_duplicate::PostgresAdminWorldMapDuplicateRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct DuplicateWorldMapRequest {
    title: String,
    slug: Option<String>,
}

#[derive(Serialize)]
pub struct DuplicateWorldMapResponse {
    pub map_id: Uuid,
}

/// Copies source-authored map content into a new map. The command deliberately
/// excludes learner records, historical versions, review runs, and editor
/// assignments; its new activities return to the review queue.
pub async fn duplicate(
    State(state): State<AppState>,
    Path(map_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<DuplicateWorldMapRequest>,
) -> Result<(StatusCode, Json<DuplicateWorldMapResponse>), ApiError> {
    let source_map_id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let form = CreateWorldMapForm::parse(&request.title, request.slug.as_deref(), None)
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapDuplicateRepository::new(&state.application_database);
    let map_id = AdminWorldMapDuplicateCommand::new(&repository)
        .execute(&principal, source_map_id, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;

    Ok((
        StatusCode::CREATED,
        Json(DuplicateWorldMapResponse { map_id }),
    ))
}
