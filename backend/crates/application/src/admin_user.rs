use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::{
    AdminUsers, ApplicationCapability, AuthorizedPrincipal,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminUserError;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminUserAccessForm {
    pub banned_until: Option<String>,
    pub login_disabled: bool,
    pub roles: Vec<String>,
}

impl AdminUserAccessForm {
    pub fn parse(
        login_disabled: bool,
        banned_until: Option<String>,
        mut roles: Vec<String>,
    ) -> Option<Self> {
        let banned_until = banned_until
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty());
        if roles.is_empty() {
            return None;
        }
        for role in &mut roles {
            *role = role.trim().to_owned();
        }
        roles.sort();
        roles.dedup();
        if roles.iter().any(String::is_empty) {
            return None;
        }
        Some(Self {
            banned_until,
            login_disabled,
            roles,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminUserAccessUpdate {
    Invalid,
    Missing,
    Updated,
}

pub trait AdminUserRepository {
    fn list(
        &self,
        actor_subject_id: Uuid,
    ) -> impl Future<Output = Result<AdminUsers, AdminUserError>> + Send;

    fn update_access(
        &self,
        actor_subject_id: Uuid,
        target_subject_id: Uuid,
        form: &AdminUserAccessForm,
    ) -> impl Future<Output = Result<AdminUserAccessUpdate, AdminUserError>> + Send;
}

pub struct AdminUsersQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct AdminUsersCommand<'repository, Repository> {
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
        if !principal.has_permission("users", "ro")
            && !principal.has_capability(ApplicationCapability::ViewUsers)
        {
            return Ok(None);
        }

        self.repository.list(principal.subject_id).await.map(Some)
    }
}

impl<'repository, Repository> AdminUsersCommand<'repository, Repository>
where
    Repository: AdminUserRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn update_access(
        &self,
        principal: &AuthorizedPrincipal,
        target_subject_id: Uuid,
        form: &AdminUserAccessForm,
    ) -> Result<AdminUserAccessUpdate, AdminUserError> {
        if !principal.has_permission("users", "ru") {
            return Ok(AdminUserAccessUpdate::Missing);
        }
        if principal.subject_id == target_subject_id {
            return Ok(AdminUserAccessUpdate::Invalid);
        }
        self.repository
            .update_access(principal.subject_id, target_subject_id, form)
            .await
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;
    use wicked_learning_domain::identity_access::{AdminUsers, AuthorizedPrincipal};

    use super::{
        AdminUserAccessForm, AdminUserAccessUpdate, AdminUserError, AdminUserRepository,
        AdminUsersCommand, AdminUsersQuery,
    };

    struct Repository;

    impl AdminUserRepository for Repository {
        fn list(
            &self,
            _actor_subject_id: Uuid,
        ) -> impl std::future::Future<Output = Result<AdminUsers, AdminUserError>> + Send {
            async {
                Ok(AdminUsers {
                    assignable_roles: vec![],
                    registration_tokens: vec![],
                    users: vec![],
                })
            }
        }

        fn update_access(
            &self,
            _actor_subject_id: Uuid,
            _target_subject_id: Uuid,
            _form: &AdminUserAccessForm,
        ) -> impl std::future::Future<Output = Result<AdminUserAccessUpdate, AdminUserError>> + Send
        {
            async { Ok(AdminUserAccessUpdate::Updated) }
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

    #[tokio::test]
    async fn rejects_self_access_updates_before_the_repository_is_called() {
        let subject_id = Uuid::new_v4();
        let principal = AuthorizedPrincipal {
            subject_id,
            roles: vec!["platform_administrator".to_owned()],
            capabilities: vec!["role_permission:users:ru:all".to_owned()],
        };
        let form = AdminUserAccessForm::parse(false, None, vec!["learner".to_owned()])
            .expect("valid access form");

        assert_eq!(
            AdminUsersCommand::new(&Repository)
                .update_access(&principal, subject_id, &form)
                .await
                .expect("command result"),
            AdminUserAccessUpdate::Invalid
        );
    }

    #[test]
    fn normalizes_access_form_roles() {
        let form = AdminUserAccessForm::parse(
            false,
            Some("  ".to_owned()),
            vec![" learner ".to_owned(), "learner".to_owned()],
        )
        .expect("valid access form");
        assert_eq!(form.roles, vec!["learner"]);
        assert_eq!(form.banned_until, None);
    }
}
