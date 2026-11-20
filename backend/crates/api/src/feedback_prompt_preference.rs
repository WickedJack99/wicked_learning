use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};
use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use tower_sessions::Session;
use wicked_learning_application::feedback_prompt_preference::{
    FeedbackPromptAction, FeedbackPromptPreference, FeedbackPromptPreferenceQuery,
    UpdateFeedbackPromptPreferenceCommand,
};
use wicked_learning_persistence::feedback_prompt_preference::PostgresFeedbackPromptPreferenceRepository;
#[derive(Deserialize)]
pub struct UpdateFeedbackPromptPreferenceRequest {
    action: String,
}
#[derive(Serialize)]
pub struct FeedbackPromptPreferenceResponse {
    pub status: String,
}
pub async fn show(
    State(state): State<AppState>,
    auth: AuthSession<IdentityBackend>,
) -> Result<Json<FeedbackPromptPreferenceResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth).await?;
    let repository = PostgresFeedbackPromptPreferenceRepository::new(&state.application_database);
    FeedbackPromptPreferenceQuery::new(&repository)
        .execute(&principal)
        .await
        .map(response)
        .map(Json)
        .map_err(|_| ApiError::service_unavailable())
}
pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
    session: Session,
    Json(request): Json<UpdateFeedbackPromptPreferenceRequest>,
) -> Result<Json<FeedbackPromptPreferenceResponse>, ApiError> {
    let action =
        FeedbackPromptAction::parse(&request.action).ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresFeedbackPromptPreferenceRepository::new(&state.application_database);
    let result = UpdateFeedbackPromptPreferenceCommand::new(&repository)
        .execute(&principal, action)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    session
        .remove::<bool>(&prompt_key(principal.subject_id))
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(Json(response(result)))
}
fn response(preference: FeedbackPromptPreference) -> FeedbackPromptPreferenceResponse {
    FeedbackPromptPreferenceResponse {
        status: preference.status,
    }
}

fn prompt_key(subject: uuid::Uuid) -> String {
    format!("wicked_feedback_prompt_shown:{subject}")
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClaimFeedbackPromptRequest {
    surface: String,
}
#[derive(Serialize)]
pub struct ClaimFeedbackPromptResponse {
    show: bool,
}

/// Source shouldShow consumes a session flag. Keep that side effect an
/// explicit CSRF-protected command rather than a supposedly read-only GET.
pub async fn claim(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
    session: Session,
    Json(body): Json<ClaimFeedbackPromptRequest>,
) -> Result<Json<ClaimFeedbackPromptResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    if !matches!(
        body.surface.as_str(),
        "world" | "home" | "bookmarks" | "learning" | "settings" | "feedback"
    ) {
        return Err(ApiError::invalid_request());
    }
    let key = prompt_key(principal.subject_id);
    let shown = session
        .get::<bool>(&key)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .unwrap_or(false);
    let repository = PostgresFeedbackPromptPreferenceRepository::new(&state.application_database);
    let preference = FeedbackPromptPreferenceQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let show = prompt_is_eligible(&body.surface, &preference.status, shown);
    if show {
        session
            .insert(&key, true)
            .await
            .map_err(|_| ApiError::service_unavailable())?;
    }
    Ok(Json(ClaimFeedbackPromptResponse { show }))
}

fn prompt_is_eligible(surface: &str, status: &str, shown: bool) -> bool {
    !matches!(surface, "settings" | "feedback") && status == "enabled" && !shown
}

#[cfg(test)]
mod tests {
    use super::prompt_is_eligible;
    #[test]
    fn feedback_invitation_preserves_source_session_and_preference_exclusions() {
        assert!(prompt_is_eligible("world", "enabled", false));
        assert!(!prompt_is_eligible("world", "enabled", true));
        for surface in ["settings", "feedback"] {
            assert!(!prompt_is_eligible(surface, "enabled", false));
        }
        for status in ["declined", "snoozed"] {
            assert!(!prompt_is_eligible("world", status, false));
        }
    }
}
