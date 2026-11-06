use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::learning_support_moderation::{
    LearningSupportRequestsQuery, LearningSupportTopicsQuery, SaveLearningSupportReply,
};
use wicked_learning_domain::learner_state::{
    LearningSupportReplySaveResult, LearningSupportRequestPage, LearningSupportTopic,
};
use wicked_learning_persistence::learning_support_moderation::PostgresLearningSupportModerationRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct RequestsQuery {
    page: Option<i64>,
}

#[derive(Deserialize)]
pub struct SubmitLearningSupportReply {
    body: String,
}

pub async fn topics(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<Vec<LearningSupportTopic>>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearningSupportModerationRepository::new(
        &state.application_database,
        &state.identity_database,
    );

    LearningSupportTopicsQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn requests(
    State(state): State<AppState>,
    Path(topic_id): Path<String>,
    Query(query): Query<RequestsQuery>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearningSupportRequestPage>, ApiError> {
    let topic_id = Uuid::parse_str(&topic_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearningSupportModerationRepository::new(
        &state.application_database,
        &state.identity_database,
    );

    LearningSupportRequestsQuery::new(&repository)
        .execute(&principal, topic_id, query.page.unwrap_or(1))
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn save_reply(
    State(state): State<AppState>,
    Path(message_id): Path<String>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SubmitLearningSupportReply>,
) -> Result<(StatusCode, Json<LearningSupportReplySaveResult>), ApiError> {
    let message_id = Uuid::parse_str(&message_id).map_err(|_| ApiError::not_found())?;
    if !(2..=280).contains(&request.body.trim().chars().count()) {
        return Err(ApiError::invalid_request());
    }
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearningSupportModerationRepository::new(
        &state.application_database,
        &state.identity_database,
    );

    let Some((result, was_created)) = SaveLearningSupportReply::new(&repository)
        .execute(&principal, message_id, &request.body)
        .await
        .map_err(|_| ApiError::service_unavailable())?
    else {
        return Err(ApiError::not_found());
    };
    Ok((
        if was_created {
            StatusCode::CREATED
        } else {
            StatusCode::OK
        },
        Json(result),
    ))
}
