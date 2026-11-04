use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerWorldSnapshot,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerWorldReadError;

/// The application boundary for a learner's authorized, read-only World
/// snapshot. Persistence owns the role filter and principal ownership scope.
pub trait LearnerWorldRepository {
    fn load_first_visible(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl Future<Output = Result<Option<LearnerWorldSnapshot>, LearnerWorldReadError>> + Send;
}

pub struct LearnerWorldQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerWorldQuery<'repository, Repository>
where
    Repository: LearnerWorldRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<LearnerWorldSnapshot>, LearnerWorldReadError> {
        self.repository.load_first_visible(principal).await
    }
}

#[cfg(test)]
mod tests {
    use std::future::Future;

    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{LearnerWorldQuery, LearnerWorldReadError, LearnerWorldRepository};

    struct EmptyRepository;

    impl LearnerWorldRepository for EmptyRepository {
        fn load_first_visible(
            &self,
            _principal: &AuthorizedPrincipal,
        ) -> impl Future<
            Output = Result<
                Option<wicked_learning_domain::learner_state::LearnerWorldSnapshot>,
                LearnerWorldReadError,
            >,
        > + Send {
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn delegates_the_authenticated_principal_to_the_repository() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
        };

        let result = LearnerWorldQuery::new(&EmptyRepository)
            .execute(&principal)
            .await;

        assert!(matches!(result, Ok(None)));
    }
}
