use std::future::Future;

use serde_json::Value;
use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminWorldMapAssetExportError;

pub struct ExportedWorldMapAsset {
    pub filename: String,
    pub payload: Value,
}

pub trait AdminWorldMapAssetExportRepository {
    fn export_map_asset(
        &self,
        principal: &AuthorizedPrincipal,
        asset_id: Uuid,
    ) -> impl Future<Output = Result<Option<ExportedWorldMapAsset>, AdminWorldMapAssetExportError>> + Send;
}

pub struct AdminWorldMapAssetExportQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapAssetExportQuery<'repository, Repository>
where
    Repository: AdminWorldMapAssetExportRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        asset_id: Uuid,
    ) -> Result<Option<ExportedWorldMapAsset>, AdminWorldMapAssetExportError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }
        self.repository.export_map_asset(principal, asset_id).await
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

    impl AdminWorldMapAssetExportRepository for Repository {
        fn export_map_asset(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
        ) -> impl Future<
            Output = Result<Option<ExportedWorldMapAsset>, AdminWorldMapAssetExportError>,
        > + Send {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn denies_asset_export_without_map_update_permission() {
        let called = Arc::new(AtomicBool::new(false));
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:ru:all".to_owned()],
        };

        let exported = AdminWorldMapAssetExportQuery::new(&Repository(called.clone()))
            .execute(&principal, Uuid::new_v4())
            .await
            .expect("authorization");

        assert!(exported.is_none());
        assert!(!called.load(Ordering::SeqCst));
    }
}
