use std::future::Future;

use serde::Serialize;
use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
pub struct ResetWorldNodeUnlocksResult {
    pub reset_count: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldNodeUnlockError {
    Unavailable,
}

pub trait AdminWorldNodeUnlockRepository {
    fn reset_tool_unlocks(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
    ) -> impl Future<Output = Result<Option<ResetWorldNodeUnlocksResult>, AdminWorldNodeUnlockError>>
    + Send;
}

pub struct AdminWorldNodeUnlockCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldNodeUnlockCommand<'repository, Repository>
where
    Repository: AdminWorldNodeUnlockRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn reset_tool_unlocks(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
    ) -> Result<Option<ResetWorldNodeUnlocksResult>, AdminWorldNodeUnlockError> {
        if !principal.has_permission("world_maps", "ru") {
            return Ok(None);
        }
        self.repository.reset_tool_unlocks(principal, node_id).await
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

    impl AdminWorldNodeUnlockRepository for Repository {
        fn reset_tool_unlocks(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
        ) -> impl Future<
            Output = Result<Option<ResetWorldNodeUnlocksResult>, AdminWorldNodeUnlockError>,
        > + Send {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(Some(ResetWorldNodeUnlocksResult { reset_count: 1 })) }
        }
    }

    #[tokio::test]
    async fn reset_requires_map_update_before_repository_access() {
        let called = Arc::new(AtomicBool::new(false));
        let repository = Repository(called.clone());
        let reader = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:r:all".to_owned()],
        };

        let result = AdminWorldNodeUnlockCommand::new(&repository)
            .reset_tool_unlocks(&reader, Uuid::new_v4())
            .await
            .expect("authorization result");

        assert_eq!(result, None);
        assert!(!called.load(Ordering::SeqCst));

        let author = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:ru:all".to_owned()],
        };
        let result = AdminWorldNodeUnlockCommand::new(&repository)
            .reset_tool_unlocks(&author, Uuid::new_v4())
            .await
            .expect("authorized reset");

        assert_eq!(result, Some(ResetWorldNodeUnlocksResult { reset_count: 1 }));
        assert!(called.load(Ordering::SeqCst));
    }
}
