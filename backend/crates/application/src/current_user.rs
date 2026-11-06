use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerAppearance,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CurrentUserReadError;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CurrentUser {
    pub appearance: LearnerAppearance,
    pub principal: AuthorizedPrincipal,
}

/// The application boundary between an authenticated identity subject and
/// its application-side authorization assignment.
pub trait CurrentUserRepository {
    fn load_authorized_principal(
        &self,
        subject_id: Uuid,
    ) -> impl Future<Output = Result<Option<CurrentUser>, CurrentUserReadError>> + Send;
}

pub struct CurrentUserQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> CurrentUserQuery<'repository, Repository>
where
    Repository: CurrentUserRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        subject_id: Uuid,
    ) -> Result<Option<CurrentUser>, CurrentUserReadError> {
        self.repository.load_authorized_principal(subject_id).await
    }
}
