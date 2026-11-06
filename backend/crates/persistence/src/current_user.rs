use sqlx::PgPool;
use uuid::Uuid;
use wicked_learning_application::current_user::{
    CurrentUser, CurrentUserReadError, CurrentUserRepository as CurrentUserRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerAppearance,
};

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
    ) -> impl std::future::Future<Output = Result<Option<CurrentUser>, CurrentUserReadError>> + Send
    {
        async move {
            let principal = sqlx::query_as::<_, PrincipalRow>(
                "SELECT principals.id, preferences.appearance \
                 FROM application_principals AS principals \
                 LEFT JOIN learner_appearance_preferences AS preferences \
                    ON preferences.principal_id = principals.id \
                 WHERE principals.identity_subject_id = $1",
            )
            .bind(subject_id)
            .fetch_optional(self.pool)
            .await
            .map_err(|_| CurrentUserReadError)?;
            let Some(principal) = principal else {
                return Ok(None);
            };
            let appearance = principal
                .appearance
                .as_deref()
                .and_then(LearnerAppearance::parse)
                .unwrap_or(LearnerAppearance::Light);

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

            Ok(Some(CurrentUser {
                appearance,
                principal: AuthorizedPrincipal {
                    subject_id,
                    roles,
                    capabilities,
                },
            }))
        }
    }
}

#[derive(sqlx::FromRow)]
struct PrincipalRow {
    #[allow(dead_code)]
    id: Uuid,
    appearance: Option<String>,
}
