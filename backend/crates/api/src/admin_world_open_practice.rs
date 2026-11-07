use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::admin_world_open_practice::{
    AdminWorldOpenPracticeCommand, AdminWorldOpenPracticeError, OpenPracticeActivityForm,
};
use wicked_learning_persistence::admin_world_open_practice::PostgresAdminWorldOpenPracticeRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct CreateOpenPracticeRequest {
    title: String,
    slug: Option<String>,
    introduction: Option<String>,
    next_step: Option<String>,
}

#[derive(Serialize)]
pub struct CreateOpenPracticeResponse {
    pub activity_id: Uuid,
}

/// Adds the first source-compatible Open practice creation contract. The
/// original World Builder will refetch its selected node before rendering the
/// new graph card when its complete adapter is ready.
pub async fn create(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<CreateOpenPracticeRequest>,
) -> Result<(StatusCode, Json<CreateOpenPracticeResponse>), ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let form = OpenPracticeActivityForm::parse(
        &request.title,
        request.slug.as_deref(),
        request.introduction.as_deref(),
        request.next_step.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldOpenPracticeRepository::new(&state.application_database);
    let activity_id = AdminWorldOpenPracticeCommand::new(&repository)
        .create(&principal, node_id, &form)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok((
        StatusCode::CREATED,
        Json(CreateOpenPracticeResponse { activity_id }),
    ))
}

fn map_error(error: AdminWorldOpenPracticeError) -> ApiError {
    match error {
        AdminWorldOpenPracticeError::InvalidActivity => ApiError::invalid_request(),
        AdminWorldOpenPracticeError::Unavailable => ApiError::service_unavailable(),
    }
}
