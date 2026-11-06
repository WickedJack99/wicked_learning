use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerReflectionResult,
};

/// Private fields a learner may submit for the already-authorized reflection
/// activity. The repository derives response type, journal category, guidance
/// and activity ownership from the active play run; none are browser inputs.
pub struct LearnerReflectionSubmission<'value> {
    pub reflection: &'value str,
    pub response_context: Option<&'value str>,
    pub observed_cues: &'value [String],
    pub independent_check: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerReflectionError;

/// A reflection is accepted only for the current activity in a server-owned
/// run. The browser supplies private response fields only, never a topic,
/// journal page, activity target, response type or transition.
pub trait LearnerReflectionRepository {
    fn save_current_reflection(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        submission: LearnerReflectionSubmission<'_>,
    ) -> impl Future<Output = Result<Option<LearnerReflectionResult>, LearnerReflectionError>> + Send;
}

pub struct LearnerReflectionCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerReflectionCommand<'repository, Repository>
where
    Repository: LearnerReflectionRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        submission: LearnerReflectionSubmission<'_>,
    ) -> Result<Option<LearnerReflectionResult>, LearnerReflectionError> {
        self.repository
            .save_current_reflection(principal, play_run_id, activity_slug, submission)
            .await
    }
}

#[cfg(test)]
mod tests {
    use std::{future::Future, sync::Mutex};

    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal, learner_state::LearnerReflectionResult,
    };

    use super::{
        LearnerReflectionCommand, LearnerReflectionError, LearnerReflectionRepository,
        LearnerReflectionSubmission,
    };

    struct RecordingRepository {
        received: Mutex<
            Option<(
                Uuid,
                Uuid,
                String,
                String,
                Option<String>,
                Vec<String>,
                bool,
            )>,
        >,
    }

    impl LearnerReflectionRepository for RecordingRepository {
        fn save_current_reflection(
            &self,
            principal: &AuthorizedPrincipal,
            play_run_id: Uuid,
            activity_slug: &str,
            submission: LearnerReflectionSubmission<'_>,
        ) -> impl Future<Output = Result<Option<LearnerReflectionResult>, LearnerReflectionError>> + Send
        {
            *self.received.lock().expect("test mutex is available") = Some((
                principal.subject_id,
                play_run_id,
                activity_slug.to_owned(),
                submission.reflection.to_owned(),
                submission.response_context.map(ToOwned::to_owned),
                submission.observed_cues.to_vec(),
                submission.independent_check,
            ));

            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn delegates_only_the_active_run_and_private_reflection_to_the_repository() {
        let repository = RecordingRepository {
            received: Mutex::new(None),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
        };
        let play_run_id = Uuid::new_v4();

        let result = LearnerReflectionCommand::new(&repository)
            .execute(
                &principal,
                play_run_id,
                "reflect-on-direction",
                LearnerReflectionSubmission {
                    reflection: "I want to explore this direction further.",
                    response_context: None,
                    observed_cues: &[],
                    independent_check: false,
                },
            )
            .await;

        assert!(matches!(result, Ok(None)));
        assert_eq!(
            *repository.received.lock().expect("test mutex is available"),
            Some((
                principal.subject_id,
                play_run_id,
                "reflect-on-direction".to_owned(),
                "I want to explore this direction further.".to_owned(),
                None,
                Vec::new(),
                false,
            )),
        );
    }
}
