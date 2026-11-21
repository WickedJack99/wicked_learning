use axum::{
    Json,
    extract::{Path, Query, State},
    http::HeaderMap,
};
use axum_login::AuthSession;
use serde::Deserialize;
use uuid::Uuid;
use wicked_learning_application::{
    current_user::CurrentUserQuery, learner_route_run::LearnerRouteRunCommand,
};
use wicked_learning_domain::learner_state::LearnerRouteRun;
use wicked_learning_persistence::{
    current_user::PostgresCurrentUserRepository,
    learner_route_run::PostgresLearnerRouteRunRepository,
};

use crate::{AppState, csrf, error::ApiError, identity::IdentityBackend};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RouteNodeContext {
    node_id: Option<Uuid>,
}

pub async fn start_or_resume(
    State(state): State<AppState>,
    Path(start_id): Path<String>,
    Query(context): Query<RouteNodeContext>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerRouteRun>, ApiError> {
    let start_id = Uuid::parse_str(&start_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerRouteRunRepository::new(&state.application_database);

    LearnerRouteRunCommand::new(&repository)
        .start_or_resume(&principal, start_id, context.node_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub async fn reset(
    State(state): State<AppState>,
    Path(start_id): Path<String>,
    Query(context): Query<RouteNodeContext>,
    headers: HeaderMap,
    csrf_token: axum_csrf::CsrfToken,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerRouteRun>, ApiError> {
    let start_id = Uuid::parse_str(&start_id).map_err(|_| ApiError::not_found())?;
    let principal = authenticated_principal(&state, auth_session).await?;
    csrf::verify_unsafe_browser_request(&csrf_token, &headers, &state.public_origin)?;
    let repository = PostgresLearnerRouteRunRepository::new(&state.application_database);

    LearnerRouteRunCommand::new(&repository)
        .reset(&principal, start_id, context.node_id)
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(Json)
        .ok_or_else(ApiError::not_found)
}

pub(crate) async fn authenticated_principal(
    state: &AppState,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<wicked_learning_domain::identity_access::AuthorizedPrincipal, ApiError> {
    let subject = auth_session
        .user
        .ok_or_else(ApiError::authentication_required)?;
    let repository = PostgresCurrentUserRepository::new(&state.application_database);

    CurrentUserQuery::new(&repository)
        .execute(subject.subject_id())
        .await
        .map_err(|_| ApiError::service_unavailable())?
        .map(|current_user| current_user.principal)
        .ok_or_else(ApiError::forbidden)
}

#[cfg(test)]
mod tests {
    use super::RouteNodeContext;
    use axum::{extract::Query, http::Uri};
    use uuid::Uuid;

    #[test]
    fn route_node_context_is_optional_but_rejects_ambiguous_or_malformed_queries() {
        let node = Uuid::new_v4();
        for (query, expected) in [
            (String::new(), None),
            (format!("?node_id={node}"), Some(node)),
        ] {
            let uri: Uri = format!("/start{query}").parse().unwrap();
            assert_eq!(
                Query::<RouteNodeContext>::try_from_uri(&uri)
                    .unwrap()
                    .node_id,
                expected
            );
        }
        for query in [
            "?node_id=not-a-uuid".to_owned(),
            "?node_id=".to_owned(),
            format!("?node_id={node}&node_id={node}"),
            format!("?node_id={node}&principal_id={node}"),
        ] {
            let uri: Uri = format!("/start{query}").parse().unwrap();
            assert!(Query::<RouteNodeContext>::try_from_uri(&uri).is_err());
        }
    }
}
