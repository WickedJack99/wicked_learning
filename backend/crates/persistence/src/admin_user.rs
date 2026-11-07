use std::collections::BTreeMap;

use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, types::Json};
use uuid::Uuid;
use wicked_learning_application::admin_user::{
    AdminUserAccessForm, AdminUserAccessUpdate, AdminUserDeletion, AdminUserError,
    AdminUserRepository as Port,
};
use wicked_learning_domain::identity_access::{
    AdminAccessChangeEvent, AdminAccessChangeItem, AdminRegistrationToken, AdminUser,
    AdminUserReference, AdminUsers,
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
    banned_until: Option<String>,
    display_name: Option<String>,
    is_currently_banned: bool,
    is_login_disabled: bool,
    login_disabled_at: Option<String>,
    normalized_email: String,
    status: String,
    subject_id: Uuid,
}

#[derive(FromRow)]
struct AccessChangeRow {
    action: String,
    actor_subject_id: Option<Uuid>,
    changes: Value,
    created_at: String,
    id: Uuid,
    target_subject_id: Uuid,
}

#[derive(FromRow)]
struct IdentityAccessStateRow {
    banned_until: Option<String>,
    login_disabled_at: Option<String>,
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
    roles: Json<Value>,
    used_at: Option<String>,
    used_by_subject_id: Option<Uuid>,
}

impl Port for PostgresAdminUserRepository<'_> {
    fn list(
        &self,
        actor_subject_id: Uuid,
    ) -> impl std::future::Future<Output = Result<AdminUsers, AdminUserError>> + Send {
        async move {
            let assignable_roles = sqlx::query_scalar::<_, String>(
                "SELECT role_key FROM application_roles WHERE level <= COALESCE(( \
                 SELECT MAX(roles.level) FROM application_principals AS principals \
                 INNER JOIN application_principal_roles AS principal_roles ON principal_roles.principal_id = principals.id \
                 INNER JOIN application_roles AS roles ON roles.role_key = principal_roles.role_key \
                 WHERE principals.identity_subject_id = $1 \
                 ), 0) ORDER BY level DESC, role_key ASC",
            )
            .bind(actor_subject_id)
            .fetch_all(self.application_pool)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not determine assignable administrative roles");
                AdminUserError
            })?;
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
                    assignable_roles,
                    registration_tokens: vec![],
                    users: vec![],
                });
            }
            let registration_tokens = sqlx::query_as::<_, RegistrationTokenRow>(
                "SELECT id, created_by_subject_id, used_by_subject_id, note, roles, \
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
            let access_events = sqlx::query_as::<_, AccessChangeRow>(
                "SELECT id, action, actor_subject_id, target_subject_id, changes, \
                 to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at \
                 FROM application_access_change_events \
                 WHERE target_subject_id = ANY($1) \
                 ORDER BY target_subject_id ASC, created_at DESC, id DESC",
            )
            .bind(&subject_ids)
            .fetch_all(self.application_pool)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not list account-access audit history");
                AdminUserError
            })?;
            let mut identity_subject_ids = subject_ids;
            identity_subject_ids.extend(registration_tokens.iter().flat_map(|token| {
                [token.created_by_subject_id, token.used_by_subject_id]
                    .into_iter()
                    .flatten()
            }));
            identity_subject_ids.extend(
                access_events
                    .iter()
                    .filter_map(|event| event.actor_subject_id),
            );
            let identities = sqlx::query_as::<_, IdentityRow>(
                "SELECT subjects.id AS subject_id, profiles.display_name, subjects.normalized_email, subjects.status, \
                 to_char(subjects.login_disabled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS login_disabled_at, \
                 to_char(subjects.banned_until AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS banned_until, \
                 subjects.login_disabled_at IS NOT NULL AS is_login_disabled, \
                 (subjects.banned_until IS NOT NULL AND subjects.banned_until > NOW()) AS is_currently_banned \
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
            let mut access_history = BTreeMap::<Uuid, Vec<AdminAccessChangeEvent>>::new();
            for event in access_events {
                let events = access_history.entry(event.target_subject_id).or_default();
                if events.len() < 20 {
                    events.push(AdminAccessChangeEvent {
                        action: event.action,
                        actor: identity_reference(&identities, event.actor_subject_id),
                        changes: access_change_items(&event.changes),
                        created_at: event.created_at,
                        id: event.id.to_string(),
                    });
                }
            }
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
                        access_history: access_history.remove(&subject_id).unwrap_or_default(),
                        banned_until: identity.banned_until.clone(),
                        created_at,
                        email: identity.normalized_email.clone(),
                        identity_status: identity.status.clone(),
                        is_currently_banned: identity.is_currently_banned,
                        is_login_disabled: identity.is_login_disabled,
                        login_disabled_at: identity.login_disabled_at.clone(),
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
                    roles: registration_token_roles(&token.roles.0),
                    used_at: token.used_at,
                    used_by: identity_reference(&identities, token.used_by_subject_id),
                })
                .collect();
            Ok(AdminUsers {
                assignable_roles,
                registration_tokens,
                users,
            })
        }
    }

    fn update_access(
        &self,
        actor_subject_id: Uuid,
        target_subject_id: Uuid,
        form: &AdminUserAccessForm,
    ) -> impl std::future::Future<Output = Result<AdminUserAccessUpdate, AdminUserError>> + Send
    {
        async move {
            update_access(
                self.application_pool,
                self.identity_pool,
                actor_subject_id,
                target_subject_id,
                form,
            )
            .await
        }
    }

    fn delete(
        &self,
        actor_subject_id: Uuid,
        target_subject_id: Uuid,
    ) -> impl std::future::Future<Output = Result<AdminUserDeletion, AdminUserError>> + Send {
        async move {
            delete_user(
                self.application_pool,
                self.identity_pool,
                actor_subject_id,
                target_subject_id,
            )
            .await
        }
    }
}

async fn delete_user(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    actor_subject_id: Uuid,
    target_subject_id: Uuid,
) -> Result<AdminUserDeletion, AdminUserError> {
    let mut application_transaction = application_pool.begin().await.map_err(storage_error)?;
    let target_principal_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1 FOR UPDATE",
    )
    .bind(target_subject_id)
    .fetch_optional(&mut *application_transaction)
    .await
    .map_err(storage_error)?;
    let deletion_job_exists = sqlx::query_scalar::<_, Uuid>(
        "SELECT subject_id FROM application_identity_deletion_jobs WHERE subject_id = $1 FOR UPDATE",
    )
    .bind(target_subject_id)
    .fetch_optional(&mut *application_transaction)
    .await
    .map_err(storage_error)?;

    let Some(target_principal_id) = target_principal_id else {
        if deletion_job_exists.is_none() {
            return Ok(AdminUserDeletion::Missing);
        }
        application_transaction
            .commit()
            .await
            .map_err(storage_error)?;
        return finalize_identity_deletion(application_pool, identity_pool, target_subject_id)
            .await;
    };

    mark_identity_deleting(identity_pool, target_subject_id).await?;
    sqlx::query(
        "INSERT INTO application_identity_deletion_jobs (subject_id, requested_by_subject_id) \
         VALUES ($1, $2) ON CONFLICT (subject_id) DO NOTHING",
    )
    .bind(target_subject_id)
    .bind(actor_subject_id)
    .execute(&mut *application_transaction)
    .await
    .map_err(storage_error)?;
    // The source uses nullable audit foreign keys. Preserve that outcome even
    // though the Rust databases cannot hold cross-database foreign keys.
    sqlx::query(
        "UPDATE application_access_change_events SET target_subject_id = NULL WHERE target_subject_id = $1",
    )
    .bind(target_subject_id)
    .execute(&mut *application_transaction)
    .await
    .map_err(storage_error)?;
    sqlx::query(
        "UPDATE application_access_change_events SET actor_subject_id = NULL WHERE actor_subject_id = $1",
    )
    .bind(target_subject_id)
    .execute(&mut *application_transaction)
    .await
    .map_err(storage_error)?;
    let deleted = sqlx::query_scalar::<_, Uuid>(
        "DELETE FROM application_principals WHERE id = $1 RETURNING id",
    )
    .bind(target_principal_id)
    .fetch_optional(&mut *application_transaction)
    .await
    .map_err(storage_error)?;
    if deleted.is_none() {
        return Ok(AdminUserDeletion::Missing);
    }
    application_transaction
        .commit()
        .await
        .map_err(storage_error)?;
    finalize_identity_deletion(application_pool, identity_pool, target_subject_id).await
}

async fn mark_identity_deleting(
    identity_pool: &PgPool,
    subject_id: Uuid,
) -> Result<(), AdminUserError> {
    let mut transaction = identity_pool.begin().await.map_err(storage_error)?;
    let status = sqlx::query_scalar::<_, String>(
        "SELECT status FROM identity_subjects WHERE id = $1 FOR UPDATE",
    )
    .bind(subject_id)
    .fetch_optional(&mut *transaction)
    .await
    .map_err(storage_error)?;
    let Some(status) = status else {
        return Err(AdminUserError);
    };
    if status != "deleting" {
        sqlx::query(
            "UPDATE identity_subjects SET status = 'deleting', login_disabled_at = COALESCE(login_disabled_at, NOW()), updated_at = NOW() WHERE id = $1",
        )
        .bind(subject_id)
        .execute(&mut *transaction)
        .await
        .map_err(storage_error)?;
    }
    transaction.commit().await.map_err(storage_error)
}

async fn finalize_identity_deletion(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    subject_id: Uuid,
) -> Result<AdminUserDeletion, AdminUserError> {
    let deleted = sqlx::query_scalar::<_, Uuid>(
        "DELETE FROM identity_subjects WHERE id = $1 AND status = 'deleting' RETURNING id",
    )
    .bind(subject_id)
    .fetch_optional(identity_pool)
    .await
    .map_err(storage_error)?;
    if deleted.is_none() {
        let identity_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM identity_subjects WHERE id = $1)",
        )
        .bind(subject_id)
        .fetch_one(identity_pool)
        .await
        .map_err(storage_error)?;
        if identity_exists {
            return Err(AdminUserError);
        }
    }
    sqlx::query("DELETE FROM application_identity_deletion_jobs WHERE subject_id = $1")
        .bind(subject_id)
        .execute(application_pool)
        .await
        .map_err(storage_error)?;
    Ok(AdminUserDeletion::Deleted)
}

async fn update_access(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    actor_subject_id: Uuid,
    target_subject_id: Uuid,
    form: &AdminUserAccessForm,
) -> Result<AdminUserAccessUpdate, AdminUserError> {
    let mut application_transaction = application_pool.begin().await.map_err(storage_error)?;
    let target_principal_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1 FOR UPDATE",
    )
    .bind(target_subject_id)
    .fetch_optional(&mut *application_transaction)
    .await
    .map_err(storage_error)?;
    let Some(target_principal_id) = target_principal_id else {
        return Ok(AdminUserAccessUpdate::Missing);
    };

    let actor_level = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT MAX(roles.level) FROM application_principals AS principals \
         INNER JOIN application_principal_roles AS principal_roles ON principal_roles.principal_id = principals.id \
         INNER JOIN application_roles AS roles ON roles.role_key = principal_roles.role_key \
         WHERE principals.identity_subject_id = $1",
    )
    .bind(actor_subject_id)
    .fetch_one(&mut *application_transaction)
    .await
    .map_err(storage_error)?;
    let Some(actor_level) = actor_level else {
        return Ok(AdminUserAccessUpdate::Invalid);
    };
    let assignable_roles = sqlx::query_scalar::<_, String>(
        "SELECT role_key FROM application_roles WHERE role_key = ANY($1) AND level <= $2 ORDER BY role_key ASC",
    )
    .bind(&form.roles)
    .bind(actor_level)
    .fetch_all(&mut *application_transaction)
    .await
    .map_err(storage_error)?;
    if assignable_roles != form.roles {
        return Ok(AdminUserAccessUpdate::Invalid);
    }
    let previous_roles = sqlx::query_scalar::<_, String>(
        "SELECT role_key FROM application_principal_roles WHERE principal_id = $1 ORDER BY role_key ASC",
    )
    .bind(target_principal_id)
    .fetch_all(&mut *application_transaction)
    .await
    .map_err(storage_error)?;

    let mut identity_transaction = identity_pool.begin().await.map_err(storage_error)?;
    let before = sqlx::query_as::<_, IdentityAccessStateRow>(
        "SELECT to_char(login_disabled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS login_disabled_at, \
         to_char(banned_until AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS banned_until \
         FROM identity_subjects WHERE id = $1 FOR UPDATE",
    )
    .bind(target_subject_id)
    .fetch_optional(&mut *identity_transaction)
    .await
    .map_err(storage_error)?;
    let Some(before) = before else {
        return Ok(AdminUserAccessUpdate::Missing);
    };
    let after = sqlx::query_as::<_, IdentityAccessStateRow>(
        "UPDATE identity_subjects SET \
         login_disabled_at = CASE WHEN $2 THEN COALESCE(login_disabled_at, NOW()) ELSE NULL END, \
         banned_until = $3::timestamptz, updated_at = NOW() \
         WHERE id = $1 \
         RETURNING to_char(login_disabled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS login_disabled_at, \
                   to_char(banned_until AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS banned_until",
    )
    .bind(target_subject_id)
    .bind(form.login_disabled)
    .bind(&form.banned_until)
    .fetch_one(&mut *identity_transaction)
    .await
    .map_err(storage_error)?;

    sqlx::query("DELETE FROM application_principal_roles WHERE principal_id = $1")
        .bind(target_principal_id)
        .execute(&mut *application_transaction)
        .await
        .map_err(storage_error)?;
    for role_key in &form.roles {
        sqlx::query(
            "INSERT INTO application_principal_roles (principal_id, role_key) VALUES ($1, $2)",
        )
        .bind(target_principal_id)
        .bind(role_key)
        .execute(&mut *application_transaction)
        .await
        .map_err(storage_error)?;
    }
    let changes = access_changes(&before, &after, &previous_roles, &form.roles);
    if changes
        .as_object()
        .is_some_and(|changes| !changes.is_empty())
    {
        sqlx::query(
            "INSERT INTO application_access_change_events \
             (id, action, actor_subject_id, target_subject_id, changes) \
             VALUES ($1, 'access_updated', $2, $3, $4)",
        )
        .bind(Uuid::new_v4())
        .bind(actor_subject_id)
        .bind(target_subject_id)
        .bind(changes)
        .execute(&mut *application_transaction)
        .await
        .map_err(storage_error)?;
    }

    identity_transaction.commit().await.map_err(storage_error)?;
    if let Err(error) = application_transaction.commit().await {
        tracing::error!(%error, %target_subject_id, "could not commit application access change; compensating identity state");
        compensate_identity_access(identity_pool, target_subject_id, &before).await;
        return Err(AdminUserError);
    }
    Ok(AdminUserAccessUpdate::Updated)
}

async fn compensate_identity_access(
    identity_pool: &PgPool,
    subject_id: Uuid,
    before: &IdentityAccessStateRow,
) {
    if let Err(error) = sqlx::query(
        "UPDATE identity_subjects SET login_disabled_at = $2::timestamptz, banned_until = $3::timestamptz, updated_at = NOW() WHERE id = $1",
    )
    .bind(subject_id)
    .bind(&before.login_disabled_at)
    .bind(&before.banned_until)
    .execute(identity_pool)
    .await
    {
        tracing::error!(%error, %subject_id, "could not compensate identity access state");
    }
}

fn access_changes(
    before: &IdentityAccessStateRow,
    after: &IdentityAccessStateRow,
    previous_roles: &[String],
    roles: &[String],
) -> Value {
    let mut changes = serde_json::Map::new();
    if before.login_disabled_at.is_some() != after.login_disabled_at.is_some() {
        changes.insert(
            "login_disabled".to_owned(),
            json!({ "before": before.login_disabled_at.is_some(), "after": after.login_disabled_at.is_some() }),
        );
    }
    if before.banned_until != after.banned_until {
        changes.insert(
            "banned_until".to_owned(),
            json!({ "before": before.banned_until, "after": after.banned_until }),
        );
    }
    if previous_roles != roles {
        changes.insert(
            "roles".to_owned(),
            json!({ "before": previous_roles, "after": roles }),
        );
    }
    Value::Object(changes)
}

fn access_change_items(changes: &Value) -> Vec<AdminAccessChangeItem> {
    let labels = [
        ("banned_until", "Ban until"),
        ("login_disabled", "Login disabled"),
        ("roles", "Roles"),
    ];
    labels
        .into_iter()
        .filter_map(|(key, label)| {
            let values = changes.get(key)?;
            Some(AdminAccessChangeItem {
                after: access_change_value(values.get("after")),
                before: access_change_value(values.get("before")),
                label: label.to_owned(),
            })
        })
        .collect()
}

fn access_change_value(value: Option<&Value>) -> String {
    match value {
        None | Some(Value::Null) => "Not set".to_owned(),
        Some(Value::Bool(value)) => if *value { "Yes" } else { "No" }.to_owned(),
        Some(Value::String(value)) => value.clone(),
        Some(Value::Array(values)) => values
            .iter()
            .filter_map(Value::as_str)
            .collect::<Vec<_>>()
            .join(", "),
        Some(value) => value.to_string(),
    }
}

fn storage_error(error: sqlx::Error) -> AdminUserError {
    tracing::error!(%error, "could not persist administrative user access");
    AdminUserError
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

fn registration_token_roles(value: &Value) -> Vec<String> {
    let roles = value
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .filter(|role| !role.is_empty())
        .map(str::to_owned)
        .collect::<Vec<_>>();
    if roles.is_empty() {
        vec!["learner".to_owned()]
    } else {
        roles
    }
}
