use axum::{Json, extract::State};
use axum_login::AuthSession;
use wicked_learning_application::learner_competence::LearnerCompetenceQuery;
use wicked_learning_domain::learner_state::LearnerCompetenceMap;
use wicked_learning_persistence::learner_competence::PostgresLearnerCompetenceRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

/// This contract is intentionally not routed into React yet. It gives the
/// source competence surface a private, audited read boundary before the
/// original star-map UI is lifted against it.
pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerCompetenceMap>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerCompetenceRepository::new(&state.application_database);

    LearnerCompetenceQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::forbidden)
}
