use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use wicked_learning_application::admin_world_map_visuals::{
    AdminWorldMapVisualsCommand, UpdateWorldMapVisualsForm,
};
use wicked_learning_persistence::admin_world_map_visuals::PostgresAdminWorldMapVisualsRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdateMapVisualsRequest {
    background_config: Value,
}

#[derive(Serialize)]
pub struct UpdateMapVisualsResponse {
    pub map_id: Uuid,
    pub background_config: Value,
}

/// Saves the source Map Configuration visuals only after the scoped map-editor
/// authorization and browser CSRF checks have succeeded.
pub async fn update(
    State(state): State<AppState>,
    Path(map_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateMapVisualsRequest>,
) -> Result<Json<UpdateMapVisualsResponse>, ApiError> {
    let map_id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let form = UpdateWorldMapVisualsForm::parse(request.background_config)
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapVisualsRepository::new(&state.application_database);
    let background_config = AdminWorldMapVisualsCommand::new(&repository)
        .execute(&principal, map_id, &form)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;

    Ok(Json(UpdateMapVisualsResponse {
        map_id,
        background_config,
    }))
}

#[cfg(test)]
mod tests {
    use super::UpdateMapVisualsRequest;

    #[test]
    fn update_accepts_the_source_background_configuration_envelope() {
        assert!(
            serde_json::from_str::<UpdateMapVisualsRequest>(
                r##"{"background_config":{"dark":{"accentColor":"#14b8a6"}}}"##,
            )
            .is_ok()
        );
    }
}
