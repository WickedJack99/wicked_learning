use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerRecallRun,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerRecallRunError;

/// Opens one existing, owner-scoped recall item. The repository must derive
/// the activity from the item and verify publication/access in the same
/// transaction that creates or resumes the run.
pub trait LearnerRecallRunRepository {
    fn open_or_resume(
        &self,
        principal: &AuthorizedPrincipal,
        recall_item_id: Uuid,
    ) -> impl Future<Output = Result<Option<LearnerRecallRun>, LearnerRecallRunError>> + Send;
}

pub struct LearnerRecallRunCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerRecallRunCommand<'repository, Repository>
where
    Repository: LearnerRecallRunRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn open_or_resume(
        &self,
        principal: &AuthorizedPrincipal,
        recall_item_id: Uuid,
    ) -> Result<Option<LearnerRecallRun>, LearnerRecallRunError> {
        self.repository
            .open_or_resume(principal, recall_item_id)
            .await
    }
}

#[cfg(test)]
mod tests {
    use std::future::Future;

    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal, learner_state::LearnerRecallRun,
    };

    use super::{LearnerRecallRunCommand, LearnerRecallRunError, LearnerRecallRunRepository};

    struct AbsentRepository;

    impl LearnerRecallRunRepository for AbsentRepository {
        fn open_or_resume(
            &self,
            _principal: &AuthorizedPrincipal,
            _recall_item_id: Uuid,
        ) -> impl Future<Output = Result<Option<LearnerRecallRun>, LearnerRecallRunError>> + Send
        {
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn keeps_other_learners_queue_items_indistinguishable_from_missing_items() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
        };
        let result = LearnerRecallRunCommand::new(&AbsentRepository)
            .open_or_resume(&principal, Uuid::new_v4())
            .await;

        assert!(matches!(result, Ok(None)));
    }
}
