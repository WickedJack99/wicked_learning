use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdateWorldMapDetailsForm {
    pub title: String,
    pub description: String,
    pub topic_id: Option<Uuid>,
    pub map_assets_locked: bool,
}

impl UpdateWorldMapDetailsForm {
    pub fn parse(
        title: &str,
        description: Option<&str>,
        topic_id: Option<Uuid>,
        map_assets_locked: bool,
    ) -> Option<Self> {
        let title = title.trim();
        let description = description.unwrap_or("");
        if title.is_empty() || title.chars().count() > 120 || description.chars().count() > 1_000 {
            return None;
        }

        Some(Self {
            title: title.to_owned(),
            description: description.to_owned(),
            topic_id,
            map_assets_locked,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldMapDetailsError {
    InvalidTopic,
    Conflict,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatedWorldMapDetails {
    pub map_id: Uuid,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MapDetailsVersion {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub topic_id: Option<Uuid>,
    pub map_assets_locked: bool,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MapDetailsVersionPage {
    pub items: Vec<MapDetailsVersion>,
    pub page: u32,
    pub per_page: u32,
    pub total: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RestoredWorldMapDetails {
    pub map_id: Uuid,
    pub title: String,
    pub description: String,
    pub topic_id: Option<Uuid>,
    pub map_assets_locked: bool,
    pub updated_at: String,
}

pub trait AdminWorldMapDetailsRepository {
    fn update_map_details(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &UpdateWorldMapDetailsForm,
        expected_updated_at: &str,
    ) -> impl Future<Output = Result<Option<UpdatedWorldMapDetails>, AdminWorldMapDetailsError>> + Send;

    fn list_map_versions(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        page: u32,
        per_page: u32,
    ) -> impl Future<Output = Result<Option<MapDetailsVersionPage>, AdminWorldMapDetailsError>> + Send;

    fn restore_map_version(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        version_id: Uuid,
    ) -> impl Future<Output = Result<Option<RestoredWorldMapDetails>, AdminWorldMapDetailsError>> + Send;
}

pub struct AdminWorldMapDetailsHistoryQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapDetailsHistoryQuery<'repository, Repository>
where
    Repository: AdminWorldMapDetailsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        page: u32,
        per_page: u32,
    ) -> Result<Option<MapDetailsVersionPage>, AdminWorldMapDetailsError> {
        if !principal.has_permission("world_maps", "ru")
            || page == 0
            || !(1..=24).contains(&per_page)
        {
            return Ok(None);
        }
        self.repository
            .list_map_versions(principal, map_id, page, per_page)
            .await
    }
}

pub struct RestoreWorldMapDetailsVersionCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> RestoreWorldMapDetailsVersionCommand<'repository, Repository>
where
    Repository: AdminWorldMapDetailsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        version_id: Uuid,
    ) -> Result<Option<RestoredWorldMapDetails>, AdminWorldMapDetailsError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }
        self.repository
            .restore_map_version(principal, map_id, version_id)
            .await
    }
}

/// Updates the source Map Details form with its scoped editor access and
/// optimistic-concurrency boundary. Visual configuration and access control
/// retain their distinct source mutations.
pub struct AdminWorldMapDetailsCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapDetailsCommand<'repository, Repository>
where
    Repository: AdminWorldMapDetailsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &UpdateWorldMapDetailsForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedWorldMapDetails>, AdminWorldMapDetailsError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }

        self.repository
            .update_map_details(principal, map_id, form, expected_updated_at)
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

    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{
        AdminWorldMapDetailsCommand, AdminWorldMapDetailsError, AdminWorldMapDetailsHistoryQuery,
        AdminWorldMapDetailsRepository, MapDetailsVersionPage,
        RestoreWorldMapDetailsVersionCommand, RestoredWorldMapDetails, UpdateWorldMapDetailsForm,
        UpdatedWorldMapDetails,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldMapDetailsRepository for RecordingRepository {
        fn update_map_details(
            &self,
            _principal: &AuthorizedPrincipal,
            _map_id: Uuid,
            _form: &UpdateWorldMapDetailsForm,
            _expected_updated_at: &str,
        ) -> impl Future<Output = Result<Option<UpdatedWorldMapDetails>, AdminWorldMapDetailsError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn list_map_versions(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
            _: u32,
            _: u32,
        ) -> impl Future<Output = Result<Option<MapDetailsVersionPage>, AdminWorldMapDetailsError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn restore_map_version(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
            _: Uuid,
        ) -> impl Future<
            Output = Result<Option<RestoredWorldMapDetails>, AdminWorldMapDetailsError>,
        > + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[test]
    fn preserves_source_map_detail_bounds_and_nullable_description() {
        assert!(UpdateWorldMapDetailsForm::parse(" A map ", None, None, true).is_some());
        assert!(UpdateWorldMapDetailsForm::parse("", None, None, false).is_none());
        assert!(
            UpdateWorldMapDetailsForm::parse("Map", Some(&"x".repeat(1_001)), None, false)
                .is_none()
        );
    }

    #[tokio::test]
    async fn requires_source_world_map_update_permission_before_updating() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:r:all".to_owned()],
        };
        let form = UpdateWorldMapDetailsForm::parse("A map", None, None, false)
            .expect("a bounded source form is valid");

        let updated = AdminWorldMapDetailsCommand::new(&repository)
            .execute(
                &principal,
                Uuid::new_v4(),
                &form,
                "2026-11-07T17:00:00.000000Z",
            )
            .await
            .expect("authorization check succeeds");

        assert_eq!(updated, None);
        assert!(!repository.called.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn history_and_restore_require_the_same_scoped_map_update_permission() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:r:all".to_owned()],
        };
        let map_id = Uuid::new_v4();

        let history = AdminWorldMapDetailsHistoryQuery::new(&repository)
            .execute(&principal, map_id, 1, 4)
            .await
            .expect("authorization check");
        let restored = RestoreWorldMapDetailsVersionCommand::new(&repository)
            .execute(&principal, map_id, Uuid::new_v4())
            .await
            .expect("authorization check");

        assert!(history.is_none());
        assert!(restored.is_none());
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
