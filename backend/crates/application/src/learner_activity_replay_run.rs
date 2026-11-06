use std::future::Future;

use wicked_learning_domain::{identity_access::AuthorizedPrincipal, learner_state::LearnerActivityReplayRun};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerActivityReplayRunError;

pub trait LearnerActivityReplayRunRepository {
    fn open_or_resume(&self, principal: &AuthorizedPrincipal, activity_slug: &str) -> impl Future<Output = Result<Option<LearnerActivityReplayRun>, LearnerActivityReplayRunError>> + Send;
}

pub struct LearnerActivityReplayRunCommand<'repository, Repository> { repository: &'repository Repository }

impl<'repository, Repository> LearnerActivityReplayRunCommand<'repository, Repository>
where Repository: LearnerActivityReplayRunRepository {
    pub fn new(repository: &'repository Repository) -> Self { Self { repository } }
    pub async fn open_or_resume(&self, principal: &AuthorizedPrincipal, activity_slug: &str) -> Result<Option<LearnerActivityReplayRun>, LearnerActivityReplayRunError> {
        self.repository.open_or_resume(principal, activity_slug).await
    }
}
