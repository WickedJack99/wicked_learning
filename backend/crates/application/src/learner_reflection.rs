use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerReflectionResult,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerReflectionError;

/// A reflection is accepted only for the current activity in a server-owned
/// run. The browser supplies the learner's private words, never a topic,
/// journal page, activity target, or transition.
pub trait LearnerReflectionRepository {
    fn save_current_reflection(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        reflection: &str,
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
        reflection: &str,
    ) -> Result<Option<LearnerReflectionResult>, LearnerReflectionError> {
        self.repository
            .save_current_reflection(principal, play_run_id, activity_slug, reflection)
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

    use super::{LearnerReflectionCommand, LearnerReflectionError, LearnerReflectionRepository};

    struct RecordingRepository {
        received: Mutex<Option<(Uuid, Uuid, String, String)>>,
    }

    impl LearnerReflectionRepository for RecordingRepository {
        fn save_current_reflection(
            &self,
            principal: &AuthorizedPrincipal,
            play_run_id: Uuid,
            activity_slug: &str,
            reflection: &str,
        ) -> impl Future<Output = Result<Option<LearnerReflectionResult>, LearnerReflectionError>> + Send
        {
            *self.received.lock().expect("test mutex is available") = Some((
                principal.subject_id,
                play_run_id,
                activity_slug.to_owned(),
                reflection.to_owned(),
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
                "I want to explore this direction further.",
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
            )),
        );
    }
}
