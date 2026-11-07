use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, world_content::AdminEditableNode,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminWorldNodeReadError;

pub trait AdminWorldNodeRepository {
    fn load_editable_node(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
    ) -> impl Future<Output = Result<Option<AdminEditableNode>, AdminWorldNodeReadError>> + Send;
}

pub struct AdminWorldNodeQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldNodeQuery<'repository, Repository>
where
    Repository: AdminWorldNodeRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    /// The source selected-node panel is stricter than the overview: a
    /// principal needs World Activities update authority before its scoped map
    /// and explicit editing-group policy are evaluated by persistence.
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
    ) -> Result<Option<AdminEditableNode>, AdminWorldNodeReadError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository.load_editable_node(principal, node_id).await
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
        identity_access::AuthorizedPrincipal, world_content::AdminEditableNode,
    };

    use super::{AdminWorldNodeQuery, AdminWorldNodeReadError, AdminWorldNodeRepository};

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldNodeRepository for RecordingRepository {
        fn load_editable_node(
            &self,
            _principal: &AuthorizedPrincipal,
            _node_id: Uuid,
        ) -> impl Future<Output = Result<Option<AdminEditableNode>, AdminWorldNodeReadError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn requires_source_world_activity_update_before_loading_a_node() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };

        let result = AdminWorldNodeQuery::new(&repository)
            .execute(&principal, Uuid::new_v4())
            .await
            .expect("authorization check succeeds");

        assert!(result.is_none());
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
