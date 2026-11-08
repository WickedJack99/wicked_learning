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
use wicked_learning_application::admin_activity_ambient_sound::ActivityAmbientSoundForm;
use wicked_learning_persistence::admin_activity_ambient_sound::{
    ActivityAmbientSoundError, PostgresAdminActivityAmbientSoundRepository,
};

#[derive(Deserialize)]
pub struct UpdateActivityAmbientSoundRequest {
    enabled: bool,
    sound_id: NullableString,
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
pub struct UpdateActivityAmbientSoundResponse {
    pub activity_id: Uuid,
    pub updated_at: String,
}

pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateActivityAmbientSoundRequest>,
) -> Result<Json<UpdateActivityAmbientSoundResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let form = ActivityAmbientSoundForm::parse(request.enabled, request.sound_id.as_deref())
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminActivityAmbientSoundRepository::new(&state.application_database);
    let updated = repository
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;

    Ok(Json(UpdateActivityAmbientSoundResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}

fn map_error(error: ActivityAmbientSoundError) -> ApiError {
    match error {
        ActivityAmbientSoundError::Invalid => ApiError::invalid_request(),
        ActivityAmbientSoundError::Conflict => ApiError::conflict(),
        ActivityAmbientSoundError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateActivityAmbientSoundRequest;

    #[test]
    fn requires_a_complete_ambient_sound_form() {
        assert!(serde_json::from_str::<UpdateActivityAmbientSoundRequest>(
            r#"{"enabled":true,"sound_id":"00000000-0000-4000-8000-000000000001","updated_at":"2026-11-08T09:00:00.000000Z"}"#
        )
        .is_ok());
        assert!(
            serde_json::from_str::<UpdateActivityAmbientSoundRequest>(
                r#"{"enabled":false,"sound_id":null,"updated_at":"2026-11-08T09:00:00.000000Z"}"#
            )
            .is_ok()
        );
        assert!(
            serde_json::from_str::<UpdateActivityAmbientSoundRequest>(
                r#"{"enabled":true,"updated_at":"2026-11-08T09:00:00.000000Z"}"#
            )
            .is_err()
        );
    }
}
