use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerNodePlaybackDocument,
};

use crate::learner_playback::LearnerPlaybackReadError;

pub trait LearnerNodePlaybackRepository {
    fn load_node(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        requested_activity_id: Option<Uuid>,
    ) -> impl Future<Output = Result<Option<LearnerNodePlaybackDocument>, LearnerPlaybackReadError>> + Send;
}

pub struct LearnerNodePlaybackQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: LearnerNodePlaybackRepository>
    LearnerNodePlaybackQuery<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        requested_activity_id: Option<Uuid>,
    ) -> Result<Option<LearnerNodePlaybackDocument>, LearnerPlaybackReadError> {
        self.repository
            .load_node(principal, node_id, requested_activity_id)
            .await
    }
}
