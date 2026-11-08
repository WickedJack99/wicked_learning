use axum::{
    Json,
    extract::{Path, Query, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use uuid::Uuid;
use wicked_learning_application::admin_world_details::{
    AdminWorldDetailsCommand, AdminWorldDetailsError, AdminWorldDetailsHistoryQuery,
    RestoreWorldDetailsVersionCommand, UpdateWorldDetailsForm, WorldDetailsVersionPage,
};
use wicked_learning_persistence::admin_world_details::PostgresAdminWorldDetailsRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct UpdateWorldDetailsRequest {
    title: String,
    description: NullableString,
    updated_at: String,
}

#[derive(Serialize)]
pub struct UpdateWorldDetailsResponse {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct WorldVersionsQuery {
    #[serde(default = "default_page")]
    page: u32,
    #[serde(default = "default_per_page")]
    per_page: u32,
}

fn default_page() -> u32 {
    1
}

fn default_per_page() -> u32 {
    6
}

#[derive(Serialize)]
pub struct WorldDetailsVersionResponse {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct WorldDetailsVersionsResponse {
    pub items: Vec<WorldDetailsVersionResponse>,
    pub page: u32,
    pub per_page: u32,
    pub total: u64,
    pub last_page: u32,
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

/// Updates source World metadata only. The caller needs global map-access
/// update authority; scoped map editors cannot rename the authoring World.
pub async fn update(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<UpdateWorldDetailsRequest>,
) -> Result<Json<UpdateWorldDetailsResponse>, ApiError> {
    let form = UpdateWorldDetailsForm::parse(&request.title, request.description.as_deref())
        .ok_or_else(ApiError::invalid_request)?;
    OffsetDateTime::parse(&request.updated_at, &Rfc3339)
        .map_err(|_| ApiError::invalid_request())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldDetailsRepository::new(&state.application_database);
    let updated = AdminWorldDetailsCommand::new(&repository)
        .execute(&principal, &form, &request.updated_at)
        .await
        .map_err(|error| match error {
            AdminWorldDetailsError::Conflict => ApiError::conflict(),
            AdminWorldDetailsError::Unavailable => ApiError::service_unavailable(),
        })?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateWorldDetailsResponse {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        updated_at: updated.updated_at,
    }))
}

pub async fn versions(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
    Query(query): Query<WorldVersionsQuery>,
) -> Result<Json<WorldDetailsVersionsResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminWorldDetailsRepository::new(&state.application_database);
    let page = AdminWorldDetailsHistoryQuery::new(&repository)
        .execute(&principal, query.page, query.per_page)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(version_response(page)))
}

pub async fn restore(
    State(state): State<AppState>,
    Path(version_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<UpdateWorldDetailsResponse>, ApiError> {
    let version_id = Uuid::parse_str(&version_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldDetailsRepository::new(&state.application_database);
    let updated = RestoreWorldDetailsVersionCommand::new(&repository)
        .execute(&principal, version_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(UpdateWorldDetailsResponse {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        updated_at: updated.updated_at,
    }))
}

fn version_response(page: WorldDetailsVersionPage) -> WorldDetailsVersionsResponse {
    let last_page = if page.total == 0 {
        1
    } else {
        page.total.div_ceil(u64::from(page.per_page)) as u32
    };
    WorldDetailsVersionsResponse {
        items: page
            .items
            .into_iter()
            .map(|version| WorldDetailsVersionResponse {
                id: version.id,
                title: version.title,
                description: version.description,
                created_at: version.created_at,
            })
            .collect(),
        page: page.page,
        per_page: page.per_page,
        total: page.total,
        last_page,
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateWorldDetailsRequest;

    #[test]
    fn source_complete_form_requires_a_nullable_description_and_timestamp() {
        assert!(serde_json::from_str::<UpdateWorldDetailsRequest>(
            r#"{"title":"World","description":null,"updated_at":"2026-11-08T12:00:00.000000Z"}"#,
        )
        .is_ok());
        assert!(
            serde_json::from_str::<UpdateWorldDetailsRequest>(
                r#"{"title":"World","description":null}"#,
            )
            .is_err()
        );
    }
}
