use std::future::Future;

use wicked_learning_domain::identity_access::{
    AdminUsers, ApplicationCapability, AuthorizedPrincipal,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminUserError;

pub trait AdminUserRepository {
    fn list(&self) -> impl Future<Output = Result<AdminUsers, AdminUserError>> + Send;
}

pub struct AdminUsersQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminUsersQuery<'repository, Repository>
where
    Repository: AdminUserRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<AdminUsers>, AdminUserError> {
        if !principal.has_capability(ApplicationCapability::ViewUsers) {
            return Ok(None);
        }

        self.repository.list().await.map(Some)
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;
    use wicked_learning_domain::identity_access::{AdminUsers, AuthorizedPrincipal};

    use super::{AdminUserError, AdminUserRepository, AdminUsersQuery};

    struct Repository;

    impl AdminUserRepository for Repository {
        fn list(
            &self,
        ) -> impl std::future::Future<Output = Result<AdminUsers, AdminUserError>> + Send {
            async {
                Ok(AdminUsers {
                    registration_tokens: vec![],
                    users: vec![],
                })
            }
        }
    }

    #[tokio::test]
    async fn does_not_project_identity_data_without_the_user_read_capability() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec![],
        };

        assert_eq!(
            AdminUsersQuery::new(&Repository)
                .execute(&principal)
                .await
                .expect("authorization result"),
            None
        );
    }
}
