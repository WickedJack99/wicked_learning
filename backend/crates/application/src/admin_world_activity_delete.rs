use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminWorldActivityDeleteError;

pub trait AdminWorldActivityDeleteRepository {
    fn delete_activity(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
    ) -> impl Future<Output = Result<bool, AdminWorldActivityDeleteError>> + Send;
}

/// Deletes one source-scoped authored activity. The repository owns the
/// transactional start-route and preferred-start cleanup that precedes the
/// database's dependent-record cascades.
pub struct AdminWorldActivityDeleteCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldActivityDeleteCommand<'repository, Repository>
where
    Repository: AdminWorldActivityDeleteRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
    ) -> Result<bool, AdminWorldActivityDeleteError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(false);
        }
        self.repository
            .delete_activity(principal, activity_id)
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
        AdminWorldActivityDeleteCommand, AdminWorldActivityDeleteError,
        AdminWorldActivityDeleteRepository,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldActivityDeleteRepository for RecordingRepository {
        fn delete_activity(
            &self,
            _principal: &AuthorizedPrincipal,
            _activity_id: Uuid,
        ) -> impl Future<Output = Result<bool, AdminWorldActivityDeleteError>> + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(false) }
        }
    }

    #[tokio::test]
    async fn requires_source_world_activity_update_before_deleting() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };

        let result = AdminWorldActivityDeleteCommand::new(&repository)
            .execute(&principal, Uuid::new_v4())
            .await
            .expect("authorization check succeeds");

        assert!(!result);
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
