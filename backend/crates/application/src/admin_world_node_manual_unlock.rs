use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SetWorldNodeManualUnlockForm {
    pub enabled: bool,
    pub learner_subject_id: Uuid,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldNodeManualUnlockError {
    Unavailable,
}

pub trait AdminWorldNodeManualUnlockRepository {
    fn set_manual_unlock(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: SetWorldNodeManualUnlockForm,
    ) -> impl Future<Output = Result<bool, AdminWorldNodeManualUnlockError>> + Send;
}

pub struct AdminWorldNodeManualUnlockCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldNodeManualUnlockCommand<'repository, Repository>
where
    Repository: AdminWorldNodeManualUnlockRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: SetWorldNodeManualUnlockForm,
    ) -> Result<bool, AdminWorldNodeManualUnlockError> {
        if !principal.has_permission("world_maps", "ru")
            || !principal.has_permission("learner_support_signals", "ro")
        {
            return Ok(false);
        }
        self.repository
            .set_manual_unlock(principal, node_id, form)
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

    use super::*;

    struct Repository(Arc<AtomicBool>);

    impl AdminWorldNodeManualUnlockRepository for Repository {
        fn set_manual_unlock(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
            _: SetWorldNodeManualUnlockForm,
        ) -> impl Future<Output = Result<bool, AdminWorldNodeManualUnlockError>> + Send {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(true) }
        }
    }

    #[tokio::test]
    async fn manual_unlock_requires_both_map_and_support_signal_scope() {
        let called = Arc::new(AtomicBool::new(false));
        let repository = Repository(called.clone());
        let form = SetWorldNodeManualUnlockForm {
            enabled: true,
            learner_subject_id: Uuid::new_v4(),
        };
        let map_author_without_support = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:ru:all".to_owned()],
        };

        let denied = AdminWorldNodeManualUnlockCommand::new(&repository)
            .execute(&map_author_without_support, Uuid::new_v4(), form)
            .await
            .expect("authorization result");

        assert!(!denied);
        assert!(!called.load(Ordering::SeqCst));

        let authorized = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec![
                "role_permission:world_maps:ru:all".to_owned(),
                "role_permission:learner_support_signals:ro:all".to_owned(),
            ],
        };
        let accepted = AdminWorldNodeManualUnlockCommand::new(&repository)
            .execute(&authorized, Uuid::new_v4(), form)
            .await
            .expect("authorized result");

        assert!(accepted);
        assert!(called.load(Ordering::SeqCst));
    }
}
