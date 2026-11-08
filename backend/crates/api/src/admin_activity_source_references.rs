use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_application::admin_activity_source_references::{
    ActivitySourceReferencesForm, SubmittedActivitySourceReference,
};
use wicked_learning_persistence::admin_activity_source_references::{
    ActivitySourceReferencesError, PostgresAdminActivitySourceReferencesRepository,
};

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdateActivitySourceReferencesRequest {
    source_references: Vec<SourceReferenceRequest>,
    updated_at: String,
}

#[derive(Deserialize)]
pub struct SourceReferenceRequest {
    anchor: Option<String>,
    concepts: Vec<String>,
    excerpt: Option<String>,
    published_at: Option<String>,
    publisher: Option<String>,
    rights: Option<String>,
    title: Option<String>,
    url: Option<String>,
}

#[derive(Serialize)]
pub struct UpdateActivitySourceReferencesResponse {
    pub activity_id: Uuid,
    pub updated_at: String,
}

/// Saves tutor-authored, copied citations. Saved catalog records are a browser
/// convenience only; this route has no catalog ID or provider-output input.
pub async fn update(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateActivitySourceReferencesRequest>,
) -> Result<Json<UpdateActivitySourceReferencesResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let form = ActivitySourceReferencesForm::parse(
        request
            .source_references
            .iter()
            .map(|reference| SubmittedActivitySourceReference {
                anchor: reference.anchor.as_deref(),
                concepts: reference.concepts.iter().map(String::as_str).collect(),
                excerpt: reference.excerpt.as_deref(),
                published_at: reference.published_at.as_deref(),
                publisher: reference.publisher.as_deref(),
                rights: reference.rights.as_deref(),
                title: reference.title.as_deref(),
                url: reference.url.as_deref(),
            })
            .collect(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository =
        PostgresAdminActivitySourceReferencesRepository::new(&state.application_database);
    let updated = repository
        .update(&principal, activity_id, &form, &request.updated_at)
        .await
        .map_err(map_error)?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateActivitySourceReferencesResponse {
        activity_id: updated.activity_id,
        updated_at: updated.updated_at,
    }))
}

fn map_error(error: ActivitySourceReferencesError) -> ApiError {
    match error {
        ActivitySourceReferencesError::Conflict => ApiError::conflict(),
        ActivitySourceReferencesError::Unavailable => ApiError::service_unavailable(),
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateActivitySourceReferencesRequest;

    #[test]
    fn requires_a_complete_source_references_save() {
        assert!(serde_json::from_str::<UpdateActivitySourceReferencesRequest>(
            r#"{"source_references":[{"title":"A source","url":"https://example.test","anchor":null,"concepts":[],"excerpt":null,"published_at":null,"publisher":null,"rights":null}],"updated_at":"2026-11-08T09:00:00.000000Z"}"#,
        ).is_ok());
        assert!(
            serde_json::from_str::<UpdateActivitySourceReferencesRequest>(
                r#"{"source_references":[],"updated_at":"2026-11-08T09:00:00.000000Z"}"#,
            )
            .is_ok()
        );
        assert!(
            serde_json::from_str::<UpdateActivitySourceReferencesRequest>(
                r#"{"updated_at":"2026-11-08T09:00:00.000000Z"}"#,
            )
            .is_err()
        );
    }
}
