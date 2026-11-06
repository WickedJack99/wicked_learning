use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerPortalTravelResult,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerPortalTravelError;

/// A portal command is intentionally distinct from normal completion. The
/// target is authored in the server-owned portal link; the browser supplies
/// only its current opaque run and activity slug.
pub trait LearnerPortalRepository {
    fn travel(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl Future<Output = Result<Option<LearnerPortalTravelResult>, LearnerPortalTravelError>> + Send;
}

pub struct LearnerPortalTravelCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerPortalTravelCommand<'repository, Repository>
where
    Repository: LearnerPortalRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> Result<Option<LearnerPortalTravelResult>, LearnerPortalTravelError> {
        self.repository
            .travel(principal, play_run_id, activity_slug)
            .await
    }
}

#[cfg(test)]
mod tests {
    use std::future::Future;

    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal, learner_state::LearnerPortalTravelResult,
    };

    use super::{LearnerPortalRepository, LearnerPortalTravelCommand, LearnerPortalTravelError};

    struct AbsentRepository;

    impl LearnerPortalRepository for AbsentRepository {
        fn travel(
            &self,
            _principal: &AuthorizedPrincipal,
            _play_run_id: Uuid,
            _activity_slug: &str,
        ) -> impl Future<
            Output = Result<Option<LearnerPortalTravelResult>, LearnerPortalTravelError>,
        > + Send {
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn keeps_an_unavailable_portal_indistinguishable() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec![],
        };

        let result = LearnerPortalTravelCommand::new(&AbsentRepository)
            .execute(&principal, Uuid::new_v4(), "portal")
            .await;

        assert!(matches!(result, Ok(None)));
    }
}
