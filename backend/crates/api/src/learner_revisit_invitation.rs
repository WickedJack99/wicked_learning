use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::learner_revisit_invitation::{
    LearnerRevisitInvitationAction, LearnerRevisitInvitationCommand,
};
use wicked_learning_domain::learner_state::LearnerRevisitInvitationActionResult;
use wicked_learning_persistence::learner_revisit_invitation::PostgresLearnerRevisitInvitationRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdateRevisitInvitationRequest {
    action: String,
}

pub async fn update(
    State(state): State<AppState>,
    Path(check_in_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateRevisitInvitationRequest>,
) -> Result<Json<LearnerRevisitInvitationActionResult>, ApiError> {
    let check_in_id = Uuid::parse_str(&check_in_id).map_err(|_| ApiError::not_found())?;
    let action = parse_action(&request.action).ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerRevisitInvitationRepository::new(&state.application_database);

    LearnerRevisitInvitationCommand::new(&repository)
        .execute(&principal, check_in_id, action)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

fn parse_action(value: &str) -> Option<LearnerRevisitInvitationAction> {
    match value.trim() {
        "dismiss" => Some(LearnerRevisitInvitationAction::Dismiss),
        "snooze" => Some(LearnerRevisitInvitationAction::Snooze),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{LearnerRevisitInvitationAction, parse_action};

    #[test]
    fn accepts_only_source_defined_revisit_actions() {
        assert_eq!(
            parse_action(" snooze "),
            Some(LearnerRevisitInvitationAction::Snooze)
        );
        assert_eq!(
            parse_action("dismiss"),
            Some(LearnerRevisitInvitationAction::Dismiss)
        );
        assert_eq!(parse_action("tomorrow"), None);
    }
}
