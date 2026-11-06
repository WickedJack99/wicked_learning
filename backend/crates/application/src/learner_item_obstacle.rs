use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerItemObstacleResult,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerItemObstacleError;

/// The source obstacle accepts only an item the learner drags to a configured
/// slot on the active run. The repository resolves both the expected slot and
/// the learner-owned item; the browser sends only its public slug.
pub trait LearnerItemObstacleRepository {
    fn place_current_item(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        item_slug: &str,
        slot_index: i16,
    ) -> impl Future<Output = Result<Option<LearnerItemObstacleResult>, LearnerItemObstacleError>> + Send;

    fn continue_current_obstacle(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl Future<Output = Result<Option<LearnerItemObstacleResult>, LearnerItemObstacleError>> + Send;
}

pub struct LearnerItemObstacleCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerItemObstacleCommand<'repository, Repository>
where
    Repository: LearnerItemObstacleRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn place(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        item_slug: &str,
        slot_index: i16,
    ) -> Result<Option<LearnerItemObstacleResult>, LearnerItemObstacleError> {
        self.repository
            .place_current_item(principal, play_run_id, activity_slug, item_slug, slot_index)
            .await
    }

    pub async fn continue_obstacle(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> Result<Option<LearnerItemObstacleResult>, LearnerItemObstacleError> {
        self.repository
            .continue_current_obstacle(principal, play_run_id, activity_slug)
            .await
    }
}
