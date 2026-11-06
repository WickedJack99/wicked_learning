use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerBookmarkMap,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerBookmarkMapReadError;

/// A personal bookmark map has no browser-supplied filter. The repository
/// resolves both the principal and their currently visible map scope.
pub trait LearnerBookmarkMapRepository {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl Future<Output = Result<Option<LearnerBookmarkMap>, LearnerBookmarkMapReadError>> + Send;
}

pub struct LearnerBookmarkMapQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerBookmarkMapQuery<'repository, Repository>
where
    Repository: LearnerBookmarkMapRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<LearnerBookmarkMap>, LearnerBookmarkMapReadError> {
        self.repository.load(principal).await
    }
}

#[cfg(test)]
mod tests {
    use std::future::Future;

    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal, learner_state::LearnerBookmarkMap,
    };

    use super::{
        LearnerBookmarkMapQuery, LearnerBookmarkMapReadError, LearnerBookmarkMapRepository,
    };

    struct EmptyRepository;

    impl LearnerBookmarkMapRepository for EmptyRepository {
        fn load(
            &self,
            _principal: &AuthorizedPrincipal,
        ) -> impl Future<Output = Result<Option<LearnerBookmarkMap>, LearnerBookmarkMapReadError>> + Send
        {
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn delegates_the_authenticated_principal_to_the_repository() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec![],
        };

        let result = LearnerBookmarkMapQuery::new(&EmptyRepository)
            .execute(&principal)
            .await;

        assert!(matches!(result, Ok(None)));
    }
}
