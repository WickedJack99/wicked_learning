use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    world_content::{AdminActivityVersionDetails, AdminActivityVersionPage},
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ActivityHistoryPageRequest {
    pub page: i64,
    pub per_page: i64,
}

impl ActivityHistoryPageRequest {
    pub const DEFAULT_PER_PAGE: i64 = 6;
    pub const MAX_PER_PAGE: i64 = 24;

    pub fn parse(page: Option<i64>, per_page: Option<i64>) -> Option<Self> {
        let page = page.unwrap_or(1);
        let per_page = per_page.unwrap_or(Self::DEFAULT_PER_PAGE);
        (page >= 1 && (1..=Self::MAX_PER_PAGE).contains(&per_page))
            .then_some(Self { page, per_page })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldActivityHistoryError {
    Unavailable,
}

pub trait AdminWorldActivityHistoryRepository {
    fn list_versions(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        page: ActivityHistoryPageRequest,
    ) -> impl Future<
        Output = Result<Option<AdminActivityVersionPage>, AdminWorldActivityHistoryError>,
    > + Send;

    fn version_details(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        version_id: Uuid,
    ) -> impl Future<
        Output = Result<Option<AdminActivityVersionDetails>, AdminWorldActivityHistoryError>,
    > + Send;

    fn restore_version(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        version_id: Uuid,
    ) -> impl Future<Output = Result<bool, AdminWorldActivityHistoryError>> + Send;
}

/// Keeps the source Activity History capability behind the exact same scoped
/// World-activity permission as its editor. Persistence repeats the map-scope
/// decision inside the transaction before it exposes or restores a snapshot.
pub struct AdminWorldActivityHistoryCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldActivityHistoryCommand<'repository, Repository>
where
    Repository: AdminWorldActivityHistoryRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn list(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        page: ActivityHistoryPageRequest,
    ) -> Result<Option<AdminActivityVersionPage>, AdminWorldActivityHistoryError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .list_versions(principal, activity_id, page)
            .await
    }

    pub async fn details(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        version_id: Uuid,
    ) -> Result<Option<AdminActivityVersionDetails>, AdminWorldActivityHistoryError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .version_details(principal, activity_id, version_id)
            .await
    }

    pub async fn restore(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        version_id: Uuid,
    ) -> Result<bool, AdminWorldActivityHistoryError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(false);
        }
        self.repository
            .restore_version(principal, activity_id, version_id)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::ActivityHistoryPageRequest;

    #[test]
    fn bounds_the_source_history_page() {
        assert_eq!(
            ActivityHistoryPageRequest::parse(None, None),
            Some(ActivityHistoryPageRequest {
                page: 1,
                per_page: 6,
            })
        );
        assert!(ActivityHistoryPageRequest::parse(Some(0), None).is_none());
        assert!(ActivityHistoryPageRequest::parse(None, Some(25)).is_none());
    }
}
