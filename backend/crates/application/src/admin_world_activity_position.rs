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
