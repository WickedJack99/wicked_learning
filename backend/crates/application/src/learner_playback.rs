use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerPlaybackCompletionResult, LearnerPlaybackDocument},
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerPlaybackReadError;

pub trait LearnerPlaybackRepository {
    fn load_active_run(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
    ) -> impl Future<Output = Result<Option<LearnerPlaybackDocument>, LearnerPlaybackReadError>> + Send;
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerPlaybackCompletionError;

pub trait LearnerPlaybackCompletionRepository {
    /// Completes one of the explicitly supported source activity types. The
    /// persistence boundary verifies the current type and any prerequisite
    /// learner state; callers cannot turn this into a generic completion.
    fn complete_current_activity(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        confidence: Option<&str>,
        confidence_after_feedback: Option<&str>,
    ) -> impl Future<
        Output = Result<Option<LearnerPlaybackCompletionResult>, LearnerPlaybackCompletionError>,
    > + Send;
}

pub struct LearnerPlaybackQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct LearnerPlaybackCompletionCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerPlaybackCompletionCommand<'repository, Repository>
where
    Repository: LearnerPlaybackCompletionRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        confidence: Option<&str>,
        confidence_after_feedback: Option<&str>,
    ) -> Result<Option<LearnerPlaybackCompletionResult>, LearnerPlaybackCompletionError> {
        self.repository
            .complete_current_activity(
                principal,
                play_run_id,
                activity_slug,
                confidence,
                confidence_after_feedback,
            )
            .await
    }
}

impl<'repository, Repository> LearnerPlaybackQuery<'repository, Repository>
where
    Repository: LearnerPlaybackRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
    ) -> Result<Option<LearnerPlaybackDocument>, LearnerPlaybackReadError> {
        self.repository
            .load_active_run(principal, play_run_id)
            .await
    }
}

#[cfg(test)]
mod tests {
    use std::{future::Future, sync::Mutex};

    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal,
        learner_state::{LearnerPlaybackCompletionResult, LearnerPlaybackDocument},
    };

    use super::{
        LearnerPlaybackCompletionCommand, LearnerPlaybackCompletionError,
        LearnerPlaybackCompletionRepository, LearnerPlaybackQuery, LearnerPlaybackReadError,
        LearnerPlaybackRepository,
    };

    struct RecordingRepository {
        received: Mutex<Option<(Uuid, Uuid)>>,
    }

    struct CompletionAbsentRepository;

    struct CompletionRecordingRepository {
        received: Mutex<Option<(Option<String>, Option<String>)>>,
    }

    impl LearnerPlaybackCompletionRepository for CompletionAbsentRepository {
        fn complete_current_activity(
            &self,
            _principal: &AuthorizedPrincipal,
            _play_run_id: Uuid,
            _activity_slug: &str,
            _confidence: Option<&str>,
            _confidence_after_feedback: Option<&str>,
        ) -> impl Future<
            Output = Result<
                Option<LearnerPlaybackCompletionResult>,
                LearnerPlaybackCompletionError,
            >,
        > + Send {
            async { Ok(None) }
        }
    }

    impl LearnerPlaybackCompletionRepository for CompletionRecordingRepository {
        fn complete_current_activity(
            &self,
            _principal: &AuthorizedPrincipal,
            _play_run_id: Uuid,
            _activity_slug: &str,
            confidence: Option<&str>,
            confidence_after_feedback: Option<&str>,
        ) -> impl Future<
            Output = Result<
                Option<LearnerPlaybackCompletionResult>,
                LearnerPlaybackCompletionError,
            >,
        > + Send {
            *self.received.lock().expect("test mutex is available") = Some((
                confidence.map(ToOwned::to_owned),
                confidence_after_feedback.map(ToOwned::to_owned),
            ));

            async { Ok(None) }
        }
    }

    impl LearnerPlaybackRepository for RecordingRepository {
        fn load_active_run(
            &self,
            principal: &AuthorizedPrincipal,
            play_run_id: Uuid,
        ) -> impl Future<Output = Result<Option<LearnerPlaybackDocument>, LearnerPlaybackReadError>> + Send
        {
            let subject_id = principal.subject_id;
            *self.received.lock().expect("test mutex is available") =
                Some((subject_id, play_run_id));

            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn delegates_the_active_run_and_authenticated_principal_to_the_repository() {
        let repository = RecordingRepository {
            received: Mutex::new(None),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
        };
        let play_run_id = Uuid::new_v4();

        let result = LearnerPlaybackQuery::new(&repository)
            .execute(&principal, play_run_id)
            .await;

        assert!(matches!(result, Ok(None)));
        assert_eq!(
            *repository.received.lock().expect("test mutex is available"),
            Some((principal.subject_id, play_run_id)),
        );
    }

    #[tokio::test]
    async fn keeps_a_stale_or_unauthorized_completion_indistinguishable() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
        };

        let result = LearnerPlaybackCompletionCommand::new(&CompletionAbsentRepository)
            .execute(&principal, Uuid::new_v4(), "open-practice", None, None)
            .await;

        assert!(matches!(result, Ok(None)));
    }

    #[tokio::test]
    async fn delegates_reflection_confidence_without_interpreting_it() {
        let repository = CompletionRecordingRepository {
            received: Mutex::new(None),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
        };

        let result = LearnerPlaybackCompletionCommand::new(&repository)
            .execute(
                &principal,
                Uuid::new_v4(),
                "reflection",
                Some("exploring"),
                Some("settled"),
            )
            .await;

        assert!(matches!(result, Ok(None)));
        assert_eq!(
            *repository.received.lock().expect("test mutex is available"),
            Some((Some("exploring".to_owned()), Some("settled".to_owned()))),
        );
    }
}
