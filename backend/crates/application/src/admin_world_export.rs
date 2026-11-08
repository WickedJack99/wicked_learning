use std::future::Future;

use serde_json::Value;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminWorldExportError;

pub struct ExportedWorld {
    pub filename: String,
    pub payload: Value,
}

pub trait AdminWorldExportRepository {
    fn export_world(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl Future<Output = Result<Option<ExportedWorld>, AdminWorldExportError>> + Send;
}

pub struct AdminWorldExportQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldExportQuery<'repository, Repository>
where
    Repository: AdminWorldExportRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    /// The source endpoint is readable by an authenticated author and lets the
    /// scoped map query decide which maps are transferable. A principal with
    /// no editable map receives the current World envelope with no maps.
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<ExportedWorld>, AdminWorldExportError> {
        self.repository.export_world(principal).await
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

    struct Repository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldExportRepository for Repository {
        fn export_world(
            &self,
            _: &AuthorizedPrincipal,
        ) -> impl Future<Output = Result<Option<ExportedWorld>, AdminWorldExportError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn delegates_scoped_map_selection_to_the_repository() {
        let repository = Repository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec![],
        };

        assert!(
            AdminWorldExportQuery::new(&repository)
                .execute(&principal)
                .await
                .expect("world export")
                .is_none()
        );
        assert!(repository.called.load(Ordering::SeqCst));
    }
}
