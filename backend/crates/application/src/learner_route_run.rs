use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerRouteRun,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerRouteRunCommandError;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LearnerRouteStart {
    AuthoredStart(Uuid),
    NodeActivity { node_id: Uuid, activity_id: Uuid },
}

/// Owns the transaction boundary for entering or resetting an authored route.
/// A repository must apply visibility, publication and principal checks before
/// it writes; an absent result is deliberately indistinguishable from a route
/// the caller is not allowed to discover.
pub trait LearnerRouteRunRepository {
    fn start_or_resume(
        &self,
        principal: &AuthorizedPrincipal,
        start: LearnerRouteStart,
        expected_node_id: Option<Uuid>,
    ) -> impl Future<Output = Result<Option<LearnerRouteRun>, LearnerRouteRunCommandError>> + Send;

    fn reset(
        &self,
        principal: &AuthorizedPrincipal,
        start_id: Uuid,
        expected_node_id: Option<Uuid>,
    ) -> impl Future<Output = Result<Option<LearnerRouteRun>, LearnerRouteRunCommandError>> + Send;
}

pub struct LearnerRouteRunCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerRouteRunCommand<'repository, Repository>
where
    Repository: LearnerRouteRunRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn start_or_resume(
        &self,
        principal: &AuthorizedPrincipal,
        start_id: Uuid,
        expected_node_id: Option<Uuid>,
    ) -> Result<Option<LearnerRouteRun>, LearnerRouteRunCommandError> {
        self.repository
            .start_or_resume(
                principal,
                LearnerRouteStart::AuthoredStart(start_id),
                expected_node_id,
            )
            .await
    }

    pub async fn start_from_activity(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Uuid,
    ) -> Result<Option<LearnerRouteRun>, LearnerRouteRunCommandError> {
        self.repository
            .start_or_resume(
                principal,
                LearnerRouteStart::NodeActivity {
                    node_id,
                    activity_id,
                },
                Some(node_id),
            )
            .await
    }

    pub async fn reset(
        &self,
        principal: &AuthorizedPrincipal,
        start_id: Uuid,
        expected_node_id: Option<Uuid>,
    ) -> Result<Option<LearnerRouteRun>, LearnerRouteRunCommandError> {
        self.repository
            .reset(principal, start_id, expected_node_id)
            .await
    }
}

#[cfg(test)]
mod tests {
    use std::future::Future;

    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal, learner_state::LearnerRouteRun,
    };

    use super::{LearnerRouteRunCommand, LearnerRouteRunCommandError, LearnerRouteRunRepository};

    struct AbsentRepository;

    impl LearnerRouteRunRepository for AbsentRepository {
        fn start_or_resume(
            &self,
            _principal: &AuthorizedPrincipal,
            _start: super::LearnerRouteStart,
            _expected_node_id: Option<Uuid>,
        ) -> impl Future<Output = Result<Option<LearnerRouteRun>, LearnerRouteRunCommandError>> + Send
        {
            async { Ok(None) }
        }

        fn reset(
            &self,
            _principal: &AuthorizedPrincipal,
            _start_id: Uuid,
            _expected_node_id: Option<Uuid>,
        ) -> impl Future<Output = Result<Option<LearnerRouteRun>, LearnerRouteRunCommandError>> + Send
        {
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn keeps_missing_or_unauthorized_starts_indistinguishable() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec![],
        };

        let result = LearnerRouteRunCommand::new(&AbsentRepository)
            .start_or_resume(&principal, Uuid::new_v4(), None)
            .await;

        assert!(matches!(result, Ok(None)));
        let alias_result = LearnerRouteRunCommand::new(&AbsentRepository)
            .start_from_activity(&principal, Uuid::new_v4(), Uuid::new_v4())
            .await;
        assert!(matches!(alias_result, Ok(None)));
    }
}
