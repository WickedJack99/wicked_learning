use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerPlaybackDocument,
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

pub struct LearnerPlaybackQuery<'repository, Repository> {
    repository: &'repository Repository,
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
        identity_access::AuthorizedPrincipal, learner_state::LearnerPlaybackDocument,
    };

    use super::{LearnerPlaybackQuery, LearnerPlaybackReadError, LearnerPlaybackRepository};

    struct RecordingRepository {
        received: Mutex<Option<(Uuid, Uuid)>>,
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
}
