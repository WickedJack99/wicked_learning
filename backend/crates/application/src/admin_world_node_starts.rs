use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, world_content::AdminActivityStartRoute,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldNodeStartsError {
    InvalidActivity,
    Unavailable,
}

#[derive(Clone, Debug)]
pub struct AdminWorldNodeStarts {
    pub start_activity_id: Option<Uuid>,
    pub start_routes: Vec<AdminActivityStartRoute>,
}

/// Persists the source activity editor's route-start membership. A route start
/// is an authoring choice at the node boundary, not an activity position or a
/// learner-progress mutation.
pub trait AdminWorldNodeStartsRepository {
    fn add_start(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Uuid,
    ) -> impl Future<Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>> + Send;

    fn remove_starts(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Option<Uuid>,
    ) -> impl Future<Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>> + Send;
}

pub struct AdminWorldNodeStartsCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldNodeStartsCommand<'repository, Repository>
where
    Repository: AdminWorldNodeStartsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn add_start(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Uuid,
    ) -> Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository
            .add_start(principal, node_id, activity_id)
            .await
    }

    pub async fn remove_starts(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        activity_id: Option<Uuid>,
    ) -> Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository
            .remove_starts(principal, node_id, activity_id)
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
        AdminWorldNodeStarts, AdminWorldNodeStartsCommand, AdminWorldNodeStartsError,
        AdminWorldNodeStartsRepository,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldNodeStartsRepository for RecordingRepository {
        fn add_start(
            &self,
            _principal: &AuthorizedPrincipal,
            _node_id: Uuid,
            _activity_id: Uuid,
        ) -> impl Future<Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn remove_starts(
            &self,
            _principal: &AuthorizedPrincipal,
            _node_id: Uuid,
            _activity_id: Option<Uuid>,
        ) -> impl Future<Output = Result<Option<AdminWorldNodeStarts>, AdminWorldNodeStartsError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn requires_activity_update_before_changing_start_routes() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };

        let result = AdminWorldNodeStartsCommand::new(&repository)
            .add_start(&principal, Uuid::new_v4(), Uuid::new_v4())
            .await
            .expect("authorization check succeeds");

        assert!(result.is_none());
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
