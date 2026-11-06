use std::collections::{BTreeSet, HashMap};

use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_learning_group::{
    AdminLearningGroupError, AdminLearningGroupRepository as AdminLearningGroupRepositoryPort,
    LearningGroupForm,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        AdminLearningGroup, AdminLearningGroupMessage, AdminLearningGroupUser, AdminLearningGroups,
    },
};

const ADMIN_MESSAGES_PER_GROUP: i64 = 80;

pub struct PostgresAdminLearningGroupRepository<'pool> {
    application_pool: &'pool PgPool,
    identity_pool: &'pool PgPool,
}

impl<'pool> PostgresAdminLearningGroupRepository<'pool> {
    pub fn new(application_pool: &'pool PgPool, identity_pool: &'pool PgPool) -> Self {
        Self {
            application_pool,
            identity_pool,
        }
    }
}

#[derive(FromRow)]
struct GroupRow {
    admin_chat_visible_enabled: bool,
    admin_chat_visible_until: Option<String>,
    description: Option<String>,
    id: Uuid,
    name: String,
    slug: String,
    study_topic: Option<String>,
}

#[derive(FromRow)]
struct PrincipalRow {
    principal_id: Uuid,
    subject_id: Uuid,
}

#[derive(FromRow)]
struct MessageRow {
    body: String,
    created_at: String,
    id: Uuid,
    principal_id: Uuid,
}

#[derive(FromRow)]
struct IdentityRow {
    display_name: String,
    normalized_email: String,
    subject_id: Uuid,
}

#[derive(Clone)]
struct IdentityProjection {
    email: String,
    name: String,
}

impl AdminLearningGroupRepositoryPort for PostgresAdminLearningGroupRepository<'_> {
    fn list(
        &self,
    ) -> impl std::future::Future<Output = Result<AdminLearningGroups, AdminLearningGroupError>> + Send
    {
        async move {
            let groups = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM learning_groups ORDER BY name ASC, id ASC",
            )
            .fetch_all(self.application_pool)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not list learning groups for administration");
                AdminLearningGroupError
            })?;
            let mut projected_groups = Vec::with_capacity(groups.len());
            for group_id in groups {
                if let Some(group) =
                    load_group(self.application_pool, self.identity_pool, group_id).await.map_err(|error| {
                        tracing::error!(%error, "could not project an administrative learning group");
                        AdminLearningGroupError
                    })?
                {
                    projected_groups.push(group);
                }
            }
            let users = load_all_users(self.application_pool, self.identity_pool)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not project administrative learning group members");
                    AdminLearningGroupError
                })?;
            Ok(AdminLearningGroups {
                groups: projected_groups,
                users,
            })
        }
    }

    fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &LearningGroupForm,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminLearningGroup>, AdminLearningGroupError>,
    > + Send {
        async move {
            let mut transaction = self.application_pool.begin().await.map_err(|error| {
                tracing::error!(%error, "could not begin learning group creation");
                AdminLearningGroupError
            })?;
            let Some(creator_id) = principal_id(&mut transaction, principal.subject_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not resolve learning group creator principal");
                    AdminLearningGroupError
                })?
            else {
                return Ok(None);
            };
            let slug = if let Some(slug) = &form.slug {
                slug.clone()
            } else {
                next_slug(&mut transaction, &form.name)
                    .await
                    .map_err(|error| {
                        tracing::error!(%error, "could not generate learning group slug");
                        AdminLearningGroupError
                    })?
            };
            let group_id = Uuid::new_v4();
            let created = sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO learning_groups (id, created_by_principal_id, name, slug, description, study_topic) \
                 VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (slug) DO NOTHING RETURNING id",
            )
            .bind(group_id)
            .bind(creator_id)
            .bind(&form.name)
            .bind(&slug)
            .bind(&form.description)
            .bind(&form.study_topic)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not create learning group");
                AdminLearningGroupError
            })?;
            if created.is_none() {
                return Ok(None);
            }
            transaction.commit().await.map_err(|error| {
                tracing::error!(%error, "could not commit learning group creation");
                AdminLearningGroupError
            })?;
            load_group(self.application_pool, self.identity_pool, group_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load created learning group");
                    AdminLearningGroupError
                })
        }
    }

    fn update(
        &self,
        group_id: Uuid,
        form: &LearningGroupForm,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminLearningGroup>, AdminLearningGroupError>,
    > + Send {
        async move {
            let mut transaction = self.application_pool.begin().await.map_err(|error| {
                tracing::error!(%error, "could not begin learning group update");
                AdminLearningGroupError
            })?;
            let current_slug = sqlx::query_scalar::<_, String>(
                "SELECT slug FROM learning_groups WHERE id = $1 FOR UPDATE",
            )
            .bind(group_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not lock learning group update");
                AdminLearningGroupError
            })?;
            let Some(current_slug) = current_slug else {
                return Ok(None);
            };
            let slug = form.slug.as_deref().unwrap_or(&current_slug);
            let updated = sqlx::query_scalar::<_, Uuid>(
                "UPDATE learning_groups SET name = $2, slug = $3, description = $4, study_topic = $5, updated_at = NOW() \
                 WHERE id = $1 AND (slug = $3 OR NOT EXISTS (SELECT 1 FROM learning_groups AS conflicting WHERE conflicting.slug = $3)) \
                 RETURNING id",
            )
            .bind(group_id)
            .bind(&form.name)
            .bind(slug)
            .bind(&form.description)
            .bind(&form.study_topic)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not update learning group");
                AdminLearningGroupError
            })?;
            if updated.is_none() {
                return Ok(None);
            }
            transaction.commit().await.map_err(|error| {
                tracing::error!(%error, "could not commit learning group update");
                AdminLearningGroupError
            })?;
            load_group(self.application_pool, self.identity_pool, group_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load updated learning group");
                    AdminLearningGroupError
                })
        }
    }

    fn sync_members(
        &self,
        group_id: Uuid,
        member_subject_ids: &[Uuid],
    ) -> impl std::future::Future<
        Output = Result<Option<AdminLearningGroup>, AdminLearningGroupError>,
    > + Send {
        async move {
            let requested_subjects = member_subject_ids.iter().copied().collect::<BTreeSet<_>>();
            let mut transaction = self.application_pool.begin().await.map_err(|error| {
                tracing::error!(%error, "could not begin learning group membership update");
                AdminLearningGroupError
            })?;
            let Some(visible) = sqlx::query_scalar::<_, bool>(
                "SELECT admin_chat_visible_enabled FROM learning_groups WHERE id = $1 FOR UPDATE",
            )
            .bind(group_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not lock learning group membership update");
                AdminLearningGroupError
            })?
            else {
                return Ok(None);
            };
            let requested_principals = sqlx::query_as::<_, PrincipalRow>(
                "SELECT id AS principal_id, identity_subject_id AS subject_id FROM application_principals WHERE identity_subject_id = ANY($1)",
            )
            .bind(requested_subjects.iter().copied().collect::<Vec<_>>())
            .fetch_all(&mut *transaction)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not resolve requested learning group members");
                AdminLearningGroupError
            })?;
            if requested_principals.len() != requested_subjects.len() {
                return Ok(None);
            }
            let requested_principal_ids = requested_principals
                .iter()
                .map(|row| row.principal_id)
                .collect::<BTreeSet<_>>();
            let current_principal_ids = sqlx::query_scalar::<_, Uuid>(
                "SELECT principal_id FROM learning_group_memberships WHERE group_id = $1",
            )
            .bind(group_id)
            .fetch_all(&mut *transaction)
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not read current learning group members");
                AdminLearningGroupError
            })?
            .into_iter()
            .collect::<BTreeSet<_>>();
            if current_principal_ids != requested_principal_ids {
                let has_new_members = requested_principal_ids
                    .iter()
                    .any(|principal_id| !current_principal_ids.contains(principal_id));
                sqlx::query(
                    "DELETE FROM learning_group_memberships WHERE group_id = $1 AND NOT (principal_id = ANY($2))",
                )
                .bind(group_id)
                .bind(requested_principal_ids.iter().copied().collect::<Vec<_>>())
                .execute(&mut *transaction)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not remove learning group members");
                    AdminLearningGroupError
                })?;
                for principal_id in &requested_principal_ids {
                    sqlx::query(
                        "INSERT INTO learning_group_memberships (group_id, principal_id, joined_at, role) \
                         VALUES ($1, $2, NOW(), 'member') ON CONFLICT (group_id, principal_id) DO NOTHING",
                    )
                    .bind(group_id)
                    .bind(principal_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|error| {
                        tracing::error!(%error, "could not add learning group member");
                        AdminLearningGroupError
                    })?;
                }
                sqlx::query("DELETE FROM learning_group_admin_chat_votes WHERE group_id = $1")
                    .bind(group_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|error| {
                        tracing::error!(%error, "could not reset learning group consent votes");
                        AdminLearningGroupError
                    })?;
                if has_new_members && visible {
                    sqlx::query(
                        "UPDATE learning_groups SET admin_chat_visible_enabled = FALSE, admin_chat_visible_until = NOW(), updated_at = NOW() WHERE id = $1",
                    )
                    .bind(group_id)
                    .execute(&mut *transaction)
                    .await
                    .map_err(|error| {
                        tracing::error!(%error, "could not end expired learning group chat visibility");
                        AdminLearningGroupError
                    })?;
                }
            }
            transaction.commit().await.map_err(|error| {
                tracing::error!(%error, "could not commit learning group membership update");
                AdminLearningGroupError
            })?;
            load_group(self.application_pool, self.identity_pool, group_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not load learning group after membership update");
                    AdminLearningGroupError
                })
        }
    }
}

async fn principal_id(
    transaction: &mut Transaction<'_, Postgres>,
    subject_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(subject_id)
        .fetch_optional(&mut **transaction)
        .await
}

async fn next_slug(
    transaction: &mut Transaction<'_, Postgres>,
    name: &str,
) -> Result<String, sqlx::Error> {
    let base = slug_base(name);
    let mut candidate = base.clone();
    let mut suffix = 2;
    while sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learning_groups WHERE slug = $1)",
    )
    .bind(&candidate)
    .fetch_one(&mut **transaction)
    .await?
    {
        let available = 140usize.saturating_sub(suffix.to_string().len() + 1);
        candidate = format!("{}-{suffix}", &base[..base.len().min(available)]);
        suffix += 1;
    }
    Ok(candidate)
}

/// The source generates a hyphenated fallback slug if an administrator leaves
/// the optional field blank. Explicit source slugs keep their alpha-dash form.
fn slug_base(name: &str) -> String {
    let mut slug = String::new();
    let mut previous_was_separator = false;
    for character in name.chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
            previous_was_separator = false;
        } else if !slug.is_empty() && !previous_was_separator {
            slug.push('-');
            previous_was_separator = true;
        }
    }
    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        "group".to_owned()
    } else {
        slug.chars().take(140).collect()
    }
}

async fn load_group(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    group_id: Uuid,
) -> Result<Option<AdminLearningGroup>, sqlx::Error> {
    let Some(group) = sqlx::query_as::<_, GroupRow>(
        "SELECT admin_chat_visible_enabled, \
         CASE WHEN admin_chat_visible_until IS NULL THEN NULL ELSE to_char(admin_chat_visible_until AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') END AS admin_chat_visible_until, \
         description, id, name, slug, study_topic FROM learning_groups WHERE id = $1",
    )
    .bind(group_id)
    .fetch_optional(application_pool)
    .await?
    else {
        return Ok(None);
    };
    let member_rows = sqlx::query_as::<_, PrincipalRow>(
        "SELECT principals.id AS principal_id, principals.identity_subject_id AS subject_id \
         FROM learning_group_memberships AS memberships \
         INNER JOIN application_principals AS principals ON principals.id = memberships.principal_id \
         WHERE memberships.group_id = $1 ORDER BY memberships.joined_at ASC, principals.id ASC",
    )
    .bind(group_id)
    .fetch_all(application_pool)
    .await?;
    let messages = sqlx::query_as::<_, MessageRow>(
        "SELECT body, created_at, id, principal_id FROM ( \
             SELECT messages.body, to_char(messages.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, \
                    messages.id, messages.principal_id, messages.created_at AS created_sort \
             FROM learning_group_messages AS messages \
             WHERE messages.group_id = $1 AND ($2 OR ($3 IS NOT NULL AND messages.created_at <= $3::timestamptz)) \
             ORDER BY messages.created_at DESC, messages.id DESC LIMIT $4 \
         ) AS recent ORDER BY created_sort ASC, id ASC",
    )
    .bind(group_id)
    .bind(group.admin_chat_visible_enabled)
    .bind(&group.admin_chat_visible_until)
    .bind(ADMIN_MESSAGES_PER_GROUP)
    .fetch_all(application_pool)
    .await?;
    let vote_principals = sqlx::query_scalar::<_, Uuid>(
        "SELECT principal_id FROM learning_group_admin_chat_votes WHERE group_id = $1 ORDER BY principal_id ASC",
    )
    .bind(group_id)
    .fetch_all(application_pool)
    .await?;
    let principal_ids = member_rows
        .iter()
        .map(|row| row.principal_id)
        .chain(messages.iter().map(|row| row.principal_id))
        .chain(vote_principals.iter().copied())
        .collect::<BTreeSet<_>>();
    let subjects_by_principal = application_subjects(application_pool, &principal_ids).await?;
    let identities = load_identities(
        identity_pool,
        &subjects_by_principal.values().copied().collect::<Vec<_>>(),
    )
    .await?;
    let user_for_principal = |principal_id: Uuid| -> Option<AdminLearningGroupUser> {
        let subject_id = subjects_by_principal.get(&principal_id)?;
        let identity = identities.get(subject_id)?;
        Some(AdminLearningGroupUser {
            email: identity.email.clone(),
            id: subject_id.to_string(),
            name: identity.name.clone(),
        })
    };
    let members = member_rows
        .iter()
        .filter_map(|row| user_for_principal(row.principal_id))
        .collect::<Vec<_>>();
    let member_ids = members
        .iter()
        .map(|member| member.id.clone())
        .collect::<Vec<_>>();
    let messages = messages
        .into_iter()
        .map(|message| AdminLearningGroupMessage {
            body: message.body,
            created_at: message.created_at,
            id: message.id.to_string(),
            user: user_for_principal(message.principal_id),
        })
        .collect::<Vec<_>>();
    let vote_user_ids = vote_principals
        .into_iter()
        .filter_map(|principal_id| user_for_principal(principal_id).map(|user| user.id))
        .collect::<Vec<_>>();
    let member_count = members.len() as i64;
    Ok(Some(AdminLearningGroup {
        admin_chat_required_votes: member_count / 2 + 1,
        admin_chat_visible: group.admin_chat_visible_enabled,
        admin_chat_visible_until: group.admin_chat_visible_until,
        admin_chat_vote_count: vote_user_ids.len() as i64,
        description: group.description,
        id: group.id.to_string(),
        member_count,
        member_ids,
        members,
        messages,
        name: group.name,
        slug: group.slug,
        study_topic: group.study_topic,
        vote_user_ids,
    }))
}

async fn load_all_users(
    application_pool: &PgPool,
    identity_pool: &PgPool,
) -> Result<Vec<AdminLearningGroupUser>, sqlx::Error> {
    let principals = sqlx::query_as::<_, PrincipalRow>(
        "SELECT id AS principal_id, identity_subject_id AS subject_id FROM application_principals",
    )
    .fetch_all(application_pool)
    .await?;
    let identities = load_identities(
        identity_pool,
        &principals
            .iter()
            .map(|principal| principal.subject_id)
            .collect::<Vec<_>>(),
    )
    .await?;
    let mut users = principals
        .into_iter()
        .filter_map(|principal| {
            identities
                .get(&principal.subject_id)
                .map(|identity| AdminLearningGroupUser {
                    email: identity.email.clone(),
                    id: principal.subject_id.to_string(),
                    name: identity.name.clone(),
                })
        })
        .collect::<Vec<_>>();
    users.sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
    Ok(users)
}

async fn application_subjects(
    application_pool: &PgPool,
    principal_ids: &BTreeSet<Uuid>,
) -> Result<HashMap<Uuid, Uuid>, sqlx::Error> {
    if principal_ids.is_empty() {
        return Ok(HashMap::new());
    }
    sqlx::query_as::<_, PrincipalRow>(
        "SELECT id AS principal_id, identity_subject_id AS subject_id FROM application_principals WHERE id = ANY($1)",
    )
    .bind(principal_ids.iter().copied().collect::<Vec<_>>())
    .fetch_all(application_pool)
    .await
    .map(|rows| {
        rows.into_iter()
            .map(|row| (row.principal_id, row.subject_id))
            .collect()
    })
}

async fn load_identities(
    identity_pool: &PgPool,
    subject_ids: &[Uuid],
) -> Result<HashMap<Uuid, IdentityProjection>, sqlx::Error> {
    let subject_ids = subject_ids.iter().copied().collect::<BTreeSet<_>>();
    if subject_ids.is_empty() {
        return Ok(HashMap::new());
    }
    sqlx::query_as::<_, IdentityRow>(
        "SELECT subjects.id AS subject_id, subjects.normalized_email, profiles.display_name \
         FROM identity_subjects AS subjects \
         INNER JOIN identity_profiles AS profiles ON profiles.subject_id = subjects.id \
         WHERE subjects.id = ANY($1)",
    )
    .bind(subject_ids.into_iter().collect::<Vec<_>>())
    .fetch_all(identity_pool)
    .await
    .map(|rows| {
        rows.into_iter()
            .map(|row| {
                (
                    row.subject_id,
                    IdentityProjection {
                        email: row.normalized_email,
                        name: row.display_name,
                    },
                )
            })
            .collect()
    })
}

#[cfg(test)]
mod tests {
    use super::slug_base;

    #[test]
    fn source_fallback_group_slugs_are_bounded_hyphenated_identifiers() {
        assert_eq!(slug_base(" Study circle: memory "), "study-circle-memory");
        assert_eq!(slug_base("___"), "group");
        assert_eq!(slug_base(&"x".repeat(200)).len(), 140);
    }
}
