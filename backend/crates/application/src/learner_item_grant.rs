use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerItemGrantResult,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerItemGrantError;

/// Rolls and applies only the items configured on the active `item_grant`
/// activity. The browser supplies neither an item reference nor a quantity.
pub trait LearnerItemGrantRepository {
    fn roll_current_items(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl Future<Output = Result<Option<LearnerItemGrantResult>, LearnerItemGrantError>> + Send;
}

pub struct LearnerItemGrantCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerItemGrantCommand<'repository, Repository>
where
    Repository: LearnerItemGrantRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> Result<Option<LearnerItemGrantResult>, LearnerItemGrantError> {
        self.repository
            .roll_current_items(principal, play_run_id, activity_slug)
            .await
    }
}
