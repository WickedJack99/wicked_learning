use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::platform_feedback_review::{
    MarkPlatformFeedbackReviewed, PlatformFeedbackReviewPage, PlatformFeedbackReviewQuery,
};
use wicked_learning_persistence::platform_feedback_review::PostgresPlatformFeedbackReviewRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct PlatformFeedbackReviewQueryParameters {
    page: Option<i64>,
}

#[derive(Serialize)]
pub struct PlatformFeedbackReviewPageResponse {
    items: Vec<PlatformFeedbackReviewItemResponse>,
    pagination: PlatformFeedbackReviewPaginationResponse,
}

#[derive(Serialize)]
struct PlatformFeedbackReviewItemResponse {
    category: String,
    id: String,
    message: String,
    reviewed_at: Option<String>,
    submitted_at: String,
    user: PlatformFeedbackReviewIdentityResponse,
}

#[derive(Serialize)]
struct PlatformFeedbackReviewIdentityResponse {
    email: Option<String>,
    name: Option<String>,
    subject_id: Option<String>,
}

#[derive(Serialize)]
struct PlatformFeedbackReviewPaginationResponse {
    current_page: i64,
    last_page: i64,
    per_page: i64,
    total: i64,
}

pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<PlatformFeedbackReviewQueryParameters>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<PlatformFeedbackReviewPageResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresPlatformFeedbackReviewRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    PlatformFeedbackReviewQuery::new(&repository)
        .execute(&principal, query.page.unwrap_or(1))
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(response)
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn mark_reviewed(
    State(state): State<AppState>,
    Path(feedback_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<StatusCode, ApiError> {
    let feedback_id = Uuid::parse_str(&feedback_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresPlatformFeedbackReviewRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    let marked = MarkPlatformFeedbackReviewed::new(&repository)
        .execute(&principal, feedback_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    marked.ok_or_else(ApiError::not_found)?;

    Ok(StatusCode::NO_CONTENT)
}

fn response(page: PlatformFeedbackReviewPage) -> PlatformFeedbackReviewPageResponse {
    PlatformFeedbackReviewPageResponse {
        items: page
            .items
            .into_iter()
            .map(|item| PlatformFeedbackReviewItemResponse {
                category: item.category,
                id: item.id,
                message: item.message,
                reviewed_at: item.reviewed_at,
                submitted_at: item.submitted_at,
                user: PlatformFeedbackReviewIdentityResponse {
                    email: item.user.email,
                    name: item.user.name,
                    subject_id: item.user.subject_id,
                },
            })
            .collect(),
        pagination: PlatformFeedbackReviewPaginationResponse {
            current_page: page.pagination.current_page,
            last_page: page.pagination.last_page,
            per_page: page.pagination.per_page,
            total: page.pagination.total,
        },
    }
}
