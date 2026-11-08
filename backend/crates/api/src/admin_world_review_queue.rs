use axum::{
    Json,
    extract::{Query, State},
};
use axum_login::AuthSession;
use serde::Deserialize;
use wicked_learning_application::admin_world_review_queue::{
    AdminWorldReviewQueuePageRequest, AdminWorldReviewQueueQuery,
};
use wicked_learning_domain::world_content::AdminWorldReviewQueuePage;
use wicked_learning_persistence::admin_world_review_queue::PostgresAdminWorldReviewQueueRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct AdminWorldReviewQueueQueryParameters {
    page: Option<i64>,
    per_page: Option<i64>,
}

/// Reads the source World Builder's bounded, map-editor-scoped review queue.
pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<AdminWorldReviewQueueQueryParameters>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminWorldReviewQueuePage>, ApiError> {
    let page = AdminWorldReviewQueuePageRequest::parse(query.page, query.per_page)
        .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminWorldReviewQueueRepository::new(&state.application_database);
    let queue = AdminWorldReviewQueueQuery::new(&repository)
        .execute(&principal, page)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::not_found)?;

    Ok(Json(queue))
}

#[cfg(test)]
mod tests {
    use super::AdminWorldReviewQueueQueryParameters;
    use wicked_learning_application::admin_world_review_queue::AdminWorldReviewQueuePageRequest;

    #[test]
    fn accepts_the_source_queue_query_shape_only() {
        let query = serde_json::from_str::<AdminWorldReviewQueueQueryParameters>(
            r#"{"page":2,"per_page":4}"#,
        )
        .expect("review queue query parses");
        assert_eq!(
            AdminWorldReviewQueuePageRequest::parse(query.page, query.per_page),
            Some(AdminWorldReviewQueuePageRequest {
                page: 2,
                per_page: 4
            })
        );
    }
}
