use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdateWorldDetailsForm {
    pub title: String,
    pub description: String,
}

impl UpdateWorldDetailsForm {
    pub fn parse(title: &str, description: Option<&str>) -> Option<Self> {
        let title = title.trim();
        let description = description.unwrap_or("");
        if title.is_empty() || title.chars().count() > 255 {
            return None;
        }
        Some(Self {
            title: title.to_owned(),
            description: description.to_owned(),
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldDetailsError {
    Conflict,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatedWorldDetails {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorldDetailsVersion {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WorldDetailsVersionPage {
    pub items: Vec<WorldDetailsVersion>,
    pub page: u32,
    pub per_page: u32,
    pub total: u64,
}

pub trait AdminWorldDetailsRepository {
    fn update_world_details(
        &self,
        principal: &AuthorizedPrincipal,
        form: &UpdateWorldDetailsForm,
        expected_updated_at: &str,
    ) -> impl Future<Output = Result<Option<UpdatedWorldDetails>, AdminWorldDetailsError>> + Send;

    fn list_world_versions(
        &self,
        principal: &AuthorizedPrincipal,
        page: u32,
        per_page: u32,
    ) -> impl Future<Output = Result<Option<WorldDetailsVersionPage>, AdminWorldDetailsError>> + Send;

    fn restore_world_version(
        &self,
        principal: &AuthorizedPrincipal,
        version_id: Uuid,
    ) -> impl Future<Output = Result<Option<UpdatedWorldDetails>, AdminWorldDetailsError>> + Send;
}

pub struct AdminWorldDetailsHistoryQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldDetailsHistoryQuery<'repository, Repository>
where
    Repository: AdminWorldDetailsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        page: u32,
        per_page: u32,
    ) -> Result<Option<WorldDetailsVersionPage>, AdminWorldDetailsError> {
        if !principal.has_permission("world_map_access", "ru")
            || page == 0
            || !(1..=24).contains(&per_page)
        {
            return Ok(None);
        }
        self.repository
            .list_world_versions(principal, page, per_page)
            .await
    }
}

pub struct RestoreWorldDetailsVersionCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> RestoreWorldDetailsVersionCommand<'repository, Repository>
where
    Repository: AdminWorldDetailsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        version_id: Uuid,
    ) -> Result<Option<UpdatedWorldDetails>, AdminWorldDetailsError> {
        if !principal.has_permission("world_map_access", "ru") {
            return Ok(None);
        }
        self.repository
            .restore_world_version(principal, version_id)
            .await
    }
}

/// Updates the current source World title/description after the distinct global
/// map-access capability is checked. Map detail/visual and portal mutations
/// remain separate contracts.
pub struct AdminWorldDetailsCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldDetailsCommand<'repository, Repository>
where
    Repository: AdminWorldDetailsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        form: &UpdateWorldDetailsForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedWorldDetails>, AdminWorldDetailsError> {
        if !principal.has_permission("world_map_access", "ru") {
            return Ok(None);
        }
        self.repository
            .update_world_details(principal, form, expected_updated_at)
            .await
    }
}

#[cfg(test)]
mod tests {
    use std::{
        future::Future,
        sync::{
            Arc,
            atomic::{AtomicBool, Ordering},
        },
    };

    use super::*;

    struct Repository(Arc<AtomicBool>);

    impl AdminWorldDetailsRepository for Repository {
        fn update_world_details(
            &self,
            _: &AuthorizedPrincipal,
            _: &UpdateWorldDetailsForm,
            _: &str,
        ) -> impl Future<Output = Result<Option<UpdatedWorldDetails>, AdminWorldDetailsError>> + Send
        {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn list_world_versions(
            &self,
            _: &AuthorizedPrincipal,
            _: u32,
            _: u32,
        ) -> impl Future<Output = Result<Option<WorldDetailsVersionPage>, AdminWorldDetailsError>> + Send
        {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn restore_world_version(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
        ) -> impl Future<Output = Result<Option<UpdatedWorldDetails>, AdminWorldDetailsError>> + Send
        {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[test]
    fn retains_source_world_title_and_description_bounds() {
        assert!(UpdateWorldDetailsForm::parse(" Orientation Garden ", None).is_some());
        assert!(UpdateWorldDetailsForm::parse("", None).is_none());
        assert!(UpdateWorldDetailsForm::parse("World", Some(&"x".repeat(10_001))).is_some());
    }

    #[tokio::test]
    async fn requires_the_distinct_global_world_access_update_permission() {
        let called = Arc::new(AtomicBool::new(false));
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:ru:all".to_owned()],
        };
        let form = UpdateWorldDetailsForm::parse("World", None).expect("valid form");

        let updated = AdminWorldDetailsCommand::new(&Repository(called.clone()))
            .execute(&principal, &form, "2026-11-08T12:00:00.000000Z")
            .await
            .expect("authorization check");

        assert!(updated.is_none());
        assert!(!called.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn requires_global_world_access_before_reading_or_restoring_history() {
        let called = Arc::new(AtomicBool::new(false));
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:ru:all".to_owned()],
        };
        let repository = Repository(called.clone());

        let versions = AdminWorldDetailsHistoryQuery::new(&repository)
            .execute(&principal, 1, 6)
            .await
            .expect("authorization check");
        let restored = RestoreWorldDetailsVersionCommand::new(&repository)
            .execute(&principal, Uuid::new_v4())
            .await
            .expect("authorization check");

        assert!(versions.is_none());
        assert!(restored.is_none());
        assert!(!called.load(Ordering::SeqCst));
    }
}
