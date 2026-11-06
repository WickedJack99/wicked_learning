use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerRecallItem, LearnerRecallQueue},
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerRecallError;

/// All queue reads and mutations are owner-scoped at the persistence boundary.
/// A browser never supplies an activity, outcome, interval, or another
/// learner's identifier to update this private state.
pub trait LearnerRecallRepository {
    fn list(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl Future<Output = Result<LearnerRecallQueue, LearnerRecallError>> + Send;

    fn queue_current_question(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl Future<Output = Result<Option<LearnerRecallItem>, LearnerRecallError>> + Send;

    fn remove(
        &self,
        principal: &AuthorizedPrincipal,
        recall_item_id: Uuid,
    ) -> impl Future<Output = Result<bool, LearnerRecallError>> + Send;

    fn postpone(
        &self,
        principal: &AuthorizedPrincipal,
        recall_item_id: Uuid,
    ) -> impl Future<Output = Result<Option<LearnerRecallItem>, LearnerRecallError>> + Send;
}

pub struct LearnerRecallQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct LearnerRecallCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerRecallQuery<'repository, Repository>
where
    Repository: LearnerRecallRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<LearnerRecallQueue, LearnerRecallError> {
        self.repository.list(principal).await
    }
}

impl<'repository, Repository> LearnerRecallCommand<'repository, Repository>
where
    Repository: LearnerRecallRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn queue_current_question(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> Result<Option<LearnerRecallItem>, LearnerRecallError> {
        self.repository
            .queue_current_question(principal, play_run_id, activity_slug)
            .await
    }

    pub async fn remove(
        &self,
        principal: &AuthorizedPrincipal,
        recall_item_id: Uuid,
    ) -> Result<bool, LearnerRecallError> {
        self.repository.remove(principal, recall_item_id).await
    }

    pub async fn postpone(
        &self,
        principal: &AuthorizedPrincipal,
        recall_item_id: Uuid,
    ) -> Result<Option<LearnerRecallItem>, LearnerRecallError> {
        self.repository.postpone(principal, recall_item_id).await
    }
}

#[cfg(test)]
mod tests {
    use std::future::Future;

    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal,
        learner_state::{LearnerRecallItem, LearnerRecallQueue},
    };

    use super::{
        LearnerRecallCommand, LearnerRecallError, LearnerRecallQuery, LearnerRecallRepository,
    };

    struct AbsentRepository;

    impl LearnerRecallRepository for AbsentRepository {
        fn list(
            &self,
            _principal: &AuthorizedPrincipal,
        ) -> impl Future<Output = Result<LearnerRecallQueue, LearnerRecallError>> + Send {
            async { Ok(LearnerRecallQueue { items: Vec::new() }) }
        }

        fn queue_current_question(
            &self,
            _principal: &AuthorizedPrincipal,
            _play_run_id: Uuid,
            _activity_slug: &str,
        ) -> impl Future<Output = Result<Option<LearnerRecallItem>, LearnerRecallError>> + Send
        {
            async { Ok(None) }
        }

        fn remove(
            &self,
            _principal: &AuthorizedPrincipal,
            _recall_item_id: Uuid,
        ) -> impl Future<Output = Result<bool, LearnerRecallError>> + Send {
            async { Ok(false) }
        }

        fn postpone(
            &self,
            _principal: &AuthorizedPrincipal,
            _recall_item_id: Uuid,
        ) -> impl Future<Output = Result<Option<LearnerRecallItem>, LearnerRecallError>> + Send
        {
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn does_not_distinguish_missing_from_unavailable_queue_targets() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec![],
        };
        let result = LearnerRecallCommand::new(&AbsentRepository)
            .queue_current_question(&principal, Uuid::new_v4(), "question")
            .await;

        assert!(matches!(result, Ok(None)));
    }

    #[tokio::test]
    async fn returns_an_empty_private_queue_when_no_items_are_visible() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec![],
        };
        let queue = LearnerRecallQuery::new(&AbsentRepository)
            .execute(&principal)
            .await
            .expect("empty queue is a valid result");

        assert!(queue.items.is_empty());
    }
}
