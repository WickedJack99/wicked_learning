use axum::{
    Json,
    extract::{Query, State},
};
use axum_login::AuthSession;
use serde::{Deserialize, Serialize};
use wicked_learning_application::learner_topics::{
    LearnerTopicDirectoryQuery, LearnerTopicDirectoryRequest,
};
use wicked_learning_domain::learner_state::LearnerTopicDirectory;
use wicked_learning_persistence::learner_topics::PostgresLearnerTopicDirectoryRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Deserialize)]
pub struct LearnerTopicQueryParameters {
    area: Option<String>,
    page: Option<i64>,
    search: Option<String>,
}

#[derive(Serialize)]
pub struct LearnerTopicDirectoryResponse {
    #[serde(flatten)]
    directory: LearnerTopicDirectory,
    can_manage_topics: bool,
}

pub async fn index(
    State(state): State<AppState>,
    Query(query): Query<LearnerTopicQueryParameters>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<LearnerTopicDirectoryResponse>, ApiError> {
    let request = LearnerTopicDirectoryRequest::parse(
        query.area.as_deref(),
        query.page,
        query.search.as_deref(),
    )
    .ok_or_else(ApiError::invalid_request)?;
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresLearnerTopicDirectoryRepository::new(&state.application_database);

    let directory = LearnerTopicDirectoryQuery::new(&repository)
        .execute(&principal, &request)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    Ok(Json(LearnerTopicDirectoryResponse {
        directory,
        can_manage_topics: can_manage_topics(&principal),
    }))
}

fn can_manage_topics(
    principal: &wicked_learning_domain::identity_access::AuthorizedPrincipal,
) -> bool {
    principal.has_permission("content_topics", "ru")
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::can_manage_topics;

    #[test]
    fn advertises_topic_management_only_to_the_source_write_permission() {
        let read_only = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec!["role_permission:content_topics:ro:all".to_owned()],
        };
        let manager = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["author".to_owned()],
            capabilities: vec!["role_permission:content_topics:ru:all".to_owned()],
        };

        assert!(!can_manage_topics(&read_only));
        assert!(can_manage_topics(&manager));
    }
}
