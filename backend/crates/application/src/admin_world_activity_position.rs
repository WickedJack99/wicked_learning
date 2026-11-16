use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, world_content::AdminActivityGraphPosition,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ActivityGraphPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminWorldActivityPositionError;

pub trait AdminWorldActivityPositionRepository {
    fn update_position(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        position: ActivityGraphPosition,
    ) -> impl Future<
        Output = Result<Option<AdminActivityGraphPosition>, AdminWorldActivityPositionError>,
    > + Send;
}

/// Owns the ordinary activity-node drag operation from the source graph. It is
/// deliberately separate from activity content editing and special start/end
/// layout, neither of which is implied by moving a graph card.
pub struct AdminWorldActivityPositionCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldActivityPositionCommand<'repository, Repository>
where
    Repository: AdminWorldActivityPositionRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        position: ActivityGraphPosition,
    ) -> Result<Option<AdminActivityGraphPosition>, AdminWorldActivityPositionError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }

        self.repository
            .update_position(principal, activity_id, position)
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
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal, world_content::AdminActivityGraphPosition,
    };

    use super::{
        ActivityGraphPosition, AdminWorldActivityPositionCommand, AdminWorldActivityPositionError,
        AdminWorldActivityPositionRepository,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldActivityPositionRepository for RecordingRepository {
        fn update_position(
            &self,
            _principal: &AuthorizedPrincipal,
            _activity_id: Uuid,
            _position: ActivityGraphPosition,
        ) -> impl Future<
            Output = Result<Option<AdminActivityGraphPosition>, AdminWorldActivityPositionError>,
        > + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn requires_activity_update_before_dragging_a_source_activity_card() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };

        let result = AdminWorldActivityPositionCommand::new(&repository)
            .execute(
                &principal,
                Uuid::new_v4(),
                ActivityGraphPosition { x: 120, y: 80 },
            )
            .await
            .expect("authorization check succeeds");

        assert!(result.is_none());
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
