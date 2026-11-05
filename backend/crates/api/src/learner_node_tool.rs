use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::Deserialize;
use wicked_learning_application::learner_node_tool::{
    LearnerNodeToolCommand, LearnerNodeToolTarget,
};
use wicked_learning_domain::learner_state::LearnerNodeToolResult;
use wicked_learning_persistence::learner_node_tool::PostgresLearnerNodeToolRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UseToolRequest {
    tool_slug: String,
}

pub async fn use_on_node(
    State(state): State<AppState>,
    Path((map_slug, node_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UseToolRequest>,
) -> Result<Json<LearnerNodeToolResult>, ApiError> {
    let target = LearnerNodeToolTarget::parse(&map_slug, &node_slug, &request.tool_slug)
        .ok_or_else(ApiError::not_found)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerNodeToolRepository::new(&state.application_database);

    LearnerNodeToolCommand::new(&repository)
        .use_tool(&principal, &target)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
