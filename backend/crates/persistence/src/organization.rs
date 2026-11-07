use std::collections::{BTreeSet, HashMap};

use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::organization::{
    OrganizationError, OrganizationForm, OrganizationRepository as OrganizationRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    organization::{
        OrganizationDetail, OrganizationDirectory, OrganizationIdentity, OrganizationJoinRequest,
        OrganizationMembership, OrganizationMessage, OrganizationPagination, OrganizationSummary,
    },
};

const DIRECTORY_PER_PAGE: i64 = 12;
const DETAIL_PER_PAGE: i64 = 8;

pub struct PostgresOrganizationRepository<'pool> {
    application_pool: &'pool PgPool,
    identity_pool: &'pool PgPool,
}

impl<'pool> PostgresOrganizationRepository<'pool> {
    pub fn new(application_pool: &'pool PgPool, identity_pool: &'pool PgPool) -> Self {
        Self {
            application_pool,
            identity_pool,
        }
    }
}

#[derive(FromRow)]
struct OrganizationRow {
    description: Option<String>,
    governance_type: String,
    id: Uuid,
    leadership_rotated_at: Option<String>,
    name: String,
    slogan: Option<String>,
    slug: String,
}
#[derive(FromRow)]
struct MembershipRow {
    id: Uuid,
    joined_at: String,
    role: String,
    subject_id: Uuid,
}
#[derive(FromRow)]
struct JoinRequestRow {
    created_at: String,
    id: Uuid,
    message: Option<String>,
    status: String,
    subject_id: Uuid,
}
#[derive(FromRow)]
struct MessageRow {
    body: String,
    created_at: String,
    hidden_at: Option<String>,
    id: Uuid,
    principal_id: Uuid,
    subject_id: Uuid,
}
#[derive(FromRow)]
struct IdentityRow {
    display_name: String,
    subject_id: Uuid,
}

impl OrganizationRepositoryPort for PostgresOrganizationRepository<'_> {
    fn list(
        &self,
        principal: &AuthorizedPrincipal,
        page: i64,
        search: Option<&str>,
    ) -> impl std::future::Future<Output = Result<OrganizationDirectory, OrganizationError>> + Send
    {
        async move {
            list(
                self.application_pool,
                self.identity_pool,
                principal,
                page,
                search,
            )
            .await
            .map_err(log_error("could not list organizations"))
        }
    }
    fn show(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
        members_page: i64,
        messages_page: i64,
        join_requests_page: i64,
    ) -> impl std::future::Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send
    {
        async move {
            load_detail_by_slug(
                self.application_pool,
                self.identity_pool,
                principal,
                slug,
                members_page,
                messages_page,
                join_requests_page,
            )
            .await
            .map_err(log_error("could not load organization"))
        }
    }
    fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &OrganizationForm,
    ) -> impl std::future::Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send
    {
        async move {
            let mut transaction = self
                .application_pool
                .begin()
                .await
                .map_err(log_error("could not begin organization creation"))?;
            let Some(principal_id) = principal_id_tx(&mut transaction, principal.subject_id)
                .await
                .map_err(log_error("could not resolve organization creator"))?
            else {
                return Ok(None);
            };
            if !within_membership_limit(&mut transaction, principal_id)
                .await
                .map_err(log_error("could not check organization membership limit"))?
            {
                return Ok(None);
            }
            let id = Uuid::new_v4();
            let slug = next_slug(&mut transaction, &form.name)
                .await
                .map_err(log_error("could not create organization slug"))?;
            let created = sqlx::query_scalar::<_, Uuid>("INSERT INTO organizations (id, created_by_principal_id, name, slug, slogan, description, governance_type, leadership_rotated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $7 = 'random' THEN NOW() ELSE NULL END) RETURNING id")
                .bind(id).bind(principal_id).bind(&form.name).bind(&slug).bind(&form.slogan).bind(&form.description).bind(&form.governance_type).fetch_optional(&mut *transaction).await.map_err(log_error("could not create organization"))?;
            if created.is_none() {
                return Ok(None);
            }
            sqlx::query("INSERT INTO organization_memberships (id, organization_id, principal_id, role) VALUES ($1, $2, $3, 'leader')")
                .bind(Uuid::new_v4()).bind(id).bind(principal_id).execute(&mut *transaction).await.map_err(log_error("could not create organization leader"))?;
            transaction
                .commit()
                .await
                .map_err(log_error("could not commit organization creation"))?;
            load_detail_by_slug(
                self.application_pool,
                self.identity_pool,
                principal,
                &slug,
                1,
                1,
                1,
            )
            .await
            .map_err(log_error("could not load created organization"))
        }
    }
    fn update(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
        form: &OrganizationForm,
    ) -> impl std::future::Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send
    {
        async move {
            let mut transaction = self
                .application_pool
                .begin()
                .await
                .map_err(log_error("could not begin organization update"))?;
            let Some((organization_id, principal_id)) =
                organization_and_principal_tx(&mut transaction, principal.subject_id, slug)
                    .await
                    .map_err(log_error("could not resolve organization update"))?
            else {
                return Ok(None);
            };
            if !is_leader_tx(&mut transaction, organization_id, principal_id)
                .await
                .map_err(log_error("could not verify organization leader"))?
            {
                return Ok(None);
            }
            let governance = sqlx::query_scalar::<_, String>(
                "SELECT governance_type FROM organizations WHERE id = $1 FOR UPDATE",
            )
            .bind(organization_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(log_error("could not lock organization governance"))?
            .ok_or(OrganizationError)?;
            let updated = sqlx::query_scalar::<_, Uuid>("UPDATE organizations SET name = $2, slogan = $3, description = $4, updated_at = NOW() WHERE id = $1 RETURNING id")
                .bind(organization_id).bind(&form.name).bind(&form.slogan).bind(&form.description).fetch_optional(&mut *transaction).await.map_err(log_error("could not update organization"))?;
            if updated.is_none() {
                return Ok(None);
            }
            reconcile_governance_tx(&mut transaction, organization_id, &governance)
                .await
                .map_err(log_error("could not reconcile organization governance"))?;
            transaction
                .commit()
                .await
                .map_err(log_error("could not commit organization update"))?;
            load_detail_by_slug(
                self.application_pool,
                self.identity_pool,
                principal,
                slug,
                1,
                1,
                1,
            )
            .await
            .map_err(log_error("could not load updated organization"))
        }
    }
    fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
    ) -> impl std::future::Future<Output = Result<bool, OrganizationError>> + Send {
        async move {
            let mut transaction = self
                .application_pool
                .begin()
                .await
                .map_err(log_error("could not begin organization deletion"))?;
            let Some((organization_id, principal_id)) =
                organization_and_principal_tx(&mut transaction, principal.subject_id, slug)
                    .await
                    .map_err(log_error("could not resolve organization deletion"))?
            else {
                return Ok(false);
            };
            if !is_leader_tx(&mut transaction, organization_id, principal_id)
                .await
                .map_err(log_error("could not verify organization deletion leader"))?
            {
                return Ok(false);
            }
            let deleted = sqlx::query_scalar::<_, Uuid>(
                "DELETE FROM organizations WHERE id = $1 RETURNING id",
            )
            .bind(organization_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(log_error("could not delete organization"))?
            .is_some();
            transaction
                .commit()
                .await
                .map_err(log_error("could not commit organization deletion"))?;
            Ok(deleted)
        }
    }
    fn request_join(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
        message: Option<&str>,
    ) -> impl std::future::Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send
    {
        async move {
            let mut transaction = self
                .application_pool
                .begin()
                .await
                .map_err(log_error("could not begin organization join request"))?;
            let Some((organization_id, principal_id)) =
                organization_and_principal_tx(&mut transaction, principal.subject_id, slug)
                    .await
                    .map_err(log_error("could not resolve organization join request"))?
            else {
                return Ok(None);
            };
            if membership_exists_tx(&mut transaction, organization_id, principal_id)
                .await
                .map_err(log_error("could not check organization membership"))?
                || !within_membership_limit(&mut transaction, principal_id)
                    .await
                    .map_err(log_error("could not check organization membership limit"))?
            {
                return Ok(None);
            }
            sqlx::query("INSERT INTO organization_join_requests (id, organization_id, principal_id, status, message) VALUES ($1, $2, $3, 'pending', $4) ON CONFLICT (organization_id, principal_id) DO UPDATE SET status = 'pending', message = EXCLUDED.message, reviewed_by_principal_id = NULL, reviewed_at = NULL, updated_at = NOW()")
                .bind(Uuid::new_v4()).bind(organization_id).bind(principal_id).bind(message).execute(&mut *transaction).await.map_err(log_error("could not save organization join request"))?;
            transaction
                .commit()
                .await
                .map_err(log_error("could not commit organization join request"))?;
            load_detail_by_slug(
                self.application_pool,
                self.identity_pool,
                principal,
                slug,
                1,
                1,
                1,
            )
            .await
            .map_err(log_error("could not load organization join request"))
        }
    }
    fn respond_to_join_request(
        &self,
        principal: &AuthorizedPrincipal,
        request_id: Uuid,
        approved: bool,
    ) -> impl std::future::Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send
    {
        async move {
            let mut transaction = self
                .application_pool
                .begin()
                .await
                .map_err(log_error("could not begin organization join decision"))?;
            let Some(actor_id) = principal_id_tx(&mut transaction, principal.subject_id)
                .await
                .map_err(log_error("could not resolve organization leader"))?
            else {
                return Ok(None);
            };
            let request = sqlx::query_as::<_, (Uuid, Uuid, String)>("SELECT organization_id, principal_id, status FROM organization_join_requests WHERE id = $1 FOR UPDATE").bind(request_id).fetch_optional(&mut *transaction).await.map_err(log_error("could not lock organization join request"))?;
            let Some((organization_id, requester_id, status)) = request else {
                return Ok(None);
            };
            if status != "pending"
                || !is_leader_tx(&mut transaction, organization_id, actor_id)
                    .await
                    .map_err(log_error("could not verify organization join reviewer"))?
            {
                return Ok(None);
            }
            let governance = sqlx::query_scalar::<_, String>(
                "SELECT governance_type FROM organizations WHERE id = $1 FOR UPDATE",
            )
            .bind(organization_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(log_error("could not lock organization governance"))?;
            let Some(governance) = governance else {
                return Ok(None);
            };
            if approved {
                if !within_membership_limit(&mut transaction, requester_id)
                    .await
                    .map_err(log_error("could not check join requester membership limit"))?
                {
                    return Ok(None);
                }
                let role = if governance == "anarchy" {
                    "leader"
                } else {
                    "member"
                };
                sqlx::query("INSERT INTO organization_memberships (id, organization_id, principal_id, role) VALUES ($1, $2, $3, $4) ON CONFLICT (organization_id, principal_id) DO NOTHING").bind(Uuid::new_v4()).bind(organization_id).bind(requester_id).bind(role).execute(&mut *transaction).await.map_err(log_error("could not add organization member"))?;
            }
            sqlx::query("UPDATE organization_join_requests SET status = $2, reviewed_by_principal_id = $3, reviewed_at = NOW(), updated_at = NOW() WHERE id = $1").bind(request_id).bind(if approved { "approved" } else { "declined" }).bind(actor_id).execute(&mut *transaction).await.map_err(log_error("could not save organization join decision"))?;
            reconcile_governance_tx(&mut transaction, organization_id, &governance)
                .await
                .map_err(log_error("could not reconcile organization governance"))?;
            let slug =
                sqlx::query_scalar::<_, String>("SELECT slug FROM organizations WHERE id = $1")
                    .bind(organization_id)
                    .fetch_optional(&mut *transaction)
                    .await
                    .map_err(log_error("could not read organization slug"))?
                    .ok_or(OrganizationError)?;
            transaction
                .commit()
                .await
                .map_err(log_error("could not commit organization join decision"))?;
            load_detail_by_slug(
                self.application_pool,
                self.identity_pool,
                principal,
                &slug,
                1,
                1,
                1,
            )
            .await
            .map_err(log_error("could not load organization after join decision"))
        }
    }
    fn leave(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
    ) -> impl std::future::Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send
    {
        async move {
            change_membership(
                self.application_pool,
                self.identity_pool,
                principal,
                slug,
                None,
                MembershipChange::Leave,
            )
            .await
        }
    }
    fn promote_member(
        &self,
        principal: &AuthorizedPrincipal,
        membership_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send
    {
        async move {
            change_membership(
                self.application_pool,
                self.identity_pool,
                principal,
                "",
                Some(membership_id),
                MembershipChange::Promote,
            )
            .await
        }
    }
    fn remove_member(
        &self,
        principal: &AuthorizedPrincipal,
        membership_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send
    {
        async move {
            change_membership(
                self.application_pool,
                self.identity_pool,
                principal,
                "",
                Some(membership_id),
                MembershipChange::Remove,
            )
            .await
        }
    }
    fn send_message(
        &self,
        principal: &AuthorizedPrincipal,
        slug: &str,
        body: &str,
    ) -> impl std::future::Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send
    {
        async move {
            let mut transaction = self
                .application_pool
                .begin()
                .await
                .map_err(log_error("could not begin organization message"))?;
            let Some((organization_id, principal_id)) =
                organization_and_principal_tx(&mut transaction, principal.subject_id, slug)
                    .await
                    .map_err(log_error("could not resolve organization message sender"))?
            else {
                return Ok(None);
            };
            if !membership_exists_tx(&mut transaction, organization_id, principal_id)
                .await
                .map_err(log_error(
                    "could not verify organization message membership",
                ))?
                || !may_send_message_tx(&mut transaction, organization_id, principal_id)
                    .await
                    .map_err(log_error("could not rate limit organization message"))?
            {
                return Ok(None);
            }
            sqlx::query("INSERT INTO organization_messages (id, organization_id, principal_id, body) VALUES ($1, $2, $3, $4)").bind(Uuid::new_v4()).bind(organization_id).bind(principal_id).bind(body).execute(&mut *transaction).await.map_err(log_error("could not create organization message"))?;
            transaction
                .commit()
                .await
                .map_err(log_error("could not commit organization message"))?;
            load_detail_by_slug(
                self.application_pool,
                self.identity_pool,
                principal,
                slug,
                1,
                1,
                1,
            )
            .await
            .map_err(log_error("could not load organization after message"))
        }
    }
    fn delete_message(
        &self,
        principal: &AuthorizedPrincipal,
        message_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send
    {
        async move {
            mutate_message(
                self.application_pool,
                self.identity_pool,
                principal,
                message_id,
                false,
            )
            .await
        }
    }
    fn hide_message(
        &self,
        principal: &AuthorizedPrincipal,
        message_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<OrganizationDetail>, OrganizationError>> + Send
    {
        async move {
            mutate_message(
                self.application_pool,
                self.identity_pool,
                principal,
                message_id,
                true,
            )
            .await
        }
    }
}

fn log_error(message: &'static str) -> impl FnOnce(sqlx::Error) -> OrganizationError {
    move |error| {
        tracing::error!(%error, "{message}");
        OrganizationError
    }
}

async fn list(
    application: &PgPool,
    identity: &PgPool,
    principal: &AuthorizedPrincipal,
    page: i64,
    search: Option<&str>,
) -> Result<OrganizationDirectory, sqlx::Error> {
    let principal_id = principal_id(application, principal.subject_id).await?;
    let Some(principal_id) = principal_id else {
        return Err(sqlx::Error::RowNotFound);
    };
    let search = search.map(escape_like);
    let total = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM organizations WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%' ESCAPE E'\\\\' OR slug ILIKE '%' || $1 || '%' ESCAPE E'\\\\' OR COALESCE(slogan, '') ILIKE '%' || $1 || '%' ESCAPE E'\\\\' OR COALESCE(description, '') ILIKE '%' || $1 || '%' ESCAPE E'\\\\')").bind(&search).fetch_one(application).await?;
    let pagination = pagination(total, page, DIRECTORY_PER_PAGE);
    let rows = sqlx::query_as::<_, OrganizationRow>("SELECT description, governance_type, id, CASE WHEN leadership_rotated_at IS NULL THEN NULL ELSE to_char(leadership_rotated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') END AS leadership_rotated_at, name, slogan, slug FROM organizations WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%' ESCAPE E'\\\\' OR slug ILIKE '%' || $1 || '%' ESCAPE E'\\\\' OR COALESCE(slogan, '') ILIKE '%' || $1 || '%' ESCAPE E'\\\\' OR COALESCE(description, '') ILIKE '%' || $1 || '%' ESCAPE E'\\\\') ORDER BY name ASC, id ASC LIMIT $2 OFFSET $3").bind(&search).bind(pagination.per_page).bind((pagination.current_page - 1) * pagination.per_page).fetch_all(application).await?;
    let current_identity = identity_for_subject(identity, principal.subject_id).await?;
    let mut organizations = Vec::with_capacity(rows.len());
    for row in rows {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM organization_memberships WHERE organization_id = $1",
        )
        .bind(row.id)
        .fetch_one(application)
        .await?;
        let membership = membership_for_principal(
            application,
            row.id,
            principal_id,
            principal.subject_id,
            &current_identity,
        )
        .await?;
        let request = request_for_principal(
            application,
            row.id,
            principal_id,
            principal.subject_id,
            &current_identity,
        )
        .await?;
        organizations.push(OrganizationSummary {
            description: row.description,
            governance_type: row.governance_type,
            id: row.id.to_string(),
            member_count: count,
            name: row.name,
            slogan: row.slogan,
            slug: row.slug,
            viewer_join_request: request,
            viewer_membership: membership,
        });
    }
    Ok(OrganizationDirectory {
        organizations,
        pagination,
    })
}

async fn load_detail_by_slug(
    application: &PgPool,
    identity: &PgPool,
    principal: &AuthorizedPrincipal,
    slug: &str,
    members_page: i64,
    messages_page: i64,
    join_requests_page: i64,
) -> Result<Option<OrganizationDetail>, sqlx::Error> {
    let principal_id = principal_id(application, principal.subject_id).await?;
    let Some(principal_id) = principal_id else {
        return Ok(None);
    };
    let row = sqlx::query_as::<_, OrganizationRow>("SELECT description, governance_type, id, CASE WHEN leadership_rotated_at IS NULL THEN NULL ELSE to_char(leadership_rotated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') END AS leadership_rotated_at, name, slogan, slug FROM organizations WHERE slug = $1").bind(slug).fetch_optional(application).await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let current_identity = identity_for_subject(identity, principal.subject_id).await?;
    let viewer_membership = membership_for_principal(
        application,
        row.id,
        principal_id,
        principal.subject_id,
        &current_identity,
    )
    .await?;
    let viewer_join_request = request_for_principal(
        application,
        row.id,
        principal_id,
        principal.subject_id,
        &current_identity,
    )
    .await?;
    let is_leader = viewer_membership
        .as_ref()
        .is_some_and(|membership| membership.role == "leader");
    let can_moderate_messages = principal
        .roles
        .iter()
        .any(|role| role == "platform_administrator");
    let member_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM organization_memberships WHERE organization_id = $1",
    )
    .bind(row.id)
    .fetch_one(application)
    .await?;
    let leader_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM organization_memberships WHERE organization_id = $1 AND role = 'leader'").bind(row.id).fetch_one(application).await?;
    let (members, members_pagination) =
        memberships(application, identity, row.id, members_page).await?;
    let (messages, messages_pagination) = if viewer_membership.is_some() || can_moderate_messages {
        let (items, page) = messages(
            application,
            identity,
            row.id,
            principal_id,
            can_moderate_messages,
            messages_page,
        )
        .await?;
        (items, Some(page))
    } else {
        (vec![], None)
    };
    let (pending_join_requests, pending_join_requests_pagination) = if is_leader {
        let (items, page) =
            join_requests(application, identity, row.id, join_requests_page).await?;
        (items, Some(page))
    } else {
        (vec![], None)
    };
    Ok(Some(OrganizationDetail {
        can_moderate_messages,
        can_send_messages: viewer_membership.is_some(),
        description: row.description,
        governance_type: row.governance_type,
        id: row.id.to_string(),
        is_leader,
        leader_count,
        leadership_rotated_at: row.leadership_rotated_at,
        member_count,
        members,
        members_pagination,
        messages,
        messages_pagination,
        name: row.name,
        pending_join_requests,
        pending_join_requests_pagination,
        slogan: row.slogan,
        slug: row.slug,
        viewer_join_request,
        viewer_membership,
    }))
}

async fn memberships(
    application: &PgPool,
    identity: &PgPool,
    organization_id: Uuid,
    page: i64,
) -> Result<(Vec<OrganizationMembership>, OrganizationPagination), sqlx::Error> {
    let total = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM organization_memberships WHERE organization_id = $1",
    )
    .bind(organization_id)
    .fetch_one(application)
    .await?;
    let pagination = pagination(total, page, DETAIL_PER_PAGE);
    let rows = sqlx::query_as::<_, MembershipRow>("SELECT memberships.id, to_char(memberships.joined_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS joined_at, memberships.role, principals.identity_subject_id AS subject_id FROM organization_memberships AS memberships INNER JOIN application_principals AS principals ON principals.id = memberships.principal_id WHERE memberships.organization_id = $1 ORDER BY memberships.id ASC LIMIT $2 OFFSET $3").bind(organization_id).bind(pagination.per_page).bind((pagination.current_page - 1) * pagination.per_page).fetch_all(application).await?;
    let identities =
        identities_for_subjects(identity, rows.iter().map(|row| row.subject_id).collect()).await?;
    Ok((
        rows.into_iter()
            .filter_map(|row| {
                identities
                    .get(&row.subject_id)
                    .map(|identity| OrganizationMembership {
                        id: row.id.to_string(),
                        joined_at: row.joined_at,
                        role: row.role,
                        user: identity.clone(),
                    })
            })
            .collect(),
        pagination,
    ))
}

async fn messages(
    application: &PgPool,
    identity: &PgPool,
    organization_id: Uuid,
    viewer_principal_id: Uuid,
    can_moderate: bool,
    page: i64,
) -> Result<(Vec<OrganizationMessage>, OrganizationPagination), sqlx::Error> {
    let total = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM organization_messages WHERE organization_id = $1 AND ($2 OR hidden_at IS NULL)").bind(organization_id).bind(can_moderate).fetch_one(application).await?;
    let pagination = pagination(total, page, DETAIL_PER_PAGE);
    let rows = sqlx::query_as::<_, MessageRow>("SELECT messages.body, to_char(messages.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, CASE WHEN messages.hidden_at IS NULL THEN NULL ELSE to_char(messages.hidden_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') END AS hidden_at, messages.id, messages.principal_id, principals.identity_subject_id AS subject_id FROM organization_messages AS messages INNER JOIN application_principals AS principals ON principals.id = messages.principal_id WHERE messages.organization_id = $1 AND ($2 OR messages.hidden_at IS NULL) ORDER BY messages.created_at DESC, messages.id DESC LIMIT $3 OFFSET $4").bind(organization_id).bind(can_moderate).bind(pagination.per_page).bind((pagination.current_page - 1) * pagination.per_page).fetch_all(application).await?;
    let identities =
        identities_for_subjects(identity, rows.iter().map(|row| row.subject_id).collect()).await?;
    let mut result = rows
        .into_iter()
        .filter_map(|row| {
            identities
                .get(&row.subject_id)
                .map(|identity| OrganizationMessage {
                    body: row.body,
                    can_delete: row.principal_id == viewer_principal_id && row.hidden_at.is_none(),
                    can_hide: can_moderate && row.hidden_at.is_none(),
                    created_at: row.created_at,
                    hidden_at: row.hidden_at,
                    id: row.id.to_string(),
                    user: identity.clone(),
                })
        })
        .collect::<Vec<_>>();
    result.reverse();
    Ok((result, pagination))
}

async fn join_requests(
    application: &PgPool,
    identity: &PgPool,
    organization_id: Uuid,
    page: i64,
) -> Result<(Vec<OrganizationJoinRequest>, OrganizationPagination), sqlx::Error> {
    let total = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM organization_join_requests WHERE organization_id = $1 AND status = 'pending'").bind(organization_id).fetch_one(application).await?;
    let pagination = pagination(total, page, 4);
    let rows = sqlx::query_as::<_, JoinRequestRow>("SELECT requests.id, to_char(requests.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, requests.message, requests.status, principals.identity_subject_id AS subject_id FROM organization_join_requests AS requests INNER JOIN application_principals AS principals ON principals.id = requests.principal_id WHERE requests.organization_id = $1 AND requests.status = 'pending' ORDER BY requests.id ASC LIMIT $2 OFFSET $3").bind(organization_id).bind(pagination.per_page).bind((pagination.current_page - 1) * pagination.per_page).fetch_all(application).await?;
    let identities =
        identities_for_subjects(identity, rows.iter().map(|row| row.subject_id).collect()).await?;
    Ok((
        rows.into_iter()
            .filter_map(|row| {
                identities
                    .get(&row.subject_id)
                    .map(|identity| OrganizationJoinRequest {
                        created_at: row.created_at,
                        id: row.id.to_string(),
                        message: row.message,
                        requester: identity.clone(),
                        status: row.status,
                    })
            })
            .collect(),
        pagination,
    ))
}

async fn membership_for_principal(
    application: &PgPool,
    organization_id: Uuid,
    principal_id: Uuid,
    subject_id: Uuid,
    identity: &OrganizationIdentity,
) -> Result<Option<OrganizationMembership>, sqlx::Error> {
    let row = sqlx::query_as::<_, (Uuid, String, String)>("SELECT id, to_char(joined_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS joined_at, role FROM organization_memberships WHERE organization_id = $1 AND principal_id = $2").bind(organization_id).bind(principal_id).fetch_optional(application).await?;
    Ok(row.map(|(id, joined_at, role)| OrganizationMembership {
        id: id.to_string(),
        joined_at,
        role,
        user: OrganizationIdentity {
            id: subject_id.to_string(),
            name: identity.name.clone(),
        },
    }))
}

async fn request_for_principal(
    application: &PgPool,
    organization_id: Uuid,
    principal_id: Uuid,
    subject_id: Uuid,
    identity: &OrganizationIdentity,
) -> Result<Option<OrganizationJoinRequest>, sqlx::Error> {
    let row = sqlx::query_as::<_, (Uuid, String, Option<String>, String)>("SELECT id, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at, message, status FROM organization_join_requests WHERE organization_id = $1 AND principal_id = $2").bind(organization_id).bind(principal_id).fetch_optional(application).await?;
    Ok(row.map(
        |(id, created_at, message, status)| OrganizationJoinRequest {
            created_at,
            id: id.to_string(),
            message,
            requester: OrganizationIdentity {
                id: subject_id.to_string(),
                name: identity.name.clone(),
            },
            status,
        },
    ))
}

async fn identity_for_subject(
    identity: &PgPool,
    subject_id: Uuid,
) -> Result<OrganizationIdentity, sqlx::Error> {
    let row = sqlx::query_as::<_, IdentityRow>("SELECT profiles.display_name, subjects.id AS subject_id FROM identity_subjects AS subjects INNER JOIN identity_profiles AS profiles ON profiles.subject_id = subjects.id WHERE subjects.id = $1 AND subjects.status = 'active'").bind(subject_id).fetch_optional(identity).await?;
    row.map(|row| OrganizationIdentity {
        id: row.subject_id.to_string(),
        name: row.display_name,
    })
    .ok_or(sqlx::Error::RowNotFound)
}

async fn identities_for_subjects(
    identity: &PgPool,
    subjects: Vec<Uuid>,
) -> Result<HashMap<Uuid, OrganizationIdentity>, sqlx::Error> {
    let subjects = subjects
        .into_iter()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    if subjects.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query_as::<_, IdentityRow>("SELECT profiles.display_name, subjects.id AS subject_id FROM identity_subjects AS subjects INNER JOIN identity_profiles AS profiles ON profiles.subject_id = subjects.id WHERE subjects.id = ANY($1) AND subjects.status = 'active'").bind(subjects).fetch_all(identity).await?;
    Ok(rows
        .into_iter()
        .map(|row| {
            (
                row.subject_id,
                OrganizationIdentity {
                    id: row.subject_id.to_string(),
                    name: row.display_name,
                },
            )
        })
        .collect())
}

async fn principal_id(application: &PgPool, subject_id: Uuid) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(subject_id)
        .fetch_optional(application)
        .await
}
async fn principal_id_tx(
    transaction: &mut Transaction<'_, Postgres>,
    subject_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(subject_id)
        .fetch_optional(&mut **transaction)
        .await
}
async fn organization_and_principal_tx(
    transaction: &mut Transaction<'_, Postgres>,
    subject_id: Uuid,
    slug: &str,
) -> Result<Option<(Uuid, Uuid)>, sqlx::Error> {
    let Some(principal_id) = principal_id_tx(transaction, subject_id).await? else {
        return Ok(None);
    };
    let organization_id =
        sqlx::query_scalar("SELECT id FROM organizations WHERE slug = $1 FOR UPDATE")
            .bind(slug)
            .fetch_optional(&mut **transaction)
            .await?;
    Ok(organization_id.map(|organization_id| (organization_id, principal_id)))
}
async fn membership_exists_tx(
    transaction: &mut Transaction<'_, Postgres>,
    organization_id: Uuid,
    principal_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = $1 AND principal_id = $2)").bind(organization_id).bind(principal_id).fetch_one(&mut **transaction).await
}
async fn is_leader_tx(
    transaction: &mut Transaction<'_, Postgres>,
    organization_id: Uuid,
    principal_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = $1 AND principal_id = $2 AND role = 'leader')").bind(organization_id).bind(principal_id).fetch_one(&mut **transaction).await
}
async fn within_membership_limit(
    transaction: &mut Transaction<'_, Postgres>,
    principal_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT (SELECT COUNT(*) FROM organization_memberships WHERE principal_id = $1) < (SELECT max_memberships_per_user FROM platform_organization_policy WHERE singleton = TRUE)").bind(principal_id).fetch_one(&mut **transaction).await
}

async fn next_slug(
    transaction: &mut Transaction<'_, Postgres>,
    name: &str,
) -> Result<String, sqlx::Error> {
    let base = slug_base(name);
    let mut candidate = base.clone();
    let mut suffix = 2;
    while sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM organizations WHERE slug = $1)",
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
fn slug_base(name: &str) -> String {
    let mut value = String::new();
    let mut separator = false;
    for character in name.chars() {
        if character.is_ascii_alphanumeric() {
            value.push(character.to_ascii_lowercase());
            separator = false;
        } else if !value.is_empty() && !separator {
            value.push('-');
            separator = true;
        }
    }
    let value = value.trim_matches('-');
    if value.is_empty() {
        "organization".to_owned()
    } else {
        value.chars().take(140).collect()
    }
}
fn pagination(total: i64, page: i64, per_page: i64) -> OrganizationPagination {
    let last_page = ((total + per_page - 1) / per_page).max(1);
    OrganizationPagination {
        current_page: page.min(last_page),
        last_page,
        per_page,
        total,
    }
}
fn escape_like(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

async fn may_send_message_tx(
    transaction: &mut Transaction<'_, Postgres>,
    organization_id: Uuid,
    principal_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let rows = sqlx::query_as::<_, (Uuid, String)>("SELECT principal_id, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at FROM organization_messages WHERE organization_id = $1 ORDER BY created_at DESC, id DESC LIMIT 2").bind(organization_id).fetch_all(&mut **transaction).await?;
    if rows.len() < 2 || rows.iter().any(|(sender, _)| *sender != principal_id) {
        return Ok(true);
    }
    let too_recent = sqlx::query_scalar::<_, bool>("SELECT NOW() - (SELECT created_at FROM organization_messages WHERE organization_id = $1 ORDER BY created_at DESC, id DESC OFFSET 1 LIMIT 1) < INTERVAL '60 seconds'").bind(organization_id).fetch_one(&mut **transaction).await?;
    Ok(!too_recent)
}

async fn reconcile_governance_tx(
    transaction: &mut Transaction<'_, Postgres>,
    organization_id: Uuid,
    governance: &str,
) -> Result<(), sqlx::Error> {
    if governance == "anarchy" {
        sqlx::query("UPDATE organization_memberships SET role = 'leader' WHERE organization_id = $1 AND role <> 'leader'").bind(organization_id).execute(&mut **transaction).await?;
    } else if governance == "random" {
        let leader_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM organization_memberships WHERE organization_id = $1 AND role = 'leader'").bind(organization_id).fetch_one(&mut **transaction).await?;
        if leader_count != 1 {
            sqlx::query(
                "UPDATE organization_memberships SET role = 'member' WHERE organization_id = $1",
            )
            .bind(organization_id)
            .execute(&mut **transaction)
            .await?;
            let leader = sqlx::query_scalar::<_, Uuid>("SELECT id FROM organization_memberships WHERE organization_id = $1 ORDER BY random() LIMIT 1").bind(organization_id).fetch_optional(&mut **transaction).await?;
            if let Some(leader) = leader {
                sqlx::query("UPDATE organization_memberships SET role = 'leader' WHERE id = $1")
                    .bind(leader)
                    .execute(&mut **transaction)
                    .await?;
                sqlx::query("UPDATE organizations SET leadership_rotated_at = NOW(), updated_at = NOW() WHERE id = $1").bind(organization_id).execute(&mut **transaction).await?;
            }
        }
    }
    Ok(())
}

enum MembershipChange {
    Leave,
    Promote,
    Remove,
}
async fn change_membership(
    application: &PgPool,
    identity: &PgPool,
    principal: &AuthorizedPrincipal,
    slug: &str,
    membership_id: Option<Uuid>,
    action: MembershipChange,
) -> Result<Option<OrganizationDetail>, OrganizationError> {
    let mut transaction = application
        .begin()
        .await
        .map_err(log_error("could not begin organization membership change"))?;
    let Some(actor_id) = principal_id_tx(&mut transaction, principal.subject_id)
        .await
        .map_err(log_error("could not resolve organization actor"))?
    else {
        return Ok(None);
    };
    let target = match action {
        MembershipChange::Leave => {
            let organization_id = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM organizations WHERE slug = $1 FOR UPDATE",
            )
            .bind(slug)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(log_error("could not lock organization leave"))?;
            organization_id.map(|organization_id| (organization_id, actor_id))
        }
        MembershipChange::Promote | MembershipChange::Remove => {
            let membership_id = membership_id.ok_or(OrganizationError)?;
            sqlx::query_as::<_, (Uuid, Uuid)>("SELECT organization_id, principal_id FROM organization_memberships WHERE id = $1 FOR UPDATE").bind(membership_id).fetch_optional(&mut *transaction).await.map_err(log_error("could not lock organization member"))?
        }
    };
    let Some((organization_id, target_principal_id)) = target else {
        return Ok(None);
    };
    let governance =
        sqlx::query_scalar::<_, String>("SELECT governance_type FROM organizations WHERE id = $1")
            .bind(organization_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(log_error("could not read organization governance"))?
            .ok_or(OrganizationError)?;
    match action {
        MembershipChange::Leave => {
            let role = sqlx::query_scalar::<_, String>("SELECT role FROM organization_memberships WHERE organization_id = $1 AND principal_id = $2").bind(organization_id).bind(actor_id).fetch_optional(&mut *transaction).await.map_err(log_error("could not read organization membership"))?;
            let Some(role) = role else {
                return Ok(None);
            };
            let leaders = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM organization_memberships WHERE organization_id = $1 AND role = 'leader'").bind(organization_id).fetch_one(&mut *transaction).await.map_err(log_error("could not count organization leaders"))?;
            let members = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM organization_memberships WHERE organization_id = $1",
            )
            .bind(organization_id)
            .fetch_one(&mut *transaction)
            .await
            .map_err(log_error("could not count organization members"))?;
            if role == "leader" && leaders <= 1 && !(governance == "random" && members > 1) {
                return Ok(None);
            }
            sqlx::query("DELETE FROM organization_memberships WHERE organization_id = $1 AND principal_id = $2").bind(organization_id).bind(actor_id).execute(&mut *transaction).await.map_err(log_error("could not leave organization"))?;
        }
        MembershipChange::Promote => {
            if governance != "monarchy"
                || !is_leader_tx(&mut transaction, organization_id, actor_id)
                    .await
                    .map_err(log_error("could not verify organization leader"))?
            {
                return Ok(None);
            }
            sqlx::query("UPDATE organization_memberships SET role = 'leader' WHERE organization_id = $1 AND principal_id = $2").bind(organization_id).bind(target_principal_id).execute(&mut *transaction).await.map_err(log_error("could not promote organization member"))?;
        }
        MembershipChange::Remove => {
            if target_principal_id == actor_id
                || !is_leader_tx(&mut transaction, organization_id, actor_id)
                    .await
                    .map_err(log_error("could not verify organization leader"))?
            {
                return Ok(None);
            }
            sqlx::query("DELETE FROM organization_memberships WHERE organization_id = $1 AND principal_id = $2").bind(organization_id).bind(target_principal_id).execute(&mut *transaction).await.map_err(log_error("could not remove organization member"))?;
        }
    }
    reconcile_governance_tx(&mut transaction, organization_id, &governance)
        .await
        .map_err(log_error("could not reconcile organization governance"))?;
    let destination_slug =
        sqlx::query_scalar::<_, String>("SELECT slug FROM organizations WHERE id = $1")
            .bind(organization_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(log_error(
                "could not read organization after membership change",
            ))?
            .ok_or(OrganizationError)?;
    transaction
        .commit()
        .await
        .map_err(log_error("could not commit organization membership change"))?;
    load_detail_by_slug(application, identity, principal, &destination_slug, 1, 1, 1)
        .await
        .map_err(log_error(
            "could not load organization after membership change",
        ))
}

async fn mutate_message(
    application: &PgPool,
    identity: &PgPool,
    principal: &AuthorizedPrincipal,
    message_id: Uuid,
    hide: bool,
) -> Result<Option<OrganizationDetail>, OrganizationError> {
    let mut transaction = application
        .begin()
        .await
        .map_err(log_error("could not begin organization message moderation"))?;
    let Some(actor_id) = principal_id_tx(&mut transaction, principal.subject_id)
        .await
        .map_err(log_error("could not resolve organization message actor"))?
    else {
        return Ok(None);
    };
    let message = sqlx::query_as::<_, (Uuid, Uuid, Option<String>)>("SELECT organization_id, principal_id, CASE WHEN hidden_at IS NULL THEN NULL ELSE 'hidden' END FROM organization_messages WHERE id = $1 FOR UPDATE").bind(message_id).fetch_optional(&mut *transaction).await.map_err(log_error("could not lock organization message"))?;
    let Some((organization_id, author_id, hidden)) = message else {
        return Ok(None);
    };
    if hide {
        if !principal
            .roles
            .iter()
            .any(|role| role == "platform_administrator")
            || hidden.is_some()
        {
            return Ok(None);
        }
        sqlx::query("UPDATE organization_messages SET hidden_at = NOW(), hidden_by_principal_id = $2 WHERE id = $1").bind(message_id).bind(actor_id).execute(&mut *transaction).await.map_err(log_error("could not hide organization message"))?;
    } else {
        if author_id != actor_id || hidden.is_some() {
            return Ok(None);
        }
        sqlx::query("DELETE FROM organization_messages WHERE id = $1")
            .bind(message_id)
            .execute(&mut *transaction)
            .await
            .map_err(log_error("could not delete organization message"))?;
    }
    let slug = sqlx::query_scalar::<_, String>("SELECT slug FROM organizations WHERE id = $1")
        .bind(organization_id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(log_error(
            "could not read organization after message moderation",
        ))?
        .ok_or(OrganizationError)?;
    transaction.commit().await.map_err(log_error(
        "could not commit organization message moderation",
    ))?;
    load_detail_by_slug(application, identity, principal, &slug, 1, 1, 1)
        .await
        .map_err(log_error(
            "could not load organization after message moderation",
        ))
}

#[cfg(test)]
mod tests {
    use super::{escape_like, slug_base};
    #[test]
    fn organization_search_escapes_wildcards() {
        assert_eq!(escape_like("a%_\\b"), "a\\%\\_\\\\b");
    }
    #[test]
    fn organization_slug_is_a_bounded_hyphenated_identifier() {
        assert_eq!(slug_base("  A Curious Guild! "), "a-curious-guild");
        assert_eq!(slug_base("***"), "organization");
    }
}
