use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::{ApplicationCapability, AuthorizedPrincipal},
    learner_state::{
        LearningSupportModerationReply, LearningSupportReplySaveResult, LearningSupportRequestPage,
        LearningSupportTopic,
    },
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearningSupportModerationError;

/// This port is capability-scoped at the use-case boundary. Its adapter may
/// read the separate identity database only to attach the limited author
/// contact projection needed by an authorized support worker.
pub trait LearningSupportModerationRepository {
    fn list_topics(
        &self,
    ) -> impl Future<Output = Result<Vec<LearningSupportTopic>, LearningSupportModerationError>> + Send;

    fn list_requests(
        &self,
        topic_id: Uuid,
        page: i64,
    ) -> impl Future<
        Output = Result<Option<LearningSupportRequestPage>, LearningSupportModerationError>,
    > + Send;

    fn save_reply(
        &self,
        principal: &AuthorizedPrincipal,
        message_id: Uuid,
        body: &str,
    ) -> impl Future<
        Output = Result<
            Option<(LearningSupportModerationReply, bool)>,
            LearningSupportModerationError,
        >,
    > + Send;
}

pub struct LearningSupportTopicsQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct LearningSupportRequestsQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct SaveLearningSupportReply<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearningSupportTopicsQuery<'repository, Repository>
where
    Repository: LearningSupportModerationRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<Vec<LearningSupportTopic>>, LearningSupportModerationError> {
        if !principal.has_capability(ApplicationCapability::ModerateLearnerMessages) {
            return Ok(None);
        }

        self.repository.list_topics().await.map(Some)
    }
}

impl<'repository, Repository> LearningSupportRequestsQuery<'repository, Repository>
where
    Repository: LearningSupportModerationRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        topic_id: Uuid,
        page: i64,
    ) -> Result<Option<LearningSupportRequestPage>, LearningSupportModerationError> {
        if !principal.has_capability(ApplicationCapability::ModerateLearnerMessages)
            || !(1..=10_000).contains(&page)
        {
            return Ok(None);
        }

        self.repository.list_requests(topic_id, page).await
    }
}

impl<'repository, Repository> SaveLearningSupportReply<'repository, Repository>
where
    Repository: LearningSupportModerationRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        message_id: Uuid,
        body: &str,
    ) -> Result<Option<(LearningSupportReplySaveResult, bool)>, LearningSupportModerationError>
    {
        let body = body.trim();
        if !principal.has_capability(ApplicationCapability::ModerateLearnerMessages)
            || !(2..=280).contains(&body.chars().count())
        {
            return Ok(None);
        }

        self.repository
            .save_reply(principal, message_id, body)
            .await
            .map(|result| {
                result.map(|(response, was_created)| {
                    (LearningSupportReplySaveResult { response }, was_created)
                })
            })
    }
}

#[cfg(test)]
mod tests {
    use std::{future::Future, sync::Mutex};

    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal,
        learner_state::{
            LearningSupportModerationReply, LearningSupportRequestPage, LearningSupportTopic,
        },
    };

    use super::{
        LearningSupportModerationError, LearningSupportModerationRepository,
        SaveLearningSupportReply,
    };

    struct RecordingRepository {
        received: Mutex<Option<(Uuid, String)>>,
    }

    impl LearningSupportModerationRepository for RecordingRepository {
        fn list_topics(
            &self,
        ) -> impl Future<Output = Result<Vec<LearningSupportTopic>, LearningSupportModerationError>> + Send
        {
            async { Ok(Vec::new()) }
        }

        fn list_requests(
            &self,
            _topic_id: Uuid,
            _page: i64,
        ) -> impl Future<
            Output = Result<Option<LearningSupportRequestPage>, LearningSupportModerationError>,
        > + Send {
            async { Ok(None) }
        }

        fn save_reply(
            &self,
            _principal: &AuthorizedPrincipal,
            message_id: Uuid,
            body: &str,
        ) -> impl Future<
            Output = Result<
                Option<(LearningSupportModerationReply, bool)>,
                LearningSupportModerationError,
            >,
        > + Send {
            *self.received.lock().expect("test mutex is available") =
                Some((message_id, body.to_owned()));
            async { Ok(None) }
        }
    }

    fn moderator() -> AuthorizedPrincipal {
        AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learning_support".to_owned()],
            capabilities: vec!["learner_messages_moderate".to_owned()],
        }
    }

    #[tokio::test]
    async fn trims_a_reply_before_the_capability_scoped_repository_receives_it() {
        let repository = RecordingRepository {
            received: Mutex::new(None),
        };
        let message_id = Uuid::new_v4();

        let result = SaveLearningSupportReply::new(&repository)
            .execute(&moderator(), message_id, "  A careful response.  ")
            .await;

        assert!(matches!(result, Ok(None)));
        assert_eq!(
            *repository.received.lock().expect("test mutex is available"),
            Some((message_id, "A careful response.".to_owned())),
        );
    }

    #[tokio::test]
    async fn cannot_save_a_reply_without_the_explicit_capability() {
        let repository = RecordingRepository {
            received: Mutex::new(None),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec![],
        };

        let result = SaveLearningSupportReply::new(&repository)
            .execute(&principal, Uuid::new_v4(), "A careful response.")
            .await;

        assert!(matches!(result, Ok(None)));
        assert!(
            repository
                .received
                .lock()
                .expect("test mutex is available")
                .is_none()
        );
    }
}
