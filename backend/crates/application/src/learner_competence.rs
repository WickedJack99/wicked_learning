use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerCompetenceMap,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerCompetenceReadError;

pub trait LearnerCompetenceRepository {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl Future<Output = Result<Option<LearnerCompetenceMap>, LearnerCompetenceReadError>> + Send;
}

pub struct LearnerCompetenceQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerCompetenceQuery<'repository, Repository>
where
    Repository: LearnerCompetenceRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<LearnerCompetenceMap>, LearnerCompetenceReadError> {
        self.repository.load(principal).await
    }
}
