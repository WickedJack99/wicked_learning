use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerToolGrantResult,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerToolGrantError;

/// Claims only the tool configured by the current active `tool_grant`
/// activity. The browser supplies no tool or principal identifier.
pub trait LearnerToolGrantRepository {
    fn grant_current_tool(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl Future<Output = Result<Option<LearnerToolGrantResult>, LearnerToolGrantError>> + Send;
}

pub struct LearnerToolGrantCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerToolGrantCommand<'repository, Repository>
where
    Repository: LearnerToolGrantRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> Result<Option<LearnerToolGrantResult>, LearnerToolGrantError> {
        self.repository
            .grant_current_tool(principal, play_run_id, activity_slug)
            .await
    }
}
