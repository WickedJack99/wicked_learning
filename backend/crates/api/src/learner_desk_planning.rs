use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use serde::Deserialize;
use wicked_learning_application::learner_desk_planning::{
    LearnerDeskPlanningPreferenceCommand, LearnerDeskPlanningPreferenceDraft,
    LearnerDeskPlanningPreferenceQuery,
};
use wicked_learning_domain::learner_state::LearnerDeskPlanningPreference;
use wicked_learning_persistence::learner_desk_planning::PostgresLearnerDeskPlanningPreferenceRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdateLearnerDeskPlanningPreferenceRequest {
    purpose_filter: String,
    time_budget: DeskTimeBudgetInput,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum DeskTimeBudgetInput {
    Any(String),
    Minutes(i16),
}

pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerDeskPlanningPreference>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository =
        PostgresLearnerDeskPlanningPreferenceRepository::new(&state.application_database);

    LearnerDeskPlanningPreferenceQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())
        .map(Json)
}

pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateLearnerDeskPlanningPreferenceRequest>,
) -> Result<Json<LearnerDeskPlanningPreference>, ApiError> {
    let time_budget =
        parse_time_budget(request.time_budget).ok_or_else(ApiError::invalid_request)?;
    let draft = LearnerDeskPlanningPreferenceDraft::parse(&request.purpose_filter, time_budget)
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresLearnerDeskPlanningPreferenceRepository::new(&state.application_database);

    LearnerDeskPlanningPreferenceCommand::new(&repository)
        .execute(&principal, &draft)
        .await
        .map_err(|_| ApiError::service_unavailable())
        .map(Json)
}

fn parse_time_budget(value: DeskTimeBudgetInput) -> Option<Option<i16>> {
    match value {
        DeskTimeBudgetInput::Any(value) if value == "any" => Some(None),
        DeskTimeBudgetInput::Minutes(value @ (15 | 30)) => Some(Some(value)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{DeskTimeBudgetInput, parse_time_budget};

    #[test]
    fn accepts_only_the_source_time_budget_values() {
        assert_eq!(
            parse_time_budget(DeskTimeBudgetInput::Any("any".to_owned())),
            Some(None)
        );
        assert_eq!(
            parse_time_budget(DeskTimeBudgetInput::Minutes(30)),
            Some(Some(30))
        );
        assert_eq!(
            parse_time_budget(DeskTimeBudgetInput::Any("all".to_owned())),
            None
        );
        assert_eq!(parse_time_budget(DeskTimeBudgetInput::Minutes(20)), None);
    }
}
