use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::{ApplicationCapability, AuthorizedPrincipal},
    learner_state::{
        LearningSupportModerationPage, LearningSupportModerationReply,
        LearningSupportModerationResponsesPage, LearningSupportReplySaveResult,
        LearningSupportRequestPage, LearningSupportTopic,
    },
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearningSupportModerationError;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LearningSupportMessageFilter {
    All,
    Helpful,
    Unconfirmed,
}

impl LearningSupportMessageFilter {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "all" => Some(Self::All),
            "helpful" => Some(Self::Helpful),
            "unconfirmed" => Some(Self::Unconfirmed),
            _ => None,
        }
    }
}

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

    fn list_messages(
        &self,
        topic_id: Uuid,
        page: i64,
        per_page: i64,
        filter: LearningSupportMessageFilter,
    ) -> impl Future<
        Output = Result<Option<LearningSupportModerationPage>, LearningSupportModerationError>,
    > + Send;

    fn list_message_responses(
        &self,
        message_id: Uuid,
        page: i64,
        per_page: i64,
    ) -> impl Future<
        Output = Result<
            Option<LearningSupportModerationResponsesPage>,
            LearningSupportModerationError,
        >,
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

    fn set_message_visibility(
        &self,
        principal: &AuthorizedPrincipal,
        message_id: Uuid,
        hidden: bool,
    ) -> impl Future<Output = Result<bool, LearningSupportModerationError>> + Send;

    fn set_reply_visibility(
        &self,
        principal: &AuthorizedPrincipal,
        reply_id: Uuid,
        hidden: bool,
    ) -> impl Future<Output = Result<bool, LearningSupportModerationError>> + Send;

    fn delete_message(
        &self,
        message_id: Uuid,
    ) -> impl Future<Output = Result<bool, LearningSupportModerationError>> + Send;

    fn delete_reply(
        &self,
        reply_id: Uuid,
    ) -> impl Future<Output = Result<bool, LearningSupportModerationError>> + Send;
}

pub struct LearningSupportTopicsQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct LearningSupportRequestsQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct LearningSupportMessagesQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct LearningSupportMessageResponsesQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct SaveLearningSupportReply<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct SetLearningSupportVisibility<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct DeleteLearningSupportContent<'repository, Repository> {
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

impl<'repository, Repository> LearningSupportMessagesQuery<'repository, Repository>
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
        per_page: i64,
        filter: LearningSupportMessageFilter,
    ) -> Result<Option<LearningSupportModerationPage>, LearningSupportModerationError> {
        if !principal.has_capability(ApplicationCapability::ModerateLearnerMessages)
            || !(1..=10_000).contains(&page)
            || !(1..=12).contains(&per_page)
        {
            return Ok(None);
        }

        self.repository
            .list_messages(topic_id, page, per_page, filter)
            .await
    }
}

impl<'repository, Repository> LearningSupportMessageResponsesQuery<'repository, Repository>
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
        page: i64,
        per_page: i64,
    ) -> Result<Option<LearningSupportModerationResponsesPage>, LearningSupportModerationError>
    {
        if !principal.has_capability(ApplicationCapability::ModerateLearnerMessages)
            || !(1..=10_000).contains(&page)
            || !(1..=12).contains(&per_page)
        {
            return Ok(None);
        }

        self.repository
            .list_message_responses(message_id, page, per_page)
            .await
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

impl<'repository, Repository> SetLearningSupportVisibility<'repository, Repository>
where
    Repository: LearningSupportModerationRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn message(
        &self,
        principal: &AuthorizedPrincipal,
        message_id: Uuid,
        hidden: bool,
    ) -> Result<bool, LearningSupportModerationError> {
        if !principal.has_capability(ApplicationCapability::ModerateLearnerMessages) {
            return Ok(false);
        }
        self.repository
            .set_message_visibility(principal, message_id, hidden)
            .await
    }

    pub async fn reply(
        &self,
        principal: &AuthorizedPrincipal,
        reply_id: Uuid,
        hidden: bool,
    ) -> Result<bool, LearningSupportModerationError> {
        if !principal.has_capability(ApplicationCapability::ModerateLearnerMessages) {
            return Ok(false);
        }
        self.repository
            .set_reply_visibility(principal, reply_id, hidden)
            .await
    }
}

impl<'repository, Repository> DeleteLearningSupportContent<'repository, Repository>
where
    Repository: LearningSupportModerationRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn message(
        &self,
        principal: &AuthorizedPrincipal,
        message_id: Uuid,
    ) -> Result<bool, LearningSupportModerationError> {
        if !principal.has_capability(ApplicationCapability::ModerateLearnerMessages) {
            return Ok(false);
        }

        self.repository.delete_message(message_id).await
    }

    pub async fn reply(
        &self,
        principal: &AuthorizedPrincipal,
        reply_id: Uuid,
    ) -> Result<bool, LearningSupportModerationError> {
        if !principal.has_capability(ApplicationCapability::ModerateLearnerMessages) {
            return Ok(false);
        }

        self.repository.delete_reply(reply_id).await
    }
}

#[cfg(test)]
mod tests {
    use std::{future::Future, sync::Mutex};

    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal,
        learner_state::{
            LearningSupportModerationPage, LearningSupportModerationReply,
            LearningSupportModerationResponsesPage, LearningSupportRequestPage,
            LearningSupportTopic,
        },
    };

    use super::{
        DeleteLearningSupportContent, LearningSupportMessageFilter, LearningSupportModerationError,
        LearningSupportModerationRepository, SaveLearningSupportReply,
        SetLearningSupportVisibility,
    };

    #[derive(Default)]
    struct RecordingRepository {
        deletions: Mutex<Vec<(bool, Uuid)>>,
        received: Mutex<Option<(Uuid, String)>>,
        visibility_updates: Mutex<Vec<(bool, Uuid, bool)>>,
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

        fn list_messages(
            &self,
            _topic_id: Uuid,
            _page: i64,
            _per_page: i64,
            _filter: super::LearningSupportMessageFilter,
        ) -> impl Future<
            Output = Result<Option<LearningSupportModerationPage>, LearningSupportModerationError>,
        > + Send {
            async { Ok(None) }
        }

        fn list_message_responses(
            &self,
            _message_id: Uuid,
            _page: i64,
            _per_page: i64,
        ) -> impl Future<
            Output = Result<
                Option<LearningSupportModerationResponsesPage>,
                LearningSupportModerationError,
            >,
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

        fn set_message_visibility(
            &self,
            _principal: &AuthorizedPrincipal,
            message_id: Uuid,
            hidden: bool,
        ) -> impl Future<Output = Result<bool, LearningSupportModerationError>> + Send {
            self.visibility_updates
                .lock()
                .expect("test mutex is available")
                .push((true, message_id, hidden));
            async { Ok(false) }
        }
        fn set_reply_visibility(
            &self,
            _principal: &AuthorizedPrincipal,
            reply_id: Uuid,
            hidden: bool,
        ) -> impl Future<Output = Result<bool, LearningSupportModerationError>> + Send {
            self.visibility_updates
                .lock()
                .expect("test mutex is available")
                .push((false, reply_id, hidden));
            async { Ok(false) }
        }

        fn delete_message(
            &self,
            message_id: Uuid,
        ) -> impl Future<Output = Result<bool, LearningSupportModerationError>> + Send {
            self.deletions
                .lock()
                .expect("test mutex is available")
                .push((true, message_id));
            async { Ok(false) }
        }

        fn delete_reply(
            &self,
            reply_id: Uuid,
        ) -> impl Future<Output = Result<bool, LearningSupportModerationError>> + Send {
            self.deletions
                .lock()
                .expect("test mutex is available")
                .push((false, reply_id));
            async { Ok(false) }
        }
    }

    fn moderator() -> AuthorizedPrincipal {
        AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learning_support".to_owned()],
            capabilities: vec!["learner_messages_moderate".to_owned()],
        }
    }

    #[test]
    fn accepts_only_source_defined_moderation_filters() {
        assert_eq!(
            LearningSupportMessageFilter::parse("all"),
            Some(LearningSupportMessageFilter::All),
        );
        assert_eq!(
            LearningSupportMessageFilter::parse("helpful"),
            Some(LearningSupportMessageFilter::Helpful),
        );
        assert_eq!(
            LearningSupportMessageFilter::parse("unconfirmed"),
            Some(LearningSupportMessageFilter::Unconfirmed),
        );
        assert_eq!(LearningSupportMessageFilter::parse("peer"), None);
    }

    #[tokio::test]
    async fn trims_a_reply_before_the_capability_scoped_repository_receives_it() {
        let repository = RecordingRepository {
            deletions: Mutex::new(Vec::new()),
            received: Mutex::new(None),
            visibility_updates: Mutex::new(Vec::new()),
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
            deletions: Mutex::new(Vec::new()),
            received: Mutex::new(None),
            visibility_updates: Mutex::new(Vec::new()),
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

    #[tokio::test]
    async fn visibility_changes_do_not_reach_the_repository_without_the_explicit_capability() {
        let repository = RecordingRepository::default();
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec![],
        };

        let result = SetLearningSupportVisibility::new(&repository)
            .message(&principal, Uuid::new_v4(), true)
            .await;

        assert_eq!(result, Ok(false));
        assert!(
            repository
                .visibility_updates
                .lock()
                .expect("test mutex is available")
                .is_empty()
        );
    }

    #[tokio::test]
    async fn visibility_changes_keep_the_resource_kind_and_requested_state() {
        let repository = RecordingRepository::default();
        let message_id = Uuid::new_v4();
        let reply_id = Uuid::new_v4();

        assert_eq!(
            SetLearningSupportVisibility::new(&repository)
                .message(&moderator(), message_id, true)
                .await,
            Ok(false)
        );
        assert_eq!(
            SetLearningSupportVisibility::new(&repository)
                .reply(&moderator(), reply_id, false)
                .await,
            Ok(false)
        );
        assert_eq!(
            *repository
                .visibility_updates
                .lock()
                .expect("test mutex is available"),
            vec![(true, message_id, true), (false, reply_id, false)]
        );
    }

    #[tokio::test]
    async fn deletion_does_not_reach_the_repository_without_the_explicit_capability() {
        let repository = RecordingRepository::default();
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec![],
        };

        assert_eq!(
            DeleteLearningSupportContent::new(&repository)
                .message(&principal, Uuid::new_v4())
                .await,
            Ok(false)
        );
        assert!(
            repository
                .deletions
                .lock()
                .expect("test mutex is available")
                .is_empty()
        );
    }
}
