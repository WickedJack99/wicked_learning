use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerActivityCheckInResult,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearnerCheckInInput {
    pub feeling: Option<String>,
    pub next_direction: Option<String>,
    pub note: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerCheckInError;

/// The repository must resolve the activity from the caller-owned route run,
/// prove that it is completed, and write only that principal's observation.
pub trait LearnerCheckInRepository {
    fn record_completed_activity_check_in(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        input: &LearnerCheckInInput,
    ) -> impl Future<Output = Result<Option<LearnerActivityCheckInResult>, LearnerCheckInError>> + Send;
}

pub struct LearnerCheckInCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerCheckInCommand<'repository, Repository>
where
    Repository: LearnerCheckInRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        input: &LearnerCheckInInput,
    ) -> Result<Option<LearnerActivityCheckInResult>, LearnerCheckInError> {
        self.repository
            .record_completed_activity_check_in(principal, play_run_id, activity_slug, input)
            .await
    }
}

#[cfg(test)]
mod tests {
    use std::{future::Future, sync::Mutex};

    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{
        LearnerCheckInCommand, LearnerCheckInError, LearnerCheckInInput, LearnerCheckInRepository,
    };

    struct RecordingRepository {
        received: Mutex<Option<(Uuid, Uuid, String, LearnerCheckInInput)>>,
    }

    impl LearnerCheckInRepository for RecordingRepository {
        fn record_completed_activity_check_in(
            &self,
            principal: &AuthorizedPrincipal,
            play_run_id: Uuid,
            activity_slug: &str,
            input: &LearnerCheckInInput,
        ) -> impl Future<
            Output = Result<
                Option<wicked_learning_domain::learner_state::LearnerActivityCheckInResult>,
                LearnerCheckInError,
            >,
        > + Send {
            *self.received.lock().expect("test mutex is available") = Some((
                principal.subject_id,
                play_run_id,
                activity_slug.to_owned(),
                input.clone(),
            ));
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn delegates_only_the_authenticated_run_activity_and_private_input() {
        let repository = RecordingRepository {
            received: Mutex::new(None),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
        };
        let play_run_id = Uuid::new_v4();
        let input = LearnerCheckInInput {
            feeling: Some("forming".to_owned()),
            next_direction: Some("revisit".to_owned()),
            note: Some("I want to return after a pause.".to_owned()),
        };

        let result = LearnerCheckInCommand::new(&repository)
            .execute(&principal, play_run_id, "reflect-on-direction", &input)
            .await;

        assert!(matches!(result, Ok(None)));
        assert_eq!(
            *repository.received.lock().expect("test mutex is available"),
            Some((
                principal.subject_id,
                play_run_id,
                "reflect-on-direction".to_owned(),
                input
            )),
        );
    }
}
