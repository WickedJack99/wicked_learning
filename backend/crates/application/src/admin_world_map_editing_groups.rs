use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdateWorldMapEditingGroupsForm {
    pub group_ids: Vec<Uuid>,
}

impl UpdateWorldMapEditingGroupsForm {
    pub fn new(group_ids: Vec<Uuid>) -> Option<Self> {
        Some(Self { group_ids })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldMapEditingGroupsError {
    InvalidGroup,
    Unavailable,
}

pub trait AdminWorldMapEditingGroupsRepository {
    fn update_map_editing_groups(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &UpdateWorldMapEditingGroupsForm,
    ) -> impl Future<Output = Result<Option<()>, AdminWorldMapEditingGroupsError>> + Send;
}

pub struct AdminWorldMapEditingGroupsCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapEditingGroupsCommand<'repository, Repository>
where
    Repository: AdminWorldMapEditingGroupsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &UpdateWorldMapEditingGroupsForm,
    ) -> Result<Option<()>, AdminWorldMapEditingGroupsError> {
        if !principal.has_permission("world_map_access", "ru") {
            return Ok(None);
        }
        self.repository
            .update_map_editing_groups(principal, map_id, form)
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

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }
    impl AdminWorldMapEditingGroupsRepository for RecordingRepository {
        fn update_map_editing_groups(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
            _: &UpdateWorldMapEditingGroupsForm,
        ) -> impl Future<Output = Result<Option<()>, AdminWorldMapEditingGroupsError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(Some(())) }
        }
    }

    #[test]
    fn keeps_the_source_empty_editor_group_list() {
        assert!(
            UpdateWorldMapEditingGroupsForm::new(vec![])
                .unwrap()
                .group_ids
                .is_empty()
        );
    }

    #[tokio::test]
    async fn requires_the_distinct_map_access_update_permission() {
        let called = Arc::new(AtomicBool::new(false));
        let repository = RecordingRepository {
            called: called.clone(),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:rud:all".to_owned()],
        };
        let updated = AdminWorldMapEditingGroupsCommand::new(&repository)
            .execute(
                &principal,
                Uuid::new_v4(),
                &UpdateWorldMapEditingGroupsForm::new(vec![]).unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(updated, None);
        assert!(!called.load(Ordering::SeqCst));
    }
}
