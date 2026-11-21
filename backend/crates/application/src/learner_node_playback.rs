use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerNodePlaybackDocument, LearnerPlaybackActivityState},
};

use crate::learner_playback::{
    LearnerPlaybackCompletionError, LearnerPlaybackReachError, LearnerPlaybackReadError,
};

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

pub trait LearnerNodeReachRepository {
    fn reach_activity(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Uuid,
    ) -> impl Future<
        Output = Result<Option<LearnerPlaybackActivityState>, LearnerPlaybackReachError>,
    > + Send;
}

pub struct LearnerNodeReachCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: LearnerNodeReachRepository>
    LearnerNodeReachCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Uuid,
    ) -> Result<Option<LearnerPlaybackActivityState>, LearnerPlaybackReachError> {
        self.repository
            .reach_activity(principal, node_id, activity_id)
            .await
    }
}

pub trait LearnerNodeCompletionRepository {
    fn complete_activity(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Uuid,
    ) -> impl Future<
        Output = Result<Option<LearnerPlaybackActivityState>, LearnerPlaybackCompletionError>,
    > + Send;
}

pub struct LearnerNodeCompletionCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: LearnerNodeCompletionRepository>
    LearnerNodeCompletionCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Uuid,
    ) -> Result<Option<LearnerPlaybackActivityState>, LearnerPlaybackCompletionError> {
        self.repository
            .complete_activity(principal, node_id, activity_id)
            .await
    }
}
