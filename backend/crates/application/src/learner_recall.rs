use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerRecallItem, LearnerRecallQueue},
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerRecallError;

pub fn valid_recall_confidence(value: Option<&str>) -> bool {
    value.is_none_or(|value| matches!(value, "exploring" | "leaning" | "settled"))
}

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

    fn remove_current_question(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl Future<Output = Result<Option<bool>, LearnerRecallError>> + Send;

    fn update_current_question_feedback(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        confidence: Option<&str>,
    ) -> impl Future<Output = Result<Option<bool>, LearnerRecallError>> + Send;

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

    pub async fn remove_current_question(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> Result<Option<bool>, LearnerRecallError> {
        self.repository
            .remove_current_question(principal, play_run_id, activity_slug)
            .await
    }

    pub async fn update_current_question_feedback(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        confidence: Option<&str>,
    ) -> Result<Option<bool>, LearnerRecallError> {
        if !valid_recall_confidence(confidence) {
            return Ok(None);
        }
        self.repository
            .update_current_question_feedback(principal, play_run_id, activity_slug, confidence)
            .await
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

        async fn remove_current_question(
            &self,
            _principal: &AuthorizedPrincipal,
            _play_run_id: Uuid,
            _activity_slug: &str,
        ) -> Result<Option<bool>, LearnerRecallError> {
            Ok(None)
        }

        async fn update_current_question_feedback(
            &self,
            _principal: &AuthorizedPrincipal,
            _play_run_id: Uuid,
            _activity_slug: &str,
            confidence: Option<&str>,
        ) -> Result<Option<bool>, LearnerRecallError> {
            assert!(super::valid_recall_confidence(confidence));
            Ok(None)
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

    #[tokio::test]
    async fn rejects_unknown_confidence_before_the_repository() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".into()],
            capabilities: vec![],
        };
        let command = LearnerRecallCommand::new(&AbsentRepository);
        for confidence in [
            None,
            Some("exploring"),
            Some("leaning"),
            Some("settled"),
            Some("certain"),
        ] {
            assert!(matches!(
                command
                    .update_current_question_feedback(
                        &principal,
                        Uuid::new_v4(),
                        "question",
                        confidence
                    )
                    .await,
                Ok(None)
            ));
        }
    }
}
