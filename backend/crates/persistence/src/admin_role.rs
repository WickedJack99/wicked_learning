use std::collections::BTreeMap;

use sqlx::{FromRow, PgPool, Postgres, Transaction};
use wicked_learning_application::admin_role::{
    AdminRoleDeletion, AdminRoleError, AdminRoleForm, AdminRoleRepository as Port,
};
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

    fn create(
        &self,
        form: &AdminRoleForm,
    ) -> impl std::future::Future<Output = Result<Option<AdminRole>, AdminRoleError>> + Send {
        async move {
            let mut transaction = self.pool.begin().await.map_err(storage_error)?;
            let inserted = sqlx::query_scalar::<_, String>(
                "INSERT INTO application_roles (role_key, name, description, level, is_system) \
                 VALUES ($1, $2, $3, $4, FALSE) \
                 ON CONFLICT (role_key) DO NOTHING RETURNING role_key",
            )
            .bind(&form.role_key)
            .bind(&form.name)
            .bind(&form.description)
            .bind(form.level)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(storage_error)?;
            if inserted.is_none() {
                return Ok(None);
            }
            save_permissions(&mut transaction, &form.role_key, form).await?;
            transaction.commit().await.map_err(storage_error)?;
            self.list()
                .await?
                .roles
                .into_iter()
                .find(|role| role.role_key == form.role_key)
                .map(Some)
                .ok_or(AdminRoleError)
        }
    }

    fn update(
        &self,
        role_key: &str,
        form: &AdminRoleForm,
    ) -> impl std::future::Future<Output = Result<Option<AdminRole>, AdminRoleError>> + Send {
        async move {
            let mut transaction = self.pool.begin().await.map_err(storage_error)?;
            let updated = sqlx::query_scalar::<_, String>(
                "UPDATE application_roles \
                 SET name = $2, description = $3, level = $4 \
                 WHERE role_key = $1 RETURNING role_key",
            )
            .bind(role_key)
            .bind(&form.name)
            .bind(&form.description)
            .bind(form.level)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(storage_error)?;
            if updated.is_none() {
                return Ok(None);
            }
            save_permissions(&mut transaction, role_key, form).await?;
            transaction.commit().await.map_err(storage_error)?;
            self.list()
                .await?
                .roles
                .into_iter()
                .find(|role| role.role_key == role_key)
                .map(Some)
                .ok_or(AdminRoleError)
        }
    }

    fn delete(
        &self,
        role_key: &str,
    ) -> impl std::future::Future<Output = Result<AdminRoleDeletion, AdminRoleError>> + Send {
        async move {
            let is_system = sqlx::query_scalar::<_, bool>(
                "SELECT is_system FROM application_roles WHERE role_key = $1",
            )
            .bind(role_key)
            .fetch_optional(self.pool)
            .await
            .map_err(storage_error)?;
            let Some(is_system) = is_system else {
                return Ok(AdminRoleDeletion::Missing);
            };
            if is_system {
                return Ok(AdminRoleDeletion::Protected);
            }
            let deleted = sqlx::query_scalar::<_, String>(
                "DELETE FROM application_roles WHERE role_key = $1 RETURNING role_key",
            )
            .bind(role_key)
            .fetch_optional(self.pool)
            .await
            .map_err(storage_error)?;
            Ok(if deleted.is_some() {
                AdminRoleDeletion::Deleted
            } else {
                AdminRoleDeletion::Missing
            })
        }
    }
}

async fn save_permissions(
    transaction: &mut Transaction<'_, Postgres>,
    role_key: &str,
    form: &AdminRoleForm,
) -> Result<(), AdminRoleError> {
    for (resource_key, level) in &form.permissions {
        let scope = form
            .permission_scopes
            .get(resource_key)
            .ok_or(AdminRoleError)?;
        sqlx::query(
            "INSERT INTO application_role_permissions (role_key, resource_key, level, scope) \
             VALUES ($1, $2, $3, $4) \
             ON CONFLICT (role_key, resource_key) DO UPDATE \
             SET level = EXCLUDED.level, scope = EXCLUDED.scope, updated_at = NOW()",
        )
        .bind(role_key)
        .bind(resource_key)
        .bind(level)
        .bind(scope)
        .execute(&mut **transaction)
        .await
        .map_err(storage_error)?;
    }
    Ok(())
}

fn storage_error(error: sqlx::Error) -> AdminRoleError {
    tracing::error!(%error, "could not persist administrative role");
    AdminRoleError
}
