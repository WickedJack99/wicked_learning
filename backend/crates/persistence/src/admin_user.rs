use std::collections::BTreeMap;

use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_user::{AdminUserError, AdminUserRepository as Port};
use wicked_learning_domain::identity_access::{
    AdminRegistrationToken, AdminUser, AdminUserReference, AdminUsers,
};

pub struct PostgresAdminUserRepository<'pool> {
    application_pool: &'pool PgPool,
    identity_pool: &'pool PgPool,
}

impl<'pool> PostgresAdminUserRepository<'pool> {
    pub fn new(application_pool: &'pool PgPool, identity_pool: &'pool PgPool) -> Self {
        Self {
            application_pool,
            identity_pool,
        }
    }
}

#[derive(FromRow)]
struct PrincipalRoleRow {
    created_at: String,
    role_key: Option<String>,
    subject_id: Uuid,
}

#[derive(FromRow)]
struct IdentityRow {
    display_name: Option<String>,
    normalized_email: String,
    status: String,
    subject_id: Uuid,
}

#[derive(FromRow)]
struct RegistrationTokenRow {
    created_at: String,
    created_by_subject_id: Option<Uuid>,
    expires_at: Option<String>,
    id: Uuid,
    is_expired: bool,
    is_used: bool,
    note: Option<String>,
    used_at: Option<String>,
    used_by_subject_id: Option<Uuid>,
}

impl Port for PostgresAdminUserRepository<'_> {
    fn list(&self) -> impl std::future::Future<Output = Result<AdminUsers, AdminUserError>> + Send {
        async move {
            let role_rows = sqlx::query_as::<_, PrincipalRoleRow>(
                "SELECT principals.identity_subject_id AS subject_id, \
                 to_char(principals.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, \
                 principal_roles.role_key \
                 FROM application_principals AS principals \
                 LEFT JOIN application_principal_roles AS principal_roles \
                    ON principal_roles.principal_id = principals.id \
                 ORDER BY principals.created_at DESC, principals.id DESC, principal_roles.role_key ASC",
            )
            .fetch_all(self.application_pool)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not list application principals for administration");
                AdminUserError
            })?;
            let subject_ids = role_rows
                .iter()
                .map(|row| row.subject_id)
                .collect::<Vec<_>>();
            if subject_ids.is_empty() {
                return Ok(AdminUsers {
                    registration_tokens: vec![],
                    users: vec![],
                });
            }
            let registration_tokens = sqlx::query_as::<_, RegistrationTokenRow>(
                "SELECT id, created_by_subject_id, used_by_subject_id, note, \
                 to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, \
                 to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS expires_at, \
                 to_char(used_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS used_at, \
                 used_at IS NOT NULL AS is_used, \
                 expires_at IS NOT NULL AND expires_at <= NOW() AS is_expired \
                 FROM identity_registration_tokens ORDER BY created_at DESC, id DESC LIMIT 25",
            )
            .fetch_all(self.identity_pool)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not list registration token summaries for administration");
                AdminUserError
            })?;
            let mut identity_subject_ids = subject_ids;
            identity_subject_ids.extend(registration_tokens.iter().flat_map(|token| {
                [token.created_by_subject_id, token.used_by_subject_id]
                    .into_iter()
                    .flatten()
            }));
            let identities = sqlx::query_as::<_, IdentityRow>(
                "SELECT subjects.id AS subject_id, profiles.display_name, subjects.normalized_email, subjects.status \
                 FROM identity_subjects AS subjects \
                 LEFT JOIN identity_profiles AS profiles ON profiles.subject_id = subjects.id \
                 WHERE subjects.id = ANY($1)",
            )
            .bind(&identity_subject_ids)
            .fetch_all(self.identity_pool)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not project identity profiles for administration");
                AdminUserError
            })?
            .into_iter()
            .map(|row| (row.subject_id, row))
            .collect::<BTreeMap<_, _>>();

            let mut roles = BTreeMap::<Uuid, (String, Vec<String>)>::new();
            let mut user_order = Vec::new();
            for row in role_rows {
                let entry = roles.entry(row.subject_id).or_insert_with(|| {
                    user_order.push(row.subject_id);
                    (row.created_at, vec![])
                });
                if let Some(role_key) = row.role_key {
                    entry.1.push(role_key);
                }
            }
            let users = user_order
                .into_iter()
                .filter_map(|subject_id| {
                    let (created_at, roles) = roles.remove(&subject_id)?;
                    identities.get(&subject_id).map(|identity| AdminUser {
                        created_at,
                        email: identity.normalized_email.clone(),
                        identity_status: identity.status.clone(),
                        name: identity
                            .display_name
                            .clone()
                            .unwrap_or_else(|| identity.normalized_email.clone()),
                        roles,
                        subject_id: subject_id.to_string(),
                    })
                })
                .collect();
            let registration_tokens = registration_tokens
                .into_iter()
                .map(|token| AdminRegistrationToken {
                    created_at: token.created_at,
                    created_by: identity_reference(&identities, token.created_by_subject_id),
                    expires_at: token.expires_at,
                    id: token.id.to_string(),
                    is_expired: token.is_expired,
                    is_used: token.is_used,
                    note: token.note,
                    roles: vec!["learner".to_owned()],
                    used_at: token.used_at,
                    used_by: identity_reference(&identities, token.used_by_subject_id),
                })
                .collect();
            Ok(AdminUsers {
                registration_tokens,
                users,
            })
        }
    }
}

fn identity_reference(
    identities: &BTreeMap<Uuid, IdentityRow>,
    subject_id: Option<Uuid>,
) -> Option<AdminUserReference> {
    let identity = identities.get(&subject_id?)?;
    Some(AdminUserReference {
        email: identity.normalized_email.clone(),
        name: identity
            .display_name
            .clone()
            .unwrap_or_else(|| identity.normalized_email.clone()),
        subject_id: identity.subject_id.to_string(),
    })
}
