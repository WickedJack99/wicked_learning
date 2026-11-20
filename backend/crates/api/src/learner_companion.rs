use axum::{
    Json,
    extract::{Path, Query, State},
    response::{IntoResponse, Response},
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::learner_companion::{
    LearnerCompanionError, LearnerCompanionQuery, LearnerCompanionRequest,
};
use wicked_learning_persistence::learner_companion::PostgresLearnerCompanionRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct LearnerCompanionQueryParameters {
    activity_id: Option<String>,
    map_slug: Option<String>,
    surface: String,
}

pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
    Query(query): Query<LearnerCompanionQueryParameters>,
) -> Result<Response, ApiError> {
    let request = context_request(query)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerCompanionRepository::new(&state.application_database);
    match LearnerCompanionQuery::new(&repository)
        .execute(&principal, &request)
        .await
        .map_err(map_error)?
    {
        Some(mut companion) => {
            if let Some(asset_id) = companion
                .avatar_url
                .as_deref()
                .and_then(wicked_learning_persistence::learner_media::managed_media_asset_id)
            {
                let mut query = url::form_urlencoded::Serializer::new(String::new());
                query.append_pair("surface", request.surface.as_str());
                if let Some(slug) = &request.map_slug {
                    query.append_pair("map_slug", slug);
                }
                if let Some(id) = request.activity_id {
                    query.append_pair("activity_id", &id.to_string());
                }
                companion.avatar_url = Some(format!(
                    "/api/v1/learner/companion/avatar/{asset_id}?{}",
                    query.finish()
                ));
            }
            Ok(Json(companion).into_response())
        }
        None => Ok(axum::http::StatusCode::NO_CONTENT.into_response()),
    }
}

fn context_request(
    query: LearnerCompanionQueryParameters,
) -> Result<LearnerCompanionRequest, ApiError> {
    let activity_id = query
        .activity_id
        .as_deref()
        .map(Uuid::parse_str)
        .transpose()
        .map_err(|_| ApiError::invalid_request())?;
    let request =
        LearnerCompanionRequest::parse(&query.surface, query.map_slug.as_deref(), activity_id)
            .ok_or_else(ApiError::invalid_request)?;
    Ok(request)
}

pub async fn avatar(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
    Path(asset_id): Path<Uuid>,
    Query(query): Query<LearnerCompanionQueryParameters>,
) -> Result<Response, ApiError> {
    let request = context_request(query)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerCompanionRepository::new(&state.application_database);
    if repository
        .avatar_asset_id(&principal, &request)
        .await
        .map_err(map_error)?
        != Some(asset_id)
    {
        return Err(ApiError::not_found());
    }
    let (object_key, content_type): (String, String) = sqlx::query_as(
        "SELECT object_key, content_type FROM reusable_media_assets WHERE id = $1 AND content_type LIKE 'image/%'",
    ).bind(asset_id).fetch_optional(&state.application_database).await
        .map_err(|_| ApiError::service_unavailable())?.ok_or_else(ApiError::not_found)?;
    crate::learner_media_assets::stored_response(&state, &object_key, &content_type).await
}

fn map_error(error: LearnerCompanionError) -> ApiError {
    match error {
        LearnerCompanionError::Unavailable => ApiError::service_unavailable(),
    }
}
