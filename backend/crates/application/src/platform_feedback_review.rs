use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::{ApplicationCapability, AuthorizedPrincipal};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlatformFeedbackReviewIdentity {
    pub email: Option<String>,
    pub name: Option<String>,
    pub subject_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlatformFeedbackReviewItem {
    pub category: String,
    pub id: String,
    pub message: String,
    pub reviewed_at: Option<String>,
    pub submitted_at: String,
    pub user: PlatformFeedbackReviewIdentity,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlatformFeedbackReviewPagination {
    pub current_page: i64,
    pub last_page: i64,
    pub per_page: i64,
    pub total: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlatformFeedbackReviewPage {
    pub items: Vec<PlatformFeedbackReviewItem>,
    pub pagination: PlatformFeedbackReviewPagination,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PlatformFeedbackReviewError;

pub trait PlatformFeedbackReviewRepository {
    fn list(
        &self,
        page: i64,
    ) -> impl Future<Output = Result<PlatformFeedbackReviewPage, PlatformFeedbackReviewError>> + Send;

    fn mark_reviewed(
        &self,
        feedback_id: Uuid,
    ) -> impl Future<Output = Result<bool, PlatformFeedbackReviewError>> + Send;
}

pub struct PlatformFeedbackReviewQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: PlatformFeedbackReviewRepository>
    PlatformFeedbackReviewQuery<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        page: i64,
    ) -> Result<Option<PlatformFeedbackReviewPage>, PlatformFeedbackReviewError> {
        if !principal.has_capability(ApplicationCapability::ViewPlatformFeedback)
            || !(1..=10_000).contains(&page)
        {
            return Ok(None);
        }

        self.repository.list(page).await.map(Some)
    }
}

pub struct MarkPlatformFeedbackReviewed<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: PlatformFeedbackReviewRepository>
    MarkPlatformFeedbackReviewed<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        feedback_id: Uuid,
    ) -> Result<Option<()>, PlatformFeedbackReviewError> {
        if !principal.has_capability(ApplicationCapability::ReviewPlatformFeedback) {
            return Ok(None);
        }

        self.repository
            .mark_reviewed(feedback_id)
            .await
            .map(|updated| updated.then_some(()))
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{
        MarkPlatformFeedbackReviewed, PlatformFeedbackReviewError, PlatformFeedbackReviewPage,
        PlatformFeedbackReviewQuery, PlatformFeedbackReviewRepository,
    };

    struct Repository;

    impl PlatformFeedbackReviewRepository for Repository {
        fn list(
            &self,
            _: i64,
        ) -> impl std::future::Future<
            Output = Result<PlatformFeedbackReviewPage, PlatformFeedbackReviewError>,
        > + Send {
            async { panic!("unauthorized queries must not reach the repository") }
        }

        fn mark_reviewed(
            &self,
            _: Uuid,
        ) -> impl std::future::Future<Output = Result<bool, PlatformFeedbackReviewError>> + Send
        {
            async { panic!("unauthorized updates must not reach the repository") }
        }
    }

    #[tokio::test]
    async fn separate_capabilities_guard_feedback_read_and_review() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec![],
        };
        let repository = Repository;

        assert!(
            PlatformFeedbackReviewQuery::new(&repository)
                .execute(&principal, 1)
                .await
                .unwrap()
                .is_none()
        );
        assert!(
            MarkPlatformFeedbackReviewed::new(&repository)
                .execute(&principal, Uuid::new_v4())
                .await
                .unwrap()
                .is_none()
        );
    }
}
