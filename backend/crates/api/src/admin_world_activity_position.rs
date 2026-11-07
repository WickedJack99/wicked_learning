use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::admin_world_activity_position::{
    ActivityGraphPosition, AdminWorldActivityPositionCommand,
};
use wicked_learning_domain::world_content::AdminActivityGraphPosition;
use wicked_learning_persistence::admin_world_activity_position::PostgresAdminWorldActivityPositionRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdateActivityGraphPositionRequest {
    position: GraphPosition,
}

#[derive(Deserialize)]
struct GraphPosition {
    x: f64,
    y: f64,
}

#[derive(Serialize)]
pub struct ActivityGraphPositionResponse {
    pub position: AdminActivityGraphPosition,
}

/// Persists the original World Builder's ordinary activity-card drag location.
/// It is an authoring presentation mutation only; content and playback remain
/// unchanged.
pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateActivityGraphPositionRequest>,
) -> Result<Json<ActivityGraphPositionResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let position = position_from_request(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldActivityPositionRepository::new(&state.application_database);
    let position = AdminWorldActivityPositionCommand::new(&repository)
        .execute(&principal, activity_id, position)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(ActivityGraphPositionResponse { position }))
}

fn position_from_request(
    request: UpdateActivityGraphPositionRequest,
) -> Result<ActivityGraphPosition, ApiError> {
    Ok(ActivityGraphPosition {
        x: round_coordinate(request.position.x)?,
        y: round_coordinate(request.position.y)?,
    })
}

fn round_coordinate(value: f64) -> Result<i32, ApiError> {
    if !value.is_finite()
        || value.round() < f64::from(i32::MIN)
        || value.round() > f64::from(i32::MAX)
    {
        return Err(ApiError::invalid_request());
    }
    Ok(value.round() as i32)
}

#[cfg(test)]
mod tests {
    use super::{GraphPosition, UpdateActivityGraphPositionRequest, position_from_request};

    #[test]
    fn source_graph_drag_rounds_coordinates_to_integers() {
        let result = position_from_request(UpdateActivityGraphPositionRequest {
            position: GraphPosition { x: 12.5, y: -2.6 },
        });
        assert!(result.is_ok(), "finite coordinates are valid");
        let position = match result {
            Ok(position) => position,
            Err(_) => unreachable!("the previous assertion guarantees success"),
        };
        assert_eq!((position.x, position.y), (13, -3));
    }
}
