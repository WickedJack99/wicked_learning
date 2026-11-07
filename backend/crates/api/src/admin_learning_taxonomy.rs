use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use axum_login::AuthSession;
use serde::Deserialize;
use wicked_learning_application::admin_learning_taxonomy::{
    AdminLearningTaxonomyCommand, AdminLearningTaxonomyQuery, CompetenceTopicForm,
    LearningConceptForm,
};
use wicked_learning_domain::authoring::AdminLearningTaxonomy;
use wicked_learning_persistence::admin_learning_taxonomy::PostgresAdminLearningTaxonomyRepository;

use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct SaveCompetenceTopicsRequest {
    topics: Vec<SaveCompetenceTopicRequest>,
}

#[derive(Deserialize)]
pub struct SaveCompetenceTopicRequest {
    name: String,
    description: Option<String>,
    growth_threshold: f64,
    emittance_threshold: f64,
    aura_threshold: f64,
    is_active: bool,
}

#[derive(Deserialize)]
pub struct SaveLearningConceptsRequest {
    concepts: Vec<SaveLearningConceptRequest>,
}

#[derive(Deserialize)]
pub struct SaveLearningConceptRequest {
    name: String,
    description: Option<String>,
    is_active: bool,
}

pub async fn index(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<AdminLearningTaxonomy>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminLearningTaxonomyRepository::new(&state.application_database);
    AdminLearningTaxonomyQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn sync_competence_topics(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveCompetenceTopicsRequest>,
) -> Result<StatusCode, ApiError> {
    let topics = CompetenceTopicForm::parse_all(
        request
            .topics
            .into_iter()
            .map(|topic| CompetenceTopicForm {
                name: topic.name,
                description: topic.description,
                growth_threshold: topic.growth_threshold,
                emittance_threshold: topic.emittance_threshold,
                aura_threshold: topic.aura_threshold,
                is_active: topic.is_active,
            })
            .collect(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminLearningTaxonomyRepository::new(&state.application_database);
    let saved = AdminLearningTaxonomyCommand::new(&repository)
        .sync_competence_topics(&principal, &topics)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    if !saved {
        return Err(ApiError::not_found());
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn sync_learning_concepts(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
    Json(request): Json<SaveLearningConceptsRequest>,
) -> Result<StatusCode, ApiError> {
    let concepts = LearningConceptForm::parse_all(
        request
            .concepts
            .into_iter()
            .map(|concept| LearningConceptForm {
                name: concept.name,
                description: concept.description,
                is_active: concept.is_active,
            })
            .collect(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresAdminLearningTaxonomyRepository::new(&state.application_database);
    let saved = AdminLearningTaxonomyCommand::new(&repository)
        .sync_learning_concepts(&principal, &concepts)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    if !saved {
        return Err(ApiError::not_found());
    }
    Ok(StatusCode::NO_CONTENT)
}
