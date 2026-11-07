use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, world_content::AdminEditableMap,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminWorldMapReadError;

pub trait AdminWorldMapRepository {
    fn load_editable_map(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
    ) -> impl Future<Output = Result<Option<AdminEditableMap>, AdminWorldMapReadError>> + Send;
}

pub struct AdminWorldMapQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapQuery<'repository, Repository>
where
    Repository: AdminWorldMapRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    /// The source's selected-map panel requires `world_maps` update authority,
    /// even where the overview remains visible through node/activity reads.
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
    ) -> Result<Option<AdminEditableMap>, AdminWorldMapReadError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }

        self.repository.load_editable_map(principal, map_id).await
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
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal, world_content::AdminEditableMap,
    };

    use super::{AdminWorldMapQuery, AdminWorldMapReadError, AdminWorldMapRepository};

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldMapRepository for RecordingRepository {
        fn load_editable_map(
            &self,
            _principal: &AuthorizedPrincipal,
            _map_id: Uuid,
        ) -> impl Future<Output = Result<Option<AdminEditableMap>, AdminWorldMapReadError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn requires_source_world_map_update_permission_before_loading_a_map() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };

        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let result = AdminWorldMapQuery::new(&repository)
            .execute(&principal, Uuid::new_v4())
            .await
            .expect("authorization check succeeds");

        assert!(result.is_none());
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
