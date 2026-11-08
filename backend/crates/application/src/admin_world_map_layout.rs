use std::future::Future;

use serde::Serialize;
use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
pub struct HexPosition {
    pub q: i32,
    pub r: i32,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct MapLayoutVersion {
    pub id: Uuid,
    pub node_count: u32,
    pub restorable: bool,
    pub created_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct MapLayoutVersionPage {
    pub items: Vec<MapLayoutVersion>,
    pub page: u32,
    pub per_page: u32,
    pub total: u64,
    pub last_page: u32,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct MapLayoutPreviewItem {
    pub node_id: Uuid,
    pub position: HexPosition,
    pub current_position: Option<HexPosition>,
    pub title: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct MapLayoutPreviewPage {
    pub version_id: Uuid,
    pub created_at: String,
    pub items: Vec<MapLayoutPreviewItem>,
    pub page: u32,
    pub per_page: u32,
    pub total: u64,
    pub last_page: u32,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldMapLayoutError {
    Unavailable,
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
        AdminWorldMapLayoutError, AdminWorldMapLayoutHistoryQuery, AdminWorldMapLayoutRepository,
        HexPosition, MapLayoutPreviewPage, MapLayoutVersionPage,
    };

    struct RecordingRepository(Arc<AtomicBool>);

    impl AdminWorldMapLayoutRepository for RecordingRepository {
        fn update_node_position(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
            _: HexPosition,
        ) -> impl Future<Output = Result<Option<HexPosition>, AdminWorldMapLayoutError>> + Send
        {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
        fn list_versions(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
            _: u32,
            _: u32,
        ) -> impl Future<Output = Result<Option<MapLayoutVersionPage>, AdminWorldMapLayoutError>> + Send
        {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
        fn preview_version(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
            _: Uuid,
            _: u32,
            _: u32,
        ) -> impl Future<Output = Result<Option<MapLayoutPreviewPage>, AdminWorldMapLayoutError>> + Send
        {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
        fn restore_version(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
            _: Uuid,
        ) -> impl Future<Output = Result<Option<()>, AdminWorldMapLayoutError>> + Send {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn history_rejects_missing_write_scope_and_unbounded_pages_before_repository_access() {
        let called = Arc::new(AtomicBool::new(false));
        let repository = RecordingRepository(called.clone());
        let reader = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:r:all".to_owned()],
        };

        let unauthorized = AdminWorldMapLayoutHistoryQuery::new(&repository)
            .list(&reader, Uuid::new_v4(), 1, 6)
            .await
            .expect("authorization check");
        assert!(unauthorized.is_none());
        let author = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:ru:all".to_owned()],
        };
        let invalid = AdminWorldMapLayoutHistoryQuery::new(&repository)
            .preview(&author, Uuid::new_v4(), Uuid::new_v4(), 1, 25)
            .await
            .expect("page bounds check");
        assert!(invalid.is_none());
        assert!(!called.load(Ordering::SeqCst));
    }
}

pub trait AdminWorldMapLayoutRepository {
    fn update_node_position(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        position: HexPosition,
    ) -> impl Future<Output = Result<Option<HexPosition>, AdminWorldMapLayoutError>> + Send;
    fn list_versions(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        page: u32,
        per_page: u32,
    ) -> impl Future<Output = Result<Option<MapLayoutVersionPage>, AdminWorldMapLayoutError>> + Send;
    fn preview_version(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        version_id: Uuid,
        page: u32,
        per_page: u32,
    ) -> impl Future<Output = Result<Option<MapLayoutPreviewPage>, AdminWorldMapLayoutError>> + Send;
    fn restore_version(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        version_id: Uuid,
    ) -> impl Future<Output = Result<Option<()>, AdminWorldMapLayoutError>> + Send;
}

pub struct AdminWorldMapLayoutCommand<'repository, Repository> {
    repository: &'repository Repository,
}
impl<'repository, Repository: AdminWorldMapLayoutRepository>
    AdminWorldMapLayoutCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn update_node_position(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        position: HexPosition,
    ) -> Result<Option<HexPosition>, AdminWorldMapLayoutError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }
        self.repository
            .update_node_position(principal, node_id, position)
            .await
    }
    pub async fn restore(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        version_id: Uuid,
    ) -> Result<Option<()>, AdminWorldMapLayoutError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }
        self.repository
            .restore_version(principal, map_id, version_id)
            .await
    }
}

pub struct AdminWorldMapLayoutHistoryQuery<'repository, Repository> {
    repository: &'repository Repository,
}
impl<'repository, Repository: AdminWorldMapLayoutRepository>
    AdminWorldMapLayoutHistoryQuery<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn list(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        page: u32,
        per_page: u32,
    ) -> Result<Option<MapLayoutVersionPage>, AdminWorldMapLayoutError> {
        if !principal.has_permission("world_maps", "ru")
            || page == 0
            || !(1..=24).contains(&per_page)
        {
            return Ok(None);
        }
        self.repository
            .list_versions(principal, map_id, page, per_page)
            .await
    }
    pub async fn preview(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        version_id: Uuid,
        page: u32,
        per_page: u32,
    ) -> Result<Option<MapLayoutPreviewPage>, AdminWorldMapLayoutError> {
        if !principal.has_permission("world_maps", "ru")
            || page == 0
            || !(1..=24).contains(&per_page)
        {
            return Ok(None);
        }
        self.repository
            .preview_version(principal, map_id, version_id, page, per_page)
            .await
    }
}
