use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::learner_companion_turn::{
    LearnerCompanionAssistanceLevel, LearnerCompanionTurnRequest,
};
use wicked_learning_persistence::learner_companion::{
    LearnerCompanionTurnError, PostgresLearnerCompanionRepository, PreparedCompanionTurn,
};

use crate::{
    AppState, ai_provider::AiProvider, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct LearningCompanionTurnBody {
    activity_id: Option<String>,
    assistance_level: String,
    dialogue_node_id: String,
    map_slug: Option<String>,
    play_run_id: Option<String>,
    surface: String,
}

#[derive(Serialize)]
pub struct LearningCompanionTurnResponse {
    assistance_level: String,
    disclosure: Option<LearningCompanionTurnDisclosure>,
    node_id: String,
    text: String,
}

#[derive(Serialize)]
pub struct LearningCompanionTurnDisclosure {
    can_change_content: bool,
    can_navigate: bool,
    kind: &'static str,
    uses_private_learner_response: bool,
}

/// Runs one source-authored Learning Companion AI node. The browser supplies
/// only its current source surface and authored node choice; the server
/// resolves visibility, active-run ownership, template, prompt and capability
/// intersection before one bounded provider request.
pub async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    auth_session: AuthSession<IdentityBackend>,
    csrf_token: axum_csrf::CsrfToken,
    Json(body): Json<LearningCompanionTurnBody>,
) -> Result<Json<LearningCompanionTurnResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let activity_id = parse_uuid(body.activity_id.as_deref())?;
    let play_run_id = parse_uuid(body.play_run_id.as_deref())?;
    let request = LearnerCompanionTurnRequest::parse(
        &body.surface,
        body.map_slug.as_deref(),
        activity_id,
        &body.dialogue_node_id,
        &body.assistance_level,
        play_run_id,
    )
    .ok_or_else(ApiError::companion_turn_rejected)?;
    let repository = PostgresLearnerCompanionRepository::new(&state.application_database);
    match repository
        .prepare_turn(&principal, &request)
        .await
        .map_err(map_error)?
    {
        PreparedCompanionTurn::Off { dialogue_node_id } => {
            Ok(Json(LearningCompanionTurnResponse {
                assistance_level: LearnerCompanionAssistanceLevel::Off
                    .as_response_value()
                    .to_owned(),
                disclosure: None,
                node_id: dialogue_node_id,
                text: String::new(),
            }))
        }
        PreparedCompanionTurn::Provider(execution) => {
            let activity_id = execution.activity_id;
            let play_run_id = execution.play_run_id;
            let recorded_assistance_level = execution.assistance_level;
            let node_id = execution.dialogue_node_id.clone();
            let assistance_level = execution.assistance_level.as_response_value().to_owned();
            let text = AiProvider::companion_turn(execution, &state.ai_credential_cipher)
                .await
                .map_err(|_| ApiError::companion_turn_rejected())?
                .trim()
                .chars()
                .take(1_200)
                .collect();
            repository
                .record_assistance(
                    &principal,
                    activity_id,
                    play_run_id,
                    recorded_assistance_level,
                )
                .await
                .map_err(map_error)?;
            Ok(Json(LearningCompanionTurnResponse {
                assistance_level,
                disclosure: Some(LearningCompanionTurnDisclosure {
                    can_change_content: false,
                    can_navigate: false,
                    kind: "bounded_authored_context",
                    uses_private_learner_response: false,
                }),
                node_id,
                text,
            }))
        }
    }
}

fn parse_uuid(value: Option<&str>) -> Result<Option<Uuid>, ApiError> {
    value
        .map(Uuid::parse_str)
        .transpose()
        .map_err(|_| ApiError::companion_turn_rejected())
}

fn map_error(error: LearnerCompanionTurnError) -> ApiError {
    match error {
        LearnerCompanionTurnError::Invalid => ApiError::companion_turn_rejected(),
        LearnerCompanionTurnError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::LearningCompanionTurnBody;

    #[test]
    fn accepts_the_source_turn_payload_shape_without_browser_prompt_material() {
        let body = serde_json::from_str::<LearningCompanionTurnBody>(
            r#"{"surface":"activity","activity_id":"00000000-0000-4000-8000-000000000001","dialogue_node_id":"ai-turn","assistance_level":"hint","play_run_id":"00000000-0000-4000-8000-000000000002"}"#,
        )
        .expect("turn request");
        assert_eq!(body.surface, "activity");
        assert_eq!(body.dialogue_node_id, "ai-turn");
        assert_eq!(body.assistance_level, "hint");
    }
}
