use std::collections::BTreeMap;

use sqlx::{FromRow, PgPool};
use wicked_learning_application::admin_role::{AdminRoleError, AdminRoleRepository as Port};
use wicked_learning_domain::identity_access::{AdminRole, AdminRoles, permission_resources};

pub struct PostgresAdminRoleRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminRoleRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct RoleRow {
    capability_key: Option<String>,
    description: Option<String>,
    is_system: bool,
    level: i32,
    name: String,
    role_key: String,
}

#[derive(FromRow)]
struct PermissionRow {
    level: String,
    resource_key: String,
    role_key: String,
    scope: String,
}

impl Port for PostgresAdminRoleRepository<'_> {
    fn list(&self) -> impl std::future::Future<Output = Result<AdminRoles, AdminRoleError>> + Send {
        async move {
            let rows = sqlx::query_as::<_, RoleRow>(
                "SELECT roles.role_key, roles.name, roles.description, roles.level, roles.is_system, capabilities.capability_key \
                 FROM application_roles AS roles \
                 LEFT JOIN application_role_capabilities AS grants ON grants.role_key = roles.role_key \
                 LEFT JOIN application_capabilities AS capabilities ON capabilities.capability_key = grants.capability_key \
                 ORDER BY roles.level DESC, roles.name ASC, roles.role_key ASC, capabilities.capability_key ASC",
            )
            .fetch_all(self.pool)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not list administration roles");
                AdminRoleError
            })?;
            let mut roles = BTreeMap::<String, AdminRole>::new();
            for row in rows {
                let role = roles
                    .entry(row.role_key.clone())
                    .or_insert_with(|| AdminRole {
                        capabilities: vec![],
                        description: row.description,
                        is_system: row.is_system,
                        level: row.level,
                        name: row.name,
                        permission_scopes: BTreeMap::new(),
                        permissions: BTreeMap::new(),
                        role_key: row.role_key,
                    });
                if let Some(capability) = row.capability_key {
                    role.capabilities.push(capability);
                }
            }
            let mut roles = roles.into_values().collect::<Vec<_>>();
            roles.sort_by(|left, right| {
                right
                    .level
                    .cmp(&left.level)
                    .then_with(|| left.name.cmp(&right.name))
            });
            let permissions = sqlx::query_as::<_, PermissionRow>(
                "SELECT role_key, resource_key, level, scope \
                 FROM application_role_permissions \
                 ORDER BY role_key ASC, resource_key ASC",
            )
            .fetch_all(self.pool)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not list administrative role permissions");
                AdminRoleError
            })?;
            for permission in permissions {
                if let Some(role) = roles
                    .iter_mut()
                    .find(|role| role.role_key == permission.role_key)
                {
                    role.permissions
                        .insert(permission.resource_key.clone(), permission.level);
                    role.permission_scopes
                        .insert(permission.resource_key, permission.scope);
                }
            }
            Ok(AdminRoles {
                permission_resources: permission_resources(),
                roles,
            })
        }
    }
}
