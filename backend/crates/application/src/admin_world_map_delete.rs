use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminWorldMapDeleteError;

pub trait AdminWorldMapDeleteRepository {
    fn delete_map(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
    ) -> impl Future<Output = Result<bool, AdminWorldMapDeleteError>> + Send;
}

/// Deletes one World Builder map after the persistence adapter has applied the
/// source map-delete scope and its database-owned dependent-record cascades.
pub struct AdminWorldMapDeleteCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapDeleteCommand<'repository, Repository>
where
    Repository: AdminWorldMapDeleteRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
    ) -> Result<bool, AdminWorldMapDeleteError> {
        if !principal.has_permission("world_maps", "rud") {
            return Ok(false);
        }

        self.repository.delete_map(principal, map_id).await
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
        AdminWorldMapDeleteCommand, AdminWorldMapDeleteError, AdminWorldMapDeleteRepository,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldMapDeleteRepository for RecordingRepository {
        fn delete_map(
            &self,
            _principal: &AuthorizedPrincipal,
            _map_id: Uuid,
        ) -> impl Future<Output = Result<bool, AdminWorldMapDeleteError>> + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(false) }
        }
    }

    #[tokio::test]
    async fn requires_source_world_map_delete_permission_before_deleting() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:ru:all".to_owned()],
        };

        let deleted = AdminWorldMapDeleteCommand::new(&repository)
            .execute(&principal, Uuid::new_v4())
            .await
            .expect("authorization check succeeds");

        assert!(!deleted);
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
