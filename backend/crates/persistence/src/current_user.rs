use sqlx::PgPool;
use uuid::Uuid;
use wicked_learning_application::current_user::{
    CurrentUserReadError, CurrentUserRepository as CurrentUserRepositoryPort,
};
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

pub struct PostgresCurrentUserRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresCurrentUserRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl CurrentUserRepositoryPort for PostgresCurrentUserRepository<'_> {
    fn load_authorized_principal(
        &self,
        subject_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<AuthorizedPrincipal>, CurrentUserReadError>>
    + Send {
        async move {
            let roles = sqlx::query_scalar::<_, String>(
                r#"
                    SELECT roles.role_key
                    FROM application_principals AS principals
                    INNER JOIN application_principal_roles AS principal_roles
                        ON principal_roles.principal_id = principals.id
                    INNER JOIN application_roles AS roles
                        ON roles.role_key = principal_roles.role_key
                    WHERE principals.identity_subject_id = $1
                    ORDER BY roles.role_key ASC
                "#,
            )
            .bind(subject_id)
            .fetch_all(self.pool)
            .await
            .map_err(|_| CurrentUserReadError)?;

            let capabilities = sqlx::query_scalar::<_, String>(
                r#"
                    SELECT DISTINCT capabilities.capability_key
                    FROM application_principals AS principals
                    INNER JOIN application_principal_roles AS principal_roles
                        ON principal_roles.principal_id = principals.id
                    INNER JOIN application_role_capabilities AS role_capabilities
                        ON role_capabilities.role_key = principal_roles.role_key
                    INNER JOIN application_capabilities AS capabilities
                        ON capabilities.capability_key = role_capabilities.capability_key
                    WHERE principals.identity_subject_id = $1
                    ORDER BY capabilities.capability_key ASC
                "#,
            )
            .bind(subject_id)
            .fetch_all(self.pool)
            .await
            .map_err(|_| CurrentUserReadError)?;

            Ok((!roles.is_empty()).then_some(AuthorizedPrincipal {
                subject_id,
                roles,
                capabilities,
            }))
        }
    }
}
