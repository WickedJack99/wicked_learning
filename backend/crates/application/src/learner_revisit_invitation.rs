use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerRevisitInvitationActionResult,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LearnerRevisitInvitationAction {
    Dismiss,
    Snooze,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerRevisitInvitationError;

pub trait LearnerRevisitInvitationRepository {
    fn update_due_invitation(
        &self,
        principal: &AuthorizedPrincipal,
        check_in_id: Uuid,
        action: LearnerRevisitInvitationAction,
    ) -> impl Future<
        Output = Result<
            Option<LearnerRevisitInvitationActionResult>,
            LearnerRevisitInvitationError,
        >,
    > + Send;
}

pub struct LearnerRevisitInvitationCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerRevisitInvitationCommand<'repository, Repository>
where
    Repository: LearnerRevisitInvitationRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        check_in_id: Uuid,
        action: LearnerRevisitInvitationAction,
    ) -> Result<Option<LearnerRevisitInvitationActionResult>, LearnerRevisitInvitationError> {
        self.repository
            .update_due_invitation(principal, check_in_id, action)
            .await
    }
}
