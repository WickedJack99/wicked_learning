use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::learner_check_in::{LearnerCheckInCommand, LearnerCheckInInput};
use wicked_learning_domain::learner_state::LearnerActivityCheckInResult;
use wicked_learning_persistence::learner_check_in::PostgresLearnerCheckInRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct RecordLearnerCheckInRequest {
    feeling: Option<String>,
    next_direction: Option<String>,
    note: Option<String>,
}

pub async fn record(
    State(state): State<AppState>,
    Path((play_run_id, activity_slug)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<RecordLearnerCheckInRequest>,
) -> Result<Json<LearnerActivityCheckInResult>, ApiError> {
    let play_run_id = Uuid::parse_str(&play_run_id).map_err(|_| ApiError::not_found())?;
    let input = parse_input(request).ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerCheckInRepository::new(&state.application_database);

    LearnerCheckInCommand::new(&repository)
        .execute(&principal, play_run_id, &activity_slug, &input)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

fn parse_input(request: RecordLearnerCheckInRequest) -> Option<LearnerCheckInInput> {
    let feeling = normalize_optional(request.feeling);
    let note = normalize_optional(request.note);
    let next_direction = normalize_optional(request.next_direction);

    if feeling
        .as_deref()
        .is_some_and(|value| !matches!(value, "clearer" | "forming" | "stretched" | "stuck"))
        || next_direction
            .as_deref()
            .is_some_and(|value| !matches!(value, "revisit" | "related" | "settle"))
        || note
            .as_ref()
            .is_some_and(|value| value.chars().count() > 500)
        || (feeling.is_none() && note.is_none() && next_direction.is_none())
    {
        return None;
    }

    Some(LearnerCheckInInput {
        feeling,
        next_direction,
        note,
    })
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let value = value.trim().to_owned();
        (!value.is_empty()).then_some(value)
    })
}

#[cfg(test)]
mod tests {
    use super::{RecordLearnerCheckInRequest, parse_input};

    #[test]
    fn accepts_only_source_defined_private_check_in_values() {
        let valid = parse_input(RecordLearnerCheckInRequest {
            feeling: Some(" forming ".to_owned()),
            next_direction: Some("revisit".to_owned()),
            note: Some(" A quiet note. ".to_owned()),
        })
        .expect("valid private input");
        assert_eq!(valid.feeling.as_deref(), Some("forming"));
        assert_eq!(valid.next_direction.as_deref(), Some("revisit"));
        assert_eq!(valid.note.as_deref(), Some("A quiet note."));

        assert!(
            parse_input(RecordLearnerCheckInRequest {
                feeling: Some("excellent".to_owned()),
                next_direction: None,
                note: None,
            })
            .is_none()
        );
        assert!(
            parse_input(RecordLearnerCheckInRequest {
                feeling: None,
                next_direction: None,
                note: None,
            })
            .is_none()
        );
    }
}
