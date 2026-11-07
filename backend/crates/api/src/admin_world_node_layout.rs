use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use wicked_learning_application::admin_world_node_layout::{
    AdminWorldNodeLayout, AdminWorldNodeLayoutCommand, GraphNode,
};
use wicked_learning_persistence::admin_world_node_layout::PostgresAdminWorldNodeLayoutRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdateActivityGraphLayoutRequest {
    node: String,
    position: GraphPosition,
}

#[derive(Deserialize)]
struct GraphPosition {
    x: f64,
    y: f64,
}

#[derive(Serialize)]
pub struct ActivityGraphLayoutResponse {
    pub graph_layout: Value,
}

/// Persists the original activity editor's special start/end graph positions.
/// This touches authoring presentation only, never learner starts or playback.
pub async fn update(
    State(state): State<AppState>,
    Path(node_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateActivityGraphLayoutRequest>,
) -> Result<Json<ActivityGraphLayoutResponse>, ApiError> {
    let node_id = Uuid::parse_str(&node_id).map_err(|_| ApiError::not_found())?;
    let layout = layout_from_request(request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldNodeLayoutRepository::new(&state.application_database);

    AdminWorldNodeLayoutCommand::new(&repository)
        .execute(&principal, node_id, &layout)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|graph_layout| Json(ActivityGraphLayoutResponse { graph_layout }))
        .ok_or_else(ApiError::not_found)
}

fn layout_from_request(
    request: UpdateActivityGraphLayoutRequest,
) -> Result<AdminWorldNodeLayout, ApiError> {
    let graph_node = match request.node.as_str() {
        "start" => GraphNode::Start,
        "end" => GraphNode::End,
        _ => return Err(ApiError::invalid_request()),
    };
    Ok(AdminWorldNodeLayout {
        graph_node,
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
    use super::{GraphPosition, UpdateActivityGraphLayoutRequest, layout_from_request};

    #[test]
    fn source_special_nodes_are_rounded_to_integer_positions() {
        let result = layout_from_request(UpdateActivityGraphLayoutRequest {
            node: "end".to_owned(),
            position: GraphPosition { x: 12.5, y: -2.6 },
        });
        assert!(result.is_ok(), "the source accepts numeric graph positions");
        let layout = match result {
            Ok(layout) => layout,
            Err(_) => unreachable!("the previous assertion guarantees success"),
        };

        assert_eq!(layout.graph_node.key(), "end");
        assert_eq!(layout.x, 13);
        assert_eq!(layout.y, -3);
    }

    #[test]
    fn rejects_unknown_special_nodes() {
        assert!(
            layout_from_request(UpdateActivityGraphLayoutRequest {
                node: "activity".to_owned(),
                position: GraphPosition { x: 0.0, y: 0.0 },
            })
            .is_err()
        );
    }
}
