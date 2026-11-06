use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerDeskSupportResponse, LearnerSupportRequestState},
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerSupportError;

/// The repository resolves topic, audience, map visibility and active activity
/// from the owned play run. A browser cannot select a topic or submit a peer
/// message through this private-support command.
pub trait LearnerSupportRepository {
    fn load_current_request(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl Future<Output = Result<Option<LearnerSupportRequestState>, LearnerSupportError>> + Send;

    fn submit_current_request(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        body: &str,
    ) -> impl Future<Output = Result<Option<LearnerSupportRequestState>, LearnerSupportError>> + Send;

    fn load_desk_responses(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl Future<Output = Result<Vec<LearnerDeskSupportResponse>, LearnerSupportError>> + Send;
}

pub struct LearnerSupportRequestQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct LearnerSupportRequestCommand<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct LearnerSupportDeskQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerSupportRequestQuery<'repository, Repository>
where
    Repository: LearnerSupportRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> Result<Option<LearnerSupportRequestState>, LearnerSupportError> {
        self.repository
            .load_current_request(principal, play_run_id, activity_slug)
            .await
    }
}

impl<'repository, Repository> LearnerSupportRequestCommand<'repository, Repository>
where
    Repository: LearnerSupportRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        body: &str,
    ) -> Result<Option<LearnerSupportRequestState>, LearnerSupportError> {
        let body = body.trim();
        if !(2..=280).contains(&body.chars().count()) {
            return Ok(None);
        }

        self.repository
            .submit_current_request(principal, play_run_id, activity_slug, body)
            .await
    }
}

impl<'repository, Repository> LearnerSupportDeskQuery<'repository, Repository>
where
    Repository: LearnerSupportRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Vec<LearnerDeskSupportResponse>, LearnerSupportError> {
        self.repository.load_desk_responses(principal).await
    }
}

#[cfg(test)]
mod tests {
    use std::{future::Future, sync::Mutex};

    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal,
        learner_state::{LearnerDeskSupportResponse, LearnerSupportRequestState},
    };

    use super::{
        LearnerSupportError, LearnerSupportRepository, LearnerSupportRequestCommand,
        LearnerSupportRequestQuery,
    };

    struct RecordingRepository {
        received: Mutex<Option<(Uuid, String, String)>>,
    }

    impl LearnerSupportRepository for RecordingRepository {
        fn load_current_request(
            &self,
            _principal: &AuthorizedPrincipal,
            _play_run_id: Uuid,
            _activity_slug: &str,
        ) -> impl Future<Output = Result<Option<LearnerSupportRequestState>, LearnerSupportError>> + Send
        {
            async { Ok(None) }
        }

        fn submit_current_request(
            &self,
            _principal: &AuthorizedPrincipal,
            play_run_id: Uuid,
            activity_slug: &str,
            body: &str,
        ) -> impl Future<Output = Result<Option<LearnerSupportRequestState>, LearnerSupportError>> + Send
        {
            *self.received.lock().expect("test mutex is available") =
                Some((play_run_id, activity_slug.to_owned(), body.to_owned()));
            async { Ok(None) }
        }

        fn load_desk_responses(
            &self,
            _principal: &AuthorizedPrincipal,
        ) -> impl Future<Output = Result<Vec<LearnerDeskSupportResponse>, LearnerSupportError>> + Send
        {
            async { Ok(Vec::new()) }
        }
    }

    fn principal() -> AuthorizedPrincipal {
        AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec![],
        }
    }

    #[tokio::test]
    async fn trims_a_valid_private_request_before_it_reaches_persistence() {
        let repository = RecordingRepository {
            received: Mutex::new(None),
        };
        let play_run_id = Uuid::new_v4();

        let result = LearnerSupportRequestCommand::new(&repository)
            .execute(
                &principal(),
                play_run_id,
                "ask-learning-support",
                "  Please help.  ",
            )
            .await;

        assert!(matches!(result, Ok(None)));
        assert_eq!(
            *repository.received.lock().expect("test mutex is available"),
            Some((
                play_run_id,
                "ask-learning-support".to_owned(),
                "Please help.".to_owned(),
            )),
        );
    }

    #[tokio::test]
    async fn rejects_unbounded_or_blank_requests_before_persistence() {
        let repository = RecordingRepository {
            received: Mutex::new(None),
        };
        let command = LearnerSupportRequestCommand::new(&repository);

        assert!(matches!(
            command
                .execute(&principal(), Uuid::new_v4(), "ask-learning-support", " ")
                .await,
            Ok(None)
        ));
        assert!(matches!(
            command
                .execute(
                    &principal(),
                    Uuid::new_v4(),
                    "ask-learning-support",
                    &"x".repeat(281),
                )
                .await,
            Ok(None)
        ));
        assert!(
            repository
                .received
                .lock()
                .expect("test mutex is available")
                .is_none()
        );
    }

    #[tokio::test]
    async fn query_keeps_an_unknown_current_activity_indistinguishable() {
        let repository = RecordingRepository {
            received: Mutex::new(None),
        };

        let result = LearnerSupportRequestQuery::new(&repository)
            .execute(&principal(), Uuid::new_v4(), "unknown")
            .await;

        assert!(matches!(result, Ok(None)));
    }
}
