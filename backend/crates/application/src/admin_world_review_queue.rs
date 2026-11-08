use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, world_content::AdminWorldReviewQueuePage,
};

/// The source queue defaults to four cards and never accepts an unbounded
/// request from the browser.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminWorldReviewQueuePageRequest {
    pub page: i64,
    pub per_page: i64,
}

impl AdminWorldReviewQueuePageRequest {
    pub fn parse(page: Option<i64>, per_page: Option<i64>) -> Option<Self> {
        let page = page.unwrap_or(1);
        let per_page = per_page.unwrap_or(4);
        if !(1..=10_000).contains(&page) || !(1..=12).contains(&per_page) {
            return None;
        }

        Some(Self { page, per_page })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminWorldReviewQueueError;

pub trait AdminWorldReviewQueueRepository {
    fn load_review_queue(
        &self,
        principal: &AuthorizedPrincipal,
        page: AdminWorldReviewQueuePageRequest,
    ) -> impl Future<Output = Result<Option<AdminWorldReviewQueuePage>, AdminWorldReviewQueueError>> + Send;
}

pub struct AdminWorldReviewQueueQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldReviewQueueQuery<'repository, Repository>
where
    Repository: AdminWorldReviewQueueRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    /// Review actions ultimately require activity edit authority. Do not let a
    /// broad World Builder overview read expose another author's pending work.
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        page: AdminWorldReviewQueuePageRequest,
    ) -> Result<Option<AdminWorldReviewQueuePage>, AdminWorldReviewQueueError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository.load_review_queue(principal, page).await
    }
}

#[cfg(test)]
mod tests {
    use std::{
        future::Future,
        sync::atomic::{AtomicBool, Ordering},
    };

    use uuid::Uuid;
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal, world_content::AdminWorldReviewQueuePage,
    };

    use super::{
        AdminWorldReviewQueueError, AdminWorldReviewQueuePageRequest, AdminWorldReviewQueueQuery,
        AdminWorldReviewQueueRepository,
    };

    struct Repository(AtomicBool);

    impl AdminWorldReviewQueueRepository for Repository {
        fn load_review_queue(
            &self,
            _: &AuthorizedPrincipal,
            _: AdminWorldReviewQueuePageRequest,
        ) -> impl Future<
            Output = Result<Option<AdminWorldReviewQueuePage>, AdminWorldReviewQueueError>,
        > + Send {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[test]
    fn preserves_the_source_page_bounds() {
        assert_eq!(
            AdminWorldReviewQueuePageRequest::parse(None, None),
            Some(AdminWorldReviewQueuePageRequest {
                page: 1,
                per_page: 4
            })
        );
        assert!(AdminWorldReviewQueuePageRequest::parse(Some(0), None).is_none());
        assert!(AdminWorldReviewQueuePageRequest::parse(None, Some(13)).is_none());
    }

    #[tokio::test]
    async fn rejects_a_queue_read_before_persistence_without_activity_edit_authority() {
        let repository = Repository(AtomicBool::new(false));
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:ro:all".to_owned()],
        };
        let result = AdminWorldReviewQueueQuery::new(&repository)
            .execute(
                &principal,
                AdminWorldReviewQueuePageRequest::parse(None, None).unwrap(),
            )
            .await
            .unwrap();

        assert!(result.is_none());
        assert!(!repository.0.load(Ordering::SeqCst));
    }
}
