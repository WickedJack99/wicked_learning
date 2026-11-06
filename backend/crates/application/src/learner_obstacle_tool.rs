use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerObstacleToolResult,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerObstacleToolError;

/// A source obstacle receives only a public owned-tool reference from React.
/// The repository resolves the active run, the authored allowed-tool list and
/// whether this clear is durable.
pub trait LearnerObstacleToolRepository {
    fn use_current_tool(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        tool_slug: &str,
    ) -> impl Future<Output = Result<Option<LearnerObstacleToolResult>, LearnerObstacleToolError>> + Send;
}

pub struct LearnerObstacleToolCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerObstacleToolCommand<'repository, Repository>
where
    Repository: LearnerObstacleToolRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn use_tool(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        tool_slug: &str,
    ) -> Result<Option<LearnerObstacleToolResult>, LearnerObstacleToolError> {
        self.repository
            .use_current_tool(principal, play_run_id, activity_slug, tool_slug)
            .await
    }
}
