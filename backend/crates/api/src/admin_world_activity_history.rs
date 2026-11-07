use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::admin_world_activity_history::{
    ActivityHistoryPageRequest, AdminWorldActivityHistoryCommand,
};
use wicked_learning_domain::world_content::{
    AdminActivityVersionDetails, AdminActivityVersionPage,
};
use wicked_learning_persistence::admin_world_activity_history::PostgresAdminWorldActivityHistoryRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct ActivityHistoryQuery {
    page: Option<i64>,
    per_page: Option<i64>,
}

#[derive(Serialize)]
pub struct ActivityVersionDetailsResponse {
    pub version: AdminActivityVersionDetails,
}

/// Lists the source Activity History dialog's bounded, immutable snapshots.
pub async fn index(
    State(state): State<AppState>,
    Path(activity_id): Path<String>,
    Query(query): Query<ActivityHistoryQuery>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminActivityVersionPage>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let page = ActivityHistoryPageRequest::parse(query.page, query.per_page)
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminWorldActivityHistoryRepository::new(&state.application_database);
    let history = AdminWorldActivityHistoryCommand::new(&repository)
        .list(&principal, activity_id, page)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(history))
}

/// Loads one selected historical state for source-adapted inspection.
pub async fn show(
    State(state): State<AppState>,
    Path((activity_id, version_id)): Path<(String, String)>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<ActivityVersionDetailsResponse>, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let version_id = Uuid::parse_str(&version_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminWorldActivityHistoryRepository::new(&state.application_database);
    let version = AdminWorldActivityHistoryCommand::new(&repository)
        .details(&principal, activity_id, version_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;
    Ok(Json(ActivityVersionDetailsResponse { version }))
}

/// Restores a selected snapshot transactionally. The current activity is first
/// preserved as a fresh history entry, so Restore itself remains reversible.
pub async fn restore(
    State(state): State<AppState>,
    Path((activity_id, version_id)): Path<(String, String)>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let activity_id = Uuid::parse_str(&activity_id).map_err(|_| ApiError::not_found())?;
    let version_id = Uuid::parse_str(&version_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminWorldActivityHistoryRepository::new(&state.application_database);
    let restored = AdminWorldActivityHistoryCommand::new(&repository)
        .restore(&principal, activity_id, version_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    if !restored {
        return Err(ApiError::not_found());
    }
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::ActivityHistoryQuery;
    use wicked_learning_application::admin_world_activity_history::ActivityHistoryPageRequest;

    #[test]
    fn keeps_the_source_six_item_default_and_rejects_an_unbounded_page() {
        let default_page = ActivityHistoryPageRequest::parse(None, None);
        assert_eq!(default_page.expect("default history page").per_page, 6);
        assert!(ActivityHistoryPageRequest::parse(Some(1), Some(25)).is_none());
        let query = serde_json::from_str::<ActivityHistoryQuery>(r#"{"page":2,"per_page":6}"#)
            .expect("history query is shaped");
        assert_eq!(query.page, Some(2));
    }
}
