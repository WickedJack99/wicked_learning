use std::future::Future;

use serde_json::Value;
use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminWorldMapExportError;

pub struct ExportedWorldMap {
    pub filename: String,
    pub payload: Value,
}

pub trait AdminWorldMapExportRepository {
    fn export_map(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
    ) -> impl Future<Output = Result<Option<ExportedWorldMap>, AdminWorldMapExportError>> + Send;
}

pub struct AdminWorldMapExportQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapExportQuery<'repository, Repository>
where
    Repository: AdminWorldMapExportRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
    ) -> Result<Option<ExportedWorldMap>, AdminWorldMapExportError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }
        self.repository.export_map(principal, map_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        future::Future,
        sync::{
            Arc,
            atomic::{AtomicBool, Ordering},
        },
    };
    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;
    struct Repository {
        called: Arc<AtomicBool>,
    }
    impl AdminWorldMapExportRepository for Repository {
        fn export_map(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
        ) -> impl Future<Output = Result<Option<ExportedWorldMap>, AdminWorldMapExportError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }
    #[tokio::test]
    async fn denies_an_export_without_the_source_map_update_permission() {
        let repository = Repository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:ru:all".into()],
        };
        assert!(
            AdminWorldMapExportQuery::new(&repository)
                .execute(&principal, Uuid::new_v4())
                .await
                .expect("authorization")
                .is_none()
        );
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
