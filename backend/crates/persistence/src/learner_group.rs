use std::collections::{BTreeSet, HashMap};

use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_group::{
    LearnerGroupError, LearnerGroupRepository as LearnerGroupRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{
        LearnerGroup, LearnerGroupMember, LearnerGroupMessage, LearnerGroupPage,
        LearnerGroupPagination,
    },
};

const MESSAGES_PER_GROUP: i64 = 40;

pub struct PostgresLearnerGroupRepository<'pool> {
    application_pool: &'pool PgPool,
    identity_pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerGroupRepository<'pool> {
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
struct MemberRow {
    identity_subject_id: Uuid,
    principal_id: Uuid,
}

#[derive(FromRow)]
struct MessageRow {
    body: String,
    created_at: String,
    id: Uuid,
    is_help_request: bool,
    principal_id: Uuid,
    resolved_at: Option<String>,
    resolved_by_principal_id: Option<Uuid>,
}

#[derive(FromRow)]
struct IdentityRow {
    display_name: String,
    normalized_email: String,
    subject_id: Uuid,
}

#[derive(FromRow)]
struct ResolutionRow {
    is_help_request: bool,
    principal_id: Uuid,
    resolved_at: Option<String>,
}

#[derive(Clone)]
struct IdentityProjection {
    email: String,
    name: String,
}

impl LearnerGroupRepositoryPort for PostgresLearnerGroupRepository<'_> {
    fn list(
        &self,
        principal: &AuthorizedPrincipal,
        page: i64,
        per_page: i64,
    ) -> impl std::future::Future<Output = Result<LearnerGroupPage, LearnerGroupError>> + Send {
        async move {
            list(
                self.application_pool,
                self.identity_pool,
                principal,
                page,
                per_page,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not load member-only learning groups");
                LearnerGroupError
            })
        }
    }

    fn send_message(
        &self,
        principal: &AuthorizedPrincipal,
        group_id: Uuid,
        body: &str,
        is_help_request: bool,
    ) -> impl std::future::Future<Output = Result<Option<LearnerGroup>, LearnerGroupError>> + Send
    {
        async move {
            send_message(
                self.application_pool,
                self.identity_pool,
                principal,
                group_id,
                body,
                is_help_request,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not send a learning group message");
                LearnerGroupError
            })
        }
    }

    fn resolve_help_request(
        &self,
        principal: &AuthorizedPrincipal,
        group_id: Uuid,
        message_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<LearnerGroup>, LearnerGroupError>> + Send
    {
        async move {
            resolve_help_request(
                self.application_pool,
                self.identity_pool,
                principal,
                group_id,
                message_id,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not resolve a learning group help request");
                LearnerGroupError
            })
        }
    }

    fn vote_for_admin_chat_access(
        &self,
        principal: &AuthorizedPrincipal,
        group_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<LearnerGroup>, LearnerGroupError>> + Send
    {
        async move {
            vote_for_admin_chat_access(
                self.application_pool,
                self.identity_pool,
                principal,
                group_id,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not save a learning group admin-chat vote");
                LearnerGroupError
            })
        }
    }
}

async fn list(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    principal: &AuthorizedPrincipal,
    page: i64,
    per_page: i64,
) -> Result<LearnerGroupPage, sqlx::Error> {
    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM learning_group_memberships AS memberships \
         INNER JOIN application_principals AS principals ON principals.id = memberships.principal_id \
         WHERE principals.identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_one(application_pool)
    .await?;
    let last_page = ((total + per_page - 1) / per_page).max(1);
    let current_page = page.min(last_page);
    let group_ids = sqlx::query_scalar::<_, Uuid>(
        "SELECT groups.id FROM learning_groups AS groups \
         INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.id \
         INNER JOIN application_principals AS principals ON principals.id = memberships.principal_id \
         WHERE principals.identity_subject_id = $1 \
         ORDER BY groups.name ASC, groups.id ASC LIMIT $2 OFFSET $3",
    )
    .bind(principal.subject_id)
    .bind(per_page)
    .bind((current_page - 1) * per_page)
    .fetch_all(application_pool)
    .await?;

    // The source permits at most twelve group cards per page. Each card uses
    // separately bounded members/messages, so this remains a bounded private
    // projection rather than an unbounded chat-history read.
    let mut groups = Vec::with_capacity(group_ids.len());
    for group_id in group_ids {
        if let Some(group) =
            load_group(application_pool, identity_pool, principal, group_id).await?
        {
            groups.push(group);
        }
    }
    Ok(LearnerGroupPage {
        groups,
        pagination: LearnerGroupPagination {
            current_page,
            last_page,
            per_page,
            total,
        },
    })
}

async fn send_message(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    principal: &AuthorizedPrincipal,
    group_id: Uuid,
    body: &str,
    is_help_request: bool,
) -> Result<Option<LearnerGroup>, sqlx::Error> {
    let mut transaction = application_pool.begin().await?;
    let Some(principal_id) = locked_member_principal(&mut transaction, principal, group_id).await?
    else {
        return Ok(None);
    };
    let blocked = sqlx::query_scalar::<_, bool>(
        "SELECT COALESCE(COUNT(*) = 2 AND BOOL_AND(principal_id = $2) \
             AND MIN(created_at) >= NOW() - INTERVAL '60 seconds', false) \
         FROM (SELECT principal_id, created_at FROM learning_group_messages \
               WHERE group_id = $1 ORDER BY created_at DESC, id DESC LIMIT 2) AS latest",
    )
    .bind(group_id)
    .bind(principal_id)
    .fetch_one(&mut *transaction)
    .await?;
    if blocked {
        return Ok(None);
    }
    sqlx::query(
        "INSERT INTO learning_group_messages (id, group_id, principal_id, body, is_help_request) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(Uuid::new_v4())
    .bind(group_id)
    .bind(principal_id)
    .bind(body)
    .bind(is_help_request)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    load_group(application_pool, identity_pool, principal, group_id).await
}

async fn resolve_help_request(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    principal: &AuthorizedPrincipal,
    group_id: Uuid,
    message_id: Uuid,
) -> Result<Option<LearnerGroup>, sqlx::Error> {
    let mut transaction = application_pool.begin().await?;
    let Some(principal_id) = locked_member_principal(&mut transaction, principal, group_id).await?
    else {
        return Ok(None);
    };
    let Some(message) = sqlx::query_as::<_, ResolutionRow>(
        "SELECT is_help_request, principal_id, \
             CASE WHEN resolved_at IS NULL THEN NULL ELSE to_char(resolved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') END AS resolved_at \
         FROM learning_group_messages WHERE id = $1 AND group_id = $2 FOR UPDATE",
    )
    .bind(message_id)
    .bind(group_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    if !message.is_help_request || message.principal_id == principal_id {
        return Ok(None);
    }
    if message.resolved_at.is_none() {
        sqlx::query(
            "UPDATE learning_group_messages SET resolved_at = NOW(), resolved_by_principal_id = $2 \
             WHERE id = $1",
        )
        .bind(message_id)
        .bind(principal_id)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;
    load_group(application_pool, identity_pool, principal, group_id).await
}

async fn vote_for_admin_chat_access(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    principal: &AuthorizedPrincipal,
    group_id: Uuid,
) -> Result<Option<LearnerGroup>, sqlx::Error> {
    let mut transaction = application_pool.begin().await?;
    let Some(principal_id) = locked_member_principal(&mut transaction, principal, group_id).await?
    else {
        return Ok(None);
    };
    sqlx::query(
        "INSERT INTO learning_group_admin_chat_votes (group_id, principal_id) VALUES ($1, $2) \
         ON CONFLICT (group_id, principal_id) DO NOTHING",
    )
    .bind(group_id)
    .bind(principal_id)
    .execute(&mut *transaction)
    .await?;
    let member_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM learning_group_memberships WHERE group_id = $1",
    )
    .bind(group_id)
    .fetch_one(&mut *transaction)
    .await?;
    let vote_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM learning_group_admin_chat_votes WHERE group_id = $1",
    )
    .bind(group_id)
    .fetch_one(&mut *transaction)
    .await?;
    if vote_count >= member_count / 2 + 1 {
        sqlx::query(
            "UPDATE learning_groups SET admin_chat_visible_enabled = TRUE, \
             admin_chat_visible_until = NULL, updated_at = NOW() WHERE id = $1",
        )
        .bind(group_id)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;
    load_group(application_pool, identity_pool, principal, group_id).await
}

/// Locks the group first so a pair of concurrent sends cannot both observe an
/// empty/latest history and bypass the source consecutive-message rule.
async fn locked_member_principal(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    group_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    let group_exists =
        sqlx::query_scalar::<_, Uuid>("SELECT id FROM learning_groups WHERE id = $1 FOR UPDATE")
            .bind(group_id)
            .fetch_optional(&mut **transaction)
            .await?
            .is_some();
    if !group_exists {
        return Ok(None);
    }
    sqlx::query_scalar::<_, Uuid>(
        "SELECT principals.id FROM application_principals AS principals \
         INNER JOIN learning_group_memberships AS memberships ON memberships.principal_id = principals.id \
         WHERE principals.identity_subject_id = $1 AND memberships.group_id = $2",
    )
    .bind(principal.subject_id)
    .bind(group_id)
    .fetch_optional(&mut **transaction)
    .await
}

async fn load_group(
    application_pool: &PgPool,
    identity_pool: &PgPool,
    principal: &AuthorizedPrincipal,
    group_id: Uuid,
) -> Result<Option<LearnerGroup>, sqlx::Error> {
    let Some(current_principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT principals.id FROM application_principals AS principals \
         INNER JOIN learning_group_memberships AS memberships ON memberships.principal_id = principals.id \
         WHERE principals.identity_subject_id = $1 AND memberships.group_id = $2",
    )
    .bind(principal.subject_id)
    .bind(group_id)
    .fetch_optional(application_pool)
    .await?
    else {
        return Ok(None);
    };
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
    let members = sqlx::query_as::<_, MemberRow>(
        "SELECT principals.identity_subject_id, principals.id AS principal_id \
         FROM learning_group_memberships AS memberships \
         INNER JOIN application_principals AS principals ON principals.id = memberships.principal_id \
         WHERE memberships.group_id = $1 ORDER BY memberships.joined_at ASC, principals.id ASC",
    )
    .bind(group_id)
    .fetch_all(application_pool)
    .await?;
    let messages = sqlx::query_as::<_, MessageRow>(
        "SELECT body, created_at, id, is_help_request, principal_id, resolved_at, resolved_by_principal_id \
         FROM (SELECT messages.body, \
                      to_char(messages.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, \
                      messages.id, messages.is_help_request, messages.principal_id, \
                      CASE WHEN messages.resolved_at IS NULL THEN NULL ELSE to_char(messages.resolved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') END AS resolved_at, \
                      messages.resolved_by_principal_id, messages.created_at AS created_sort \
               FROM learning_group_messages AS messages \
               WHERE messages.group_id = $1 ORDER BY messages.created_at DESC, messages.id DESC LIMIT $2) AS recent \
         ORDER BY created_sort ASC, id ASC",
    )
    .bind(group_id)
    .bind(MESSAGES_PER_GROUP)
    .fetch_all(application_pool)
    .await?;
    let vote_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM learning_group_admin_chat_votes WHERE group_id = $1",
    )
    .bind(group_id)
    .fetch_one(application_pool)
    .await?;
    let current_user_voted_for_admin_chat = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM learning_group_admin_chat_votes \
         WHERE group_id = $1 AND principal_id = $2)",
    )
    .bind(group_id)
    .bind(current_principal_id)
    .fetch_one(application_pool)
    .await?;

    let principal_ids = members
        .iter()
        .map(|member| member.principal_id)
        .chain(messages.iter().map(|message| message.principal_id))
        .chain(
            messages
                .iter()
                .filter_map(|message| message.resolved_by_principal_id),
        )
        .collect::<BTreeSet<_>>();
    let identity_subject_ids = sqlx::query_as::<_, MemberRow>(
        "SELECT identity_subject_id, id AS principal_id FROM application_principals WHERE id = ANY($1)",
    )
    .bind(principal_ids.into_iter().collect::<Vec<_>>())
    .fetch_all(application_pool)
    .await?;
    let subjects_by_principal = identity_subject_ids
        .into_iter()
        .map(|row| (row.principal_id, row.identity_subject_id))
        .collect::<HashMap<_, _>>();
    let identities = load_identities(
        identity_pool,
        &subjects_by_principal.values().copied().collect::<Vec<_>>(),
    )
    .await?;
    let member_projection = |principal_id: Uuid| -> Result<LearnerGroupMember, sqlx::Error> {
        let Some(subject_id) = subjects_by_principal.get(&principal_id) else {
            return Err(sqlx::Error::RowNotFound);
        };
        let Some(identity) = identities.get(subject_id) else {
            return Err(sqlx::Error::RowNotFound);
        };
        Ok(LearnerGroupMember {
            email: identity.email.clone(),
            id: principal_id.to_string(),
            name: identity.name.clone(),
        })
    };
    let members = members
        .into_iter()
        .map(|member| member_projection(member.principal_id))
        .collect::<Result<Vec<_>, _>>()?;
    let messages = messages
        .into_iter()
        .map(|message| {
            Ok(LearnerGroupMessage {
                body: message.body,
                can_resolve: message.is_help_request
                    && message.resolved_at.is_none()
                    && message.principal_id != current_principal_id,
                created_at: message.created_at,
                id: message.id.to_string(),
                is_help_request: message.is_help_request,
                resolved_at: message.resolved_at,
                resolved_by: message
                    .resolved_by_principal_id
                    .map(member_projection)
                    .transpose()?,
                user: member_projection(message.principal_id)?,
            })
        })
        .collect::<Result<Vec<_>, sqlx::Error>>()?;
    let member_count = members.len() as i64;
    Ok(Some(LearnerGroup {
        admin_chat_required_votes: member_count / 2 + 1,
        admin_chat_visible: group.admin_chat_visible_enabled,
        admin_chat_visible_until: group.admin_chat_visible_until,
        admin_chat_vote_count: vote_count,
        current_user_voted_for_admin_chat,
        description: group.description,
        id: group.id.to_string(),
        member_count,
        members,
        messages,
        name: group.name,
        slug: group.slug,
        study_topic: group.study_topic,
    }))
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
