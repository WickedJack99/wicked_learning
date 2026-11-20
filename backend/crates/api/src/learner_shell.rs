use crate::{
    AppState, csrf, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};
use axum::{Json, extract::State, http::HeaderMap};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use wicked_learning_application::{
    learner_shell::{LearnerShellQuery, RememberLearnerMap, valid_map_reference},
    public_presentation::PublicPresentationQuery,
};
use wicked_learning_domain::{
    learner_shell::{LearnerMenuTheme, LearnerShell},
    platform_presentation::PublicPresentation,
};
use wicked_learning_persistence::{
    learner_shell::PostgresLearnerShellRepository,
    public_presentation::PostgresPublicPresentationRepository,
};

#[derive(Serialize)]
pub struct LearnerShellResponse {
    name: String,
    #[serde(flatten)]
    shell: LearnerShell,
    public_presentation: PublicPresentation,
}

pub async fn show(
    State(state): State<AppState>,
    auth: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerShellResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth).await?;
    let repository = PostgresLearnerShellRepository::new(&state.application_database);
    let shell = LearnerShellQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .ok_or_else(ApiError::forbidden)?;
    let presentation = PostgresPublicPresentationRepository::new(&state.application_database);
    let public_presentation = PublicPresentationQuery::new(&presentation)
        .execute()
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(Json(LearnerShellResponse {
        name: state.application_name,
        shell,
        public_presentation,
    }))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RememberMapRequest {
    map: String,
}

pub async fn remember_map(
    State(state): State<AppState>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth: AuthSession<IdentityBackend>,
    Json(body): Json<RememberMapRequest>,
) -> Result<Json<LearnerMenuTheme>, ApiError> {
    let principal = authenticated_principal(&state, auth).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    if !valid_map_reference(&body.map) {
        return Err(ApiError::invalid_request());
    }
    let repository = PostgresLearnerShellRepository::new(&state.application_database);
    RememberLearnerMap::new(&repository)
        .execute(&principal, &body.map)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}
