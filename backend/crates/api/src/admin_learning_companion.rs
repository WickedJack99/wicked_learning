use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::admin_learning_companion::{
    AdminLearningCompanionCommand, AdminLearningCompanionError, AdminLearningCompanionQuery,
    LearningCompanionSettingsForm,
};
use wicked_learning_domain::learning_companion::LearningCompanionSettings;
use wicked_learning_persistence::admin_learning_companion::PostgresAdminLearningCompanionRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdateLearningCompanionSettingsRequest {
    ai_capabilities: Vec<String>,
    ai_enabled: bool,
    ai_template_id: Option<Uuid>,
    avatar_color: String,
    avatar_position_x: i16,
    avatar_position_y: i16,
    avatar_scale: i16,
    avatar_url: Option<String>,
    display_name: String,
    enabled: bool,
    mode: String,
    welcome_message: String,
}

pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearningCompanionSettings>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminLearningCompanionRepository::new(&state.application_database);
    AdminLearningCompanionQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(map_error)?
        .map(Json)
        .ok_or_else(ApiError::forbidden)
}

pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateLearningCompanionSettingsRequest>,
) -> Result<Json<LearningCompanionSettings>, ApiError> {
    let form = LearningCompanionSettingsForm::parse(
        request.enabled,
        &request.display_name,
        request.avatar_url.as_deref(),
        &request.avatar_color,
        request.avatar_position_x,
        request.avatar_position_y,
        request.avatar_scale,
        &request.welcome_message,
        &request.mode,
        request.ai_enabled,
        request.ai_template_id,
        request.ai_capabilities,
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminLearningCompanionRepository::new(&state.application_database);
    AdminLearningCompanionCommand::new(&repository)
        .update(&principal, &form)
        .await
        .map_err(map_error)?
        .map(Json)
        .ok_or_else(ApiError::forbidden)
}

fn map_error(error: AdminLearningCompanionError) -> ApiError {
    match error {
        AdminLearningCompanionError::Invalid => ApiError::invalid_request(),
        AdminLearningCompanionError::Unavailable => ApiError::service_unavailable(),
    }
}
