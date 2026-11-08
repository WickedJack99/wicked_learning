use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};
use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_application::admin_activity_completion_choice::ActivityCompletionChoiceForm;
use wicked_learning_persistence::admin_activity_completion_choice::{
    ActivityCompletionChoiceError, PostgresAdminActivityCompletionChoiceRepository,
};
#[derive(Deserialize)]
pub struct UpdateActivityCompletionChoiceRequest {
    prompt: NullableString,
    updated_at: String,
}
#[derive(Deserialize)]
#[serde(untagged)]
enum NullableString {
    Text(String),
    Null(()),
}
impl NullableString {
    fn as_deref(&self) -> Option<&str> {
        match self {
            Self::Text(value) => Some(value),
            Self::Null(()) => None,
        }
    }
}
#[derive(Serialize)]
pub struct UpdateActivityCompletionChoiceResponse {
    pub activity_id: Uuid,
    pub updated_at: String,
}
pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateActivityCompletionChoiceRequest>,
) -> Result<Json<UpdateActivityCompletionChoiceResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let form = ActivityCompletionChoiceForm::parse(request.prompt.as_deref());
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresAdminActivityCompletionChoiceRepository::new(&state.application_database);
    let updated = repository
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateActivityCompletionChoiceResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}
fn map_error(error: ActivityCompletionChoiceError) -> ApiError {
    match error {
        ActivityCompletionChoiceError::Conflict => ApiError::conflict(),
        ActivityCompletionChoiceError::Unavailable => ApiError::service_unavailable(),
    }
}
#[cfg(test)]
mod tests {
    use super::UpdateActivityCompletionChoiceRequest;
    #[test]
    fn requires_a_complete_choice_context_form() {
        assert!(
            serde_json::from_str::<UpdateActivityCompletionChoiceRequest>(
                r#"{"prompt":null,"updated_at":"2026-11-08T09:00:00.000000Z"}"#
            )
            .is_ok()
        );
        assert!(
            serde_json::from_str::<UpdateActivityCompletionChoiceRequest>(
                r#"{"updated_at":"2026-11-08T09:00:00.000000Z"}"#
            )
            .is_err()
        );
    }
}
