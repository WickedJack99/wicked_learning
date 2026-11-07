use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_application::admin_world_map_details::{
    AdminWorldMapDetailsCommand, AdminWorldMapDetailsError, UpdateWorldMapDetailsForm,
    UpdatedWorldMapDetails,
};
use wicked_learning_persistence::admin_world_map_details::PostgresAdminWorldMapDetailsRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdateMapDetailsRequest {
    title: String,
    description: NullableString,
    topic_id: NullableUuid,
    map_assets_locked: bool,
    updated_at: String,
}

#[derive(Serialize)]
pub struct UpdateMapDetailsResponse {
    pub map_id: Uuid,
    pub updated_at: String,
}

/// Required nullable fields retain the source complete-form behavior: `null`
/// clears the value, while an omitted field is rejected during deserialization.
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

#[derive(Deserialize)]
#[serde(untagged)]
enum NullableUuid {
    Id(Uuid),
    Null(()),
}

impl NullableUuid {
    fn as_option(&self) -> Option<Uuid> {
        match self {
            Self::Id(value) => Some(*value),
            Self::Null(()) => None,
        }
    }
}

/// Updates the source Map Details form and rejects stale browser copies before
/// they can overwrite a more recent authoring save.
pub async fn update(
    State(state): State<AppState>,
    Path(map_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateMapDetailsRequest>,
) -> Result<Json<UpdateMapDetailsResponse>, ApiError> {
    let map_id = Uuid::parse_str(&map_id).map_err(|_| ApiError::not_found())?;
    let form = UpdateWorldMapDetailsForm::parse(
        &request.title,
        request.description.as_deref(),
        request.topic_id.as_option(),
        request.map_assets_locked,
    )
    .ok_or_else(ApiError::invalid_request)?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldMapDetailsRepository::new(&state.application_database);
    let updated = AdminWorldMapDetailsCommand::new(&repository)
        .execute(&principal, map_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(response(updated)))
}

fn response(updated: UpdatedWorldMapDetails) -> UpdateMapDetailsResponse {
    UpdateMapDetailsResponse {
        map_id: updated.map_id,
        updated_at: updated.updated_at,
    }
}

fn map_error(error: AdminWorldMapDetailsError) -> ApiError {
    match error {
        AdminWorldMapDetailsError::InvalidTopic => ApiError::invalid_request(),
        AdminWorldMapDetailsError::Conflict => ApiError::conflict(),
        AdminWorldMapDetailsError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateMapDetailsRequest;

    #[test]
    fn update_requires_every_complete_source_form_field_but_allows_explicit_nulls() {
        let complete = serde_json::from_str::<UpdateMapDetailsRequest>(
            r#"{"title":"A map","description":null,"topic_id":null,"map_assets_locked":false,"updated_at":"2026-11-07T17:00:00.000000Z"}"#,
        );
        assert!(complete.is_ok());

        let missing_topic = serde_json::from_str::<UpdateMapDetailsRequest>(
            r#"{"title":"A map","description":null,"map_assets_locked":false,"updated_at":"2026-11-07T17:00:00.000000Z"}"#,
        );
        assert!(missing_topic.is_err());
    }
}
