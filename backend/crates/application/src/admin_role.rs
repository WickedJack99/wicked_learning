use std::future::Future;

use wicked_learning_domain::identity_access::{
    AdminRoles, ApplicationCapability, AuthorizedPrincipal,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminRoleError;

pub trait AdminRoleRepository {
    fn list(&self) -> impl Future<Output = Result<AdminRoles, AdminRoleError>> + Send;
}

pub struct AdminRolesQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminRolesQuery<'repository, Repository>
where
    Repository: AdminRoleRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<AdminRoles>, AdminRoleError> {
        if !principal.has_capability(ApplicationCapability::ViewRoles) {
            return Ok(None);
        }
        self.repository.list().await.map(Some)
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;
    use wicked_learning_domain::identity_access::{AdminRoles, AuthorizedPrincipal};

    use super::{AdminRoleError, AdminRoleRepository, AdminRolesQuery};

    struct Repository;
    impl AdminRoleRepository for Repository {
        fn list(
            &self,
        ) -> impl std::future::Future<Output = Result<AdminRoles, AdminRoleError>> + Send {
            async { Ok(AdminRoles { roles: vec![] }) }
        }
    }

    #[tokio::test]
    async fn does_not_project_roles_without_the_role_read_capability() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec![],
        };
        assert_eq!(
            AdminRolesQuery::new(&Repository)
                .execute(&principal)
                .await
                .expect("authorization result"),
            None
        );
    }
}
