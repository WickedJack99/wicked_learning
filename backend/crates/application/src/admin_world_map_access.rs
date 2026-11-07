use std::{collections::HashSet, future::Future};

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdateWorldMapAccessForm {
    pub access_roles: Vec<String>,
}

impl UpdateWorldMapAccessForm {
    pub fn parse(access_roles: &[String]) -> Option<Self> {
        if access_roles.is_empty() || access_roles.len() > 100 {
            return None;
        }

        let mut seen = HashSet::new();
        let mut normalized = Vec::with_capacity(access_roles.len());
        for access_role in access_roles {
            let access_role = access_role.trim();
            if access_role.is_empty() || access_role.chars().count() > 80 {
                return None;
            }
            if seen.insert(access_role.to_owned()) {
                normalized.push(access_role.to_owned());
            }
        }

        (!normalized.is_empty()).then_some(Self {
            access_roles: normalized,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldMapAccessError {
    InvalidAccessRole,
    Unavailable,
}

pub trait AdminWorldMapAccessRepository {
    fn update_map_access(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &UpdateWorldMapAccessForm,
    ) -> impl Future<Output = Result<Option<()>, AdminWorldMapAccessError>> + Send;
}

/// Replaces the source map's viewer-role list. Map viewing policy deliberately
/// remains separate from the map-edit permission that exposes its workspace.
pub struct AdminWorldMapAccessCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldMapAccessCommand<'repository, Repository>
where
    Repository: AdminWorldMapAccessRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &UpdateWorldMapAccessForm,
    ) -> Result<Option<()>, AdminWorldMapAccessError> {
        if !principal.has_permission("world_map_access", "ru") {
            return Ok(None);
        }

        self.repository
            .update_map_access(principal, map_id, form)
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
        AdminWorldMapAccessCommand, AdminWorldMapAccessError, AdminWorldMapAccessRepository,
        UpdateWorldMapAccessForm,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldMapAccessRepository for RecordingRepository {
        fn update_map_access(
            &self,
            _principal: &AuthorizedPrincipal,
            _map_id: Uuid,
            _form: &UpdateWorldMapAccessForm,
        ) -> impl Future<Output = Result<Option<()>, AdminWorldMapAccessError>> + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[test]
    fn normalizes_duplicate_source_access_roles_without_accepting_blank_values() {
        let roles = vec![
            " public ".to_owned(),
            "learner".to_owned(),
            "public".to_owned(),
        ];

        assert_eq!(
            UpdateWorldMapAccessForm::parse(&roles),
            Some(UpdateWorldMapAccessForm {
                access_roles: vec!["public".to_owned(), "learner".to_owned()],
            })
        );
        assert!(UpdateWorldMapAccessForm::parse(&[" ".to_owned()]).is_none());
    }

    #[tokio::test]
    async fn requires_the_distinct_map_access_update_permission() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_maps:rud:all".to_owned()],
        };
        let form = UpdateWorldMapAccessForm::parse(&["public".to_owned()])
            .expect("a public access role is valid");

        let updated = AdminWorldMapAccessCommand::new(&repository)
            .execute(&principal, Uuid::new_v4(), &form)
            .await
            .expect("authorization check succeeds");

        assert_eq!(updated, None);
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
