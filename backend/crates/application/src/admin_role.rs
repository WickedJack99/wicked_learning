use std::{collections::BTreeMap, future::Future};

use wicked_learning_domain::identity_access::{
    AdminRole, AdminRoles, ApplicationCapability, AuthorizedPrincipal, permission_resources,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminRoleError;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminRoleDeletion {
    Deleted,
    Missing,
    Protected,
}

pub trait AdminRoleRepository {
    fn list(&self) -> impl Future<Output = Result<AdminRoles, AdminRoleError>> + Send;

    fn create(
        &self,
        form: &AdminRoleForm,
    ) -> impl Future<Output = Result<Option<AdminRole>, AdminRoleError>> + Send;

    fn update(
        &self,
        role_key: &str,
        form: &AdminRoleForm,
    ) -> impl Future<Output = Result<Option<AdminRole>, AdminRoleError>> + Send;

    fn delete(
        &self,
        role_key: &str,
    ) -> impl Future<Output = Result<AdminRoleDeletion, AdminRoleError>> + Send;
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminRoleForm {
    pub description: Option<String>,
    pub level: i32,
    pub name: String,
    pub permission_scopes: BTreeMap<String, String>,
    pub permissions: BTreeMap<String, String>,
    pub role_key: String,
}

impl AdminRoleForm {
    pub fn parse(
        role_key: &str,
        name: &str,
        description: Option<&str>,
        level: i32,
        permissions: BTreeMap<String, String>,
        permission_scopes: BTreeMap<String, String>,
    ) -> Option<Self> {
        let role_key = role_key.trim().to_ascii_lowercase();
        let name = name.trim();
        let description = description
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned);
        if role_key.is_empty()
            || role_key.len() > 80
            || !role_key.bytes().all(|character| {
                character.is_ascii_lowercase()
                    || character.is_ascii_digit()
                    || matches!(character, b'-' | b'_')
            })
            || name.is_empty()
            || name.chars().count() > 80
            || description
                .as_ref()
                .is_some_and(|value| value.chars().count() > 500)
            || !(1..=100).contains(&level)
        {
            return None;
        }

        let mut normalized_permissions = BTreeMap::new();
        let mut normalized_scopes = BTreeMap::new();
        for resource in permission_resources() {
            let permission = permissions
                .get(&resource.key)
                .map(String::as_str)
                .unwrap_or("none");
            let scope = permission_scopes
                .get(&resource.key)
                .map(String::as_str)
                .unwrap_or("all");
            if !matches!(permission, "none" | "ro" | "ru" | "rud")
                || !matches!(scope, "none" | "own" | "assigned" | "group" | "all")
            {
                return None;
            }
            normalized_permissions.insert(resource.key.clone(), permission.to_owned());
            normalized_scopes.insert(resource.key, scope.to_owned());
        }

        Some(Self {
            description,
            level,
            name: name.to_owned(),
            permission_scopes: normalized_scopes,
            permissions: normalized_permissions,
            role_key,
        })
    }
}

pub struct AdminRolesQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct AdminRolesCommand<'repository, Repository> {
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
        if !principal.has_permission("roles", "ro")
            && !principal.has_capability(ApplicationCapability::ViewRoles)
        {
            return Ok(None);
        }
        self.repository.list().await.map(Some)
    }
}

impl<'repository, Repository> AdminRolesCommand<'repository, Repository>
where
    Repository: AdminRoleRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &AdminRoleForm,
    ) -> Result<Option<AdminRole>, AdminRoleError> {
        if !principal.has_permission("roles", "ru") {
            return Ok(None);
        }
        self.repository.create(form).await
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        role_key: &str,
        form: &AdminRoleForm,
    ) -> Result<Option<AdminRole>, AdminRoleError> {
        if !principal.has_permission("roles", "ru") {
            return Ok(None);
        }
        self.repository.update(role_key, form).await
    }

    pub async fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        role_key: &str,
    ) -> Result<AdminRoleDeletion, AdminRoleError> {
        if !principal.has_permission("roles", "rud") {
            return Ok(AdminRoleDeletion::Missing);
        }
        self.repository.delete(role_key).await
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;
    use wicked_learning_domain::identity_access::{AdminRoles, AuthorizedPrincipal};

    use super::{AdminRoleDeletion, AdminRoleError, AdminRoleRepository, AdminRolesQuery};

    struct Repository;
    impl AdminRoleRepository for Repository {
        fn list(
            &self,
        ) -> impl std::future::Future<Output = Result<AdminRoles, AdminRoleError>> + Send {
            async {
                Ok(AdminRoles {
                    permission_resources: vec![],
                    roles: vec![],
                })
            }
        }

        fn create(
            &self,
            _form: &super::AdminRoleForm,
        ) -> impl std::future::Future<
            Output = Result<
                Option<wicked_learning_domain::identity_access::AdminRole>,
                AdminRoleError,
            >,
        > + Send {
            async { Ok(None) }
        }

        fn update(
            &self,
            _role_key: &str,
            _form: &super::AdminRoleForm,
        ) -> impl std::future::Future<
            Output = Result<
                Option<wicked_learning_domain::identity_access::AdminRole>,
                AdminRoleError,
            >,
        > + Send {
            async { Ok(None) }
        }

        fn delete(
            &self,
            _role_key: &str,
        ) -> impl std::future::Future<Output = Result<AdminRoleDeletion, AdminRoleError>> + Send
        {
            async { Ok(AdminRoleDeletion::Missing) }
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

    #[test]
    fn source_role_form_defaults_omitted_permissions_conservatively() {
        let form = super::AdminRoleForm::parse(
            "  content_editor ",
            "  Content editor  ",
            Some("  Can prepare learning content.  "),
            50,
            Default::default(),
            Default::default(),
        )
        .expect("valid form");

        assert_eq!(form.role_key, "content_editor");
        assert_eq!(form.permissions["roles"], "none");
        assert_eq!(form.permission_scopes["roles"], "all");
    }
}
