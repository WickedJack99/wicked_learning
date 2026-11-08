use axum::{Json, extract::State};
use axum_login::AuthSession;
use wicked_learning_application::admin_learning_support_signals::{
    AdminSupportSignals, AdminSupportSignalsQuery,
};
use wicked_learning_persistence::admin_learning_support_signals::PostgresAdminSupportSignalsRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

/// Returns evidence-only support prompts for learners within the caller's
/// server-resolved support scope. It deliberately excludes journal text,
/// private reflections, confidence values, and ranking data.
pub async fn index(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminSupportSignals>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminSupportSignalsRepository::new(
        &state.application_database,
        &state.identity_database,
    );

    AdminSupportSignalsQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::forbidden)
}
