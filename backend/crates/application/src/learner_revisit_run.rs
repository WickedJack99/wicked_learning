use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerRevisitRun,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerRevisitRunError;

/// Opens or resumes the one server-owned review run for a due invitation. The
/// repository owns the SQL transaction so the visibility, due-time and owner
/// checks cannot be separated from run creation.
pub trait LearnerRevisitRunRepository {
    fn open_or_resume_due_invitation(
        &self,
        principal: &AuthorizedPrincipal,
        check_in_id: Uuid,
    ) -> impl Future<Output = Result<Option<LearnerRevisitRun>, LearnerRevisitRunError>> + Send;
}

pub struct LearnerRevisitRunCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerRevisitRunCommand<'repository, Repository>
where
    Repository: LearnerRevisitRunRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn open_or_resume_due_invitation(
        &self,
        principal: &AuthorizedPrincipal,
        check_in_id: Uuid,
    ) -> Result<Option<LearnerRevisitRun>, LearnerRevisitRunError> {
        self.repository
            .open_or_resume_due_invitation(principal, check_in_id)
            .await
    }
}

#[cfg(test)]
mod tests {
    use std::future::Future;

    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal, learner_state::LearnerRevisitRun,
    };

    use super::{LearnerRevisitRunCommand, LearnerRevisitRunError, LearnerRevisitRunRepository};

    struct AbsentRepository;

    impl LearnerRevisitRunRepository for AbsentRepository {
        fn open_or_resume_due_invitation(
            &self,
            _principal: &AuthorizedPrincipal,
            _check_in_id: Uuid,
        ) -> impl Future<Output = Result<Option<LearnerRevisitRun>, LearnerRevisitRunError>> + Send
        {
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn keeps_an_unknown_or_unavailable_invitation_indistinguishable() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec![],
        };

        let result = LearnerRevisitRunCommand::new(&AbsentRepository)
            .open_or_resume_due_invitation(&principal, Uuid::new_v4())
            .await;

        assert!(matches!(result, Ok(None)));
    }
}
