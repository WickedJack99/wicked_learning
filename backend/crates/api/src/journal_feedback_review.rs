use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use wicked_learning_application::journal_feedback_review::{
    AdminJournalFeedbackItem, AdminJournalFeedbackPage, JournalFeedbackPolicy,
    JournalFeedbackPolicyQuery, JournalFeedbackReviewQuery, RespondJournalFeedbackResult,
    RespondToJournalFeedback, UpdateJournalFeedbackPolicy,
};
use wicked_learning_persistence::journal_feedback_review::PostgresJournalFeedbackReviewRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct PageQuery {
    page: Option<i64>,
}

#[derive(Deserialize)]
pub struct UpdatePolicyBody {
    allow_review_requests: bool,
}

#[derive(Deserialize)]
pub struct RespondBody {
    feedback: String,
}

#[derive(Serialize)]
pub struct PolicyResponse {
    allow_review_requests: bool,
}

#[derive(Serialize)]
pub struct ReviewPageResponse {
    items: Vec<ReviewItemResponse>,
    pagination: PaginationResponse,
}

#[derive(Serialize)]
pub struct ReviewItemResponse {
    domain: DomainResponse,
    feedback: Option<String>,
    id: String,
    page: PageResponse,
    requested_at: String,
    requester: IdentityResponse,
    responded_at: Option<String>,
    status: String,
}

#[derive(Serialize)]
struct DomainResponse {
    id: Option<String>,
    label: String,
    #[serde(rename = "type")]
    type_: String,
}

#[derive(Serialize)]
struct PageResponse {
    id: Option<String>,
    markdown: String,
    subtopic: Option<String>,
    title: String,
    topic: String,
}

#[derive(Serialize)]
struct IdentityResponse {
    email: Option<String>,
    name: Option<String>,
    subject_id: Option<String>,
}

#[derive(Serialize)]
struct PaginationResponse {
    current_page: i64,
    last_page: i64,
    per_page: i64,
    total: i64,
}

pub async fn policy(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<PolicyResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresJournalFeedbackReviewRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    JournalFeedbackPolicyQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(policy_response)
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn update_policy(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(body): Json<UpdatePolicyBody>,
) -> Result<Json<PolicyResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresJournalFeedbackReviewRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    UpdateJournalFeedbackPolicy::new(&repository)
        .execute(&principal, body.allow_review_requests)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(policy_response)
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<PageQuery>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<ReviewPageResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresJournalFeedbackReviewRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    JournalFeedbackReviewQuery::new(&repository)
        .execute(&principal, query.page.unwrap_or(1))
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(review_page_response)
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn respond(
    State(state): State<AppState>,
    Path(request_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(body): Json<RespondBody>,
) -> Result<StatusCode, ApiError> {
    let request_id = Uuid::parse_str(&request_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresJournalFeedbackReviewRepository::new(
        &state.application_database,
        &state.identity_database,
    );
    match RespondToJournalFeedback::new(&repository)
        .execute(&principal, request_id, &body.feedback)
        .await
        .map_err(|_| ApiError::service_unavailable())?
    {
        Some(RespondJournalFeedbackResult::Responded) => Ok(StatusCode::NO_CONTENT),
        Some(RespondJournalFeedbackResult::NotFound) => Err(ApiError::not_found()),
        Some(RespondJournalFeedbackResult::AlreadyResponded) | None => {
            Err(ApiError::journal_feedback_rejected())
        }
    }
}

fn policy_response(policy: JournalFeedbackPolicy) -> PolicyResponse {
    PolicyResponse {
        allow_review_requests: policy.allow_review_requests,
    }
}

fn review_page_response(page: AdminJournalFeedbackPage) -> ReviewPageResponse {
    ReviewPageResponse {
        items: page.items.into_iter().map(review_item_response).collect(),
        pagination: PaginationResponse {
            current_page: page.pagination.current_page,
            last_page: page.pagination.last_page,
            per_page: page.pagination.per_page,
            total: page.pagination.total,
        },
    }
}

fn review_item_response(item: AdminJournalFeedbackItem) -> ReviewItemResponse {
    ReviewItemResponse {
        domain: DomainResponse {
            id: item.domain.id,
            label: item.domain.label,
            type_: item.domain.type_,
        },
        feedback: item.feedback,
        id: item.id,
        page: PageResponse {
            id: item.page.id,
            markdown: item.page.markdown,
            subtopic: item.page.subtopic,
            title: item.page.title,
            topic: item.page.topic,
        },
        requested_at: item.requested_at,
        requester: IdentityResponse {
            email: item.requester.email,
            name: item.requester.name,
            subject_id: item.requester.subject_id,
        },
        responded_at: item.responded_at,
        status: item.status,
    }
}
