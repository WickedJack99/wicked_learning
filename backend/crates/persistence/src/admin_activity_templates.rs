use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_activity_templates::{
    ActivityTemplateName, ActivityTemplatePageRequest, ActivityTemplateRevisionPageRequest,
    AdminActivityTemplatesError, AdminActivityTemplatesRepository as Port,
};
use wicked_learning_domain::{
    identity_access::{AuthorizedPrincipal, permission_scope_allows},
    world_content::{
        AdminActivityTemplateDetails, AdminActivityTemplateOrganization, AdminActivityTemplatePage,
        AdminActivityTemplatePagination, AdminActivityTemplateRevision,
        AdminActivityTemplateRevisionDetails, AdminActivityTemplateRevisionPage,
        AdminActivityTemplateRevisionPagination, AdminActivityTemplateSummary,
    },
};

pub struct PostgresAdminActivityTemplatesRepository<'pool> {
    pool: &'pool PgPool,
}
impl<'pool> PostgresAdminActivityTemplatesRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminActivityTemplatesRepository<'_> {
    fn list(
        &self,
        principal: &AuthorizedPrincipal,
        page: ActivityTemplatePageRequest,
        search: Option<&str>,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminActivityTemplatePage>, AdminActivityTemplatesError>,
    > + Send {
        async move {
            list(self.pool, principal, page, search)
                .await
                .map_err(unavailable)
        }
    }
    fn create_from_activity(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        name: &ActivityTemplateName,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminActivityTemplateSummary>, AdminActivityTemplatesError>,
    > + Send {
        async move {
            create_from_activity(self.pool, principal, activity_id, name)
                .await
                .map_err(unavailable)
        }
    }
    fn details(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminActivityTemplateDetails>, AdminActivityTemplatesError>,
    > + Send {
        async move {
            details(self.pool, principal, template_id)
                .await
                .map_err(unavailable)
        }
    }
    fn rename(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        name: &ActivityTemplateName,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminActivityTemplateSummary>, AdminActivityTemplatesError>,
    > + Send {
        async move {
            rename(self.pool, principal, template_id, name)
                .await
                .map_err(unavailable)
        }
    }
    fn update_from_activity(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        activity_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminActivityTemplateSummary>, AdminActivityTemplatesError>,
    > + Send {
        async move {
            update_from_activity(self.pool, principal, template_id, activity_id)
                .await
                .map_err(unavailable)
        }
    }
    fn share(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminActivityTemplateSummary>, AdminActivityTemplatesError>,
    > + Send {
        async move {
            share(self.pool, principal, template_id, organization_id)
                .await
                .map_err(unavailable)
        }
    }
    fn revisions(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        page: ActivityTemplateRevisionPageRequest,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminActivityTemplateRevisionPage>, AdminActivityTemplatesError>,
    > + Send {
        async move {
            revisions(self.pool, principal, template_id, page)
                .await
                .map_err(unavailable)
        }
    }
    fn revision_details(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        revision_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminActivityTemplateRevisionDetails>, AdminActivityTemplatesError>,
    > + Send {
        async move {
            revision_details(self.pool, principal, template_id, revision_id)
                .await
                .map_err(unavailable)
        }
    }
    fn restore(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        revision_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<AdminActivityTemplateSummary>, AdminActivityTemplatesError>,
    > + Send {
        async move {
            restore(self.pool, principal, template_id, revision_id)
                .await
                .map_err(unavailable)
        }
    }
    fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
    ) -> impl std::future::Future<Output = Result<bool, AdminActivityTemplatesError>> + Send {
        async move {
            delete(self.pool, principal, template_id)
                .await
                .map_err(unavailable)
        }
    }
}
fn unavailable(error: sqlx::Error) -> AdminActivityTemplatesError {
    tracing::error!(%error, "could not manage reusable activity templates");
    AdminActivityTemplatesError::Unavailable
}

#[derive(FromRow)]
struct TemplateRow {
    id: Uuid,
    created_by_principal_id: Uuid,
    organization_id: Option<Uuid>,
    organization_name: Option<String>,
    name: String,
    activity_type: String,
    snapshot: Value,
    updated_at: String,
}
#[derive(FromRow)]
struct RevisionRow {
    id: Uuid,
    name: String,
    activity_type: String,
    snapshot: Value,
    created_at: String,
}
#[derive(FromRow)]
struct ScopedActivity {
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
    activity_type: String,
    title: String,
    introduction: Option<String>,
    config: Value,
}
const TEMPLATE_SELECT: &str = "templates.id, templates.created_by_principal_id, templates.organization_id, organizations.name AS organization_name, templates.name, templates.activity_type, templates.snapshot, to_char(templates.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at";

fn summary(row: TemplateRow, principal_id: Uuid) -> AdminActivityTemplateSummary {
    AdminActivityTemplateSummary {
        can_manage: row.created_by_principal_id == principal_id,
        id: row.id,
        name: row.name,
        organization: row
            .organization_id
            .zip(row.organization_name)
            .map(|(id, name)| AdminActivityTemplateOrganization { id, name }),
        title: row
            .snapshot
            .get("title")
            .and_then(Value::as_str)
            .unwrap_or("Untitled activity")
            .to_owned(),
        activity_type: row.activity_type,
        updated_at: row.updated_at,
    }
}
async fn principal_id(
    tx: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(&mut **tx)
        .await
}
async fn member(
    tx: &mut Transaction<'_, Postgres>,
    organization_id: Uuid,
    principal_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = $1 AND principal_id = $2)").bind(organization_id).bind(principal_id).fetch_one(&mut **tx).await
}
async fn visible(
    tx: &mut Transaction<'_, Postgres>,
    template_id: Uuid,
    principal_id: Uuid,
    lock: bool,
) -> Result<Option<TemplateRow>, sqlx::Error> {
    let suffix = if lock { " FOR UPDATE OF templates" } else { "" };
    let sql = format!(
        "SELECT {TEMPLATE_SELECT} FROM learning_activity_templates AS templates LEFT JOIN organizations ON organizations.id = templates.organization_id WHERE templates.id = $1 AND (templates.created_by_principal_id = $2 OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = templates.organization_id AND principal_id = $2)){suffix}"
    );
    sqlx::query_as(&sql)
        .bind(template_id)
        .bind(principal_id)
        .fetch_optional(&mut **tx)
        .await
}
async fn owner(
    tx: &mut Transaction<'_, Postgres>,
    template_id: Uuid,
    principal_id: Uuid,
) -> Result<Option<TemplateRow>, sqlx::Error> {
    let Some(template) = visible(tx, template_id, principal_id, true).await? else {
        return Ok(None);
    };
    Ok((template.created_by_principal_id == principal_id).then_some(template))
}

async fn list(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    page: ActivityTemplatePageRequest,
    search: Option<&str>,
) -> Result<Option<AdminActivityTemplatePage>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut tx, principal).await? else {
        return Ok(None);
    };
    let search = search.map(str::trim).filter(|value| !value.is_empty());
    let predicate = "WHERE (templates.created_by_principal_id = $1 OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = templates.organization_id AND principal_id = $1)) AND ($2::text IS NULL OR templates.name ILIKE '%' || $2 || '%' OR templates.activity_type ILIKE '%' || $2 || '%')";
    let total: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM learning_activity_templates AS templates {predicate}"
    ))
    .bind(principal_id)
    .bind(search)
    .fetch_one(&mut *tx)
    .await?;
    let sql = format!(
        "SELECT {TEMPLATE_SELECT} FROM learning_activity_templates AS templates LEFT JOIN organizations ON organizations.id = templates.organization_id {predicate} ORDER BY templates.name ASC, templates.id ASC LIMIT $3 OFFSET $4"
    );
    let rows: Vec<TemplateRow> = sqlx::query_as(&sql)
        .bind(principal_id)
        .bind(search)
        .bind(page.per_page)
        .bind((page.page - 1) * page.per_page)
        .fetch_all(&mut *tx)
        .await?;
    let targets: Vec<(Uuid, String)> = sqlx::query_as("SELECT organizations.id, organizations.name FROM organizations INNER JOIN organization_memberships ON organization_memberships.organization_id = organizations.id WHERE organization_memberships.principal_id = $1 ORDER BY organizations.name ASC, organizations.id ASC").bind(principal_id).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Some(AdminActivityTemplatePage {
        items: rows
            .into_iter()
            .map(|row| summary(row, principal_id))
            .collect(),
        pagination: AdminActivityTemplatePagination {
            page: page.page,
            per_page: page.per_page,
            total,
            last_page: ((total + page.per_page - 1) / page.per_page).max(1),
        },
        share_targets: targets
            .into_iter()
            .map(|(id, name)| AdminActivityTemplateOrganization { id, name })
            .collect(),
    }))
}

async fn scoped_activity(
    tx: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
) -> Result<Option<ScopedActivity>, sqlx::Error> {
    let Some(principal_id) = principal_id(tx, principal).await? else {
        return Ok(None);
    };
    let Some(activity) = sqlx::query_as::<_, ScopedActivity>("SELECT nodes.map_id, maps.created_by_principal_id AS map_creator_id, activities.activity_type, activities.title, activities.introduction, activities.activity_config AS config FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 FOR UPDATE OF activities, nodes").bind(activity_id).fetch_optional(&mut **tx).await? else { return Ok(None); };
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)").bind(activity.map_id).bind(principal_id).fetch_one(&mut **tx).await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(None);
    };
    let allowed = scope == "all"
        || (permission_scope_allows(scope, "own") && activity.map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct)
        || direct;
    Ok((allowed && activity.activity_type != "npc_dialogue").then_some(activity))
}
fn activity_snapshot(activity: &ScopedActivity) -> Value {
    json!({ "companionConfig": {}, "config": activity.config, "introduction": activity.introduction, "question": if activity.activity_type == "question" { activity.config.clone() } else { Value::Null }, "title": activity.title, "type": activity.activity_type })
}
async fn record(
    tx: &mut Transaction<'_, Postgres>,
    template: &TemplateRow,
    principal_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO learning_activity_template_revisions (id, template_id, created_by_principal_id, name, activity_type, snapshot) VALUES ($1, $2, $3, $4, $5, $6)").bind(Uuid::new_v4()).bind(template.id).bind(principal_id).bind(&template.name).bind(&template.activity_type).bind(&template.snapshot).execute(&mut **tx).await?;
    Ok(())
}
async fn create_from_activity(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    name: &ActivityTemplateName,
) -> Result<Option<AdminActivityTemplateSummary>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut tx, principal).await? else {
        return Ok(None);
    };
    let Some(activity) = scoped_activity(&mut tx, principal, activity_id).await? else {
        return Ok(None);
    };
    let snapshot = activity_snapshot(&activity);
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO learning_activity_templates (id, created_by_principal_id, name, activity_type, snapshot) VALUES ($1, $2, $3, $4, $5)").bind(id).bind(principal_id).bind(&name.0).bind(&activity.activity_type).bind(&snapshot).execute(&mut *tx).await?;
    let row = TemplateRow {
        id,
        created_by_principal_id: principal_id,
        organization_id: None,
        organization_name: None,
        name: name.0.clone(),
        activity_type: activity.activity_type,
        snapshot,
        updated_at: String::new(),
    };
    record(&mut tx, &row, principal_id).await?;
    let Some(row) = visible(&mut tx, id, principal_id, false).await? else {
        return Ok(None);
    };
    tx.commit().await?;
    Ok(Some(summary(row, principal_id)))
}
async fn details(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    template_id: Uuid,
) -> Result<Option<AdminActivityTemplateDetails>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut tx, principal).await? else {
        return Ok(None);
    };
    let result = visible(&mut tx, template_id, principal_id, false)
        .await?
        .map(|row| AdminActivityTemplateDetails {
            snapshot: row.snapshot.clone(),
            summary: summary(row, principal_id),
        });
    tx.commit().await?;
    Ok(result)
}
async fn rename(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    template_id: Uuid,
    name: &ActivityTemplateName,
) -> Result<Option<AdminActivityTemplateSummary>, sqlx::Error> {
    mutate_name(pool, principal, template_id, name).await
}
async fn mutate_name(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    template_id: Uuid,
    name: &ActivityTemplateName,
) -> Result<Option<AdminActivityTemplateSummary>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut tx, principal).await? else {
        return Ok(None);
    };
    let Some(mut row) = owner(&mut tx, template_id, principal_id).await? else {
        return Ok(None);
    };
    row.name = name.0.clone();
    sqlx::query("UPDATE learning_activity_templates SET name=$2, updated_at=NOW() WHERE id=$1")
        .bind(template_id)
        .bind(&row.name)
        .execute(&mut *tx)
        .await?;
    let Some(row) = visible(&mut tx, template_id, principal_id, false).await? else {
        return Ok(None);
    };
    tx.commit().await?;
    Ok(Some(summary(row, principal_id)))
}

async fn update_from_activity(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    template_id: Uuid,
    activity_id: Uuid,
) -> Result<Option<AdminActivityTemplateSummary>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut tx, principal).await? else {
        return Ok(None);
    };
    let Some(mut template) = owner(&mut tx, template_id, principal_id).await? else {
        return Ok(None);
    };
    let Some(activity) = scoped_activity(&mut tx, principal, activity_id).await? else {
        return Ok(None);
    };
    record(&mut tx, &template, principal_id).await?;
    template.snapshot = activity_snapshot(&activity);
    template.activity_type = activity.activity_type;
    sqlx::query("UPDATE learning_activity_templates SET activity_type=$2, snapshot=$3, updated_at=NOW() WHERE id=$1").bind(template_id).bind(&template.activity_type).bind(&template.snapshot).execute(&mut *tx).await?;
    let Some(template) = visible(&mut tx, template_id, principal_id, false).await? else {
        return Ok(None);
    };
    tx.commit().await?;
    Ok(Some(summary(template, principal_id)))
}
async fn share(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    template_id: Uuid,
    organization_id: Option<Uuid>,
) -> Result<Option<AdminActivityTemplateSummary>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut tx, principal).await? else {
        return Ok(None);
    };
    let Some(mut template) = owner(&mut tx, template_id, principal_id).await? else {
        return Ok(None);
    };
    if let Some(id) = organization_id {
        if !member(&mut tx, id, principal_id).await? {
            return Ok(None);
        }
        let name: Option<String> = sqlx::query_scalar("SELECT name FROM organizations WHERE id=$1")
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?;
        let Some(name) = name else { return Ok(None) };
        template.organization_id = Some(id);
        template.organization_name = Some(name);
    } else {
        template.organization_id = None;
        template.organization_name = None;
    }
    sqlx::query(
        "UPDATE learning_activity_templates SET organization_id=$2, updated_at=NOW() WHERE id=$1",
    )
    .bind(template_id)
    .bind(template.organization_id)
    .execute(&mut *tx)
    .await?;
    let Some(template) = visible(&mut tx, template_id, principal_id, false).await? else {
        return Ok(None);
    };
    tx.commit().await?;
    Ok(Some(summary(template, principal_id)))
}
async fn revisions(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    template_id: Uuid,
    page: ActivityTemplateRevisionPageRequest,
) -> Result<Option<AdminActivityTemplateRevisionPage>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut tx, principal).await? else {
        return Ok(None);
    };
    if visible(&mut tx, template_id, principal_id, false)
        .await?
        .is_none()
    {
        return Ok(None);
    }
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM learning_activity_template_revisions WHERE template_id=$1",
    )
    .bind(template_id)
    .fetch_one(&mut *tx)
    .await?;
    let rows:Vec<RevisionRow>=sqlx::query_as("SELECT id,name,activity_type,snapshot,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at FROM learning_activity_template_revisions WHERE template_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3").bind(template_id).bind(page.per_page).bind((page.page-1)*page.per_page).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Some(AdminActivityTemplateRevisionPage {
        items: rows
            .into_iter()
            .map(|row| AdminActivityTemplateRevision {
                id: row.id,
                created_at: row.created_at,
                name: row.name,
                title: row
                    .snapshot
                    .get("title")
                    .and_then(Value::as_str)
                    .unwrap_or("Untitled activity")
                    .to_owned(),
                activity_type: row.activity_type,
            })
            .collect(),
        pagination: AdminActivityTemplateRevisionPagination {
            page: page.page,
            per_page: page.per_page,
            total,
            last_page: ((total + page.per_page - 1) / page.per_page).max(1),
        },
    }))
}
async fn revision_details(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    template_id: Uuid,
    revision_id: Uuid,
) -> Result<Option<AdminActivityTemplateRevisionDetails>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut tx, principal).await? else {
        return Ok(None);
    };
    if visible(&mut tx, template_id, principal_id, false)
        .await?
        .is_none()
    {
        return Ok(None);
    }
    let row=sqlx::query_as::<_,RevisionRow>("SELECT id,name,activity_type,snapshot,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at FROM learning_activity_template_revisions WHERE id=$1 AND template_id=$2").bind(revision_id).bind(template_id).fetch_optional(&mut *tx).await?;
    tx.commit().await?;
    Ok(row.map(|row| AdminActivityTemplateRevisionDetails {
        snapshot: row.snapshot.clone(),
        revision: AdminActivityTemplateRevision {
            id: row.id,
            created_at: row.created_at,
            name: row.name,
            title: row
                .snapshot
                .get("title")
                .and_then(Value::as_str)
                .unwrap_or("Untitled activity")
                .to_owned(),
            activity_type: row.activity_type,
        },
    }))
}
async fn restore(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    template_id: Uuid,
    revision_id: Uuid,
) -> Result<Option<AdminActivityTemplateSummary>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut tx, principal).await? else {
        return Ok(None);
    };
    let Some(mut template) = owner(&mut tx, template_id, principal_id).await? else {
        return Ok(None);
    };
    let revision=sqlx::query_as::<_,RevisionRow>("SELECT id,name,activity_type,snapshot,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at FROM learning_activity_template_revisions WHERE id=$1 AND template_id=$2 FOR UPDATE").bind(revision_id).bind(template_id).fetch_optional(&mut *tx).await?;
    let Some(revision) = revision else {
        return Ok(None);
    };
    record(&mut tx, &template, principal_id).await?;
    template.activity_type = revision.activity_type;
    template.snapshot = revision.snapshot;
    sqlx::query("UPDATE learning_activity_templates SET activity_type=$2,snapshot=$3,updated_at=NOW() WHERE id=$1").bind(template_id).bind(&template.activity_type).bind(&template.snapshot).execute(&mut *tx).await?;
    let Some(template) = visible(&mut tx, template_id, principal_id, false).await? else {
        return Ok(None);
    };
    tx.commit().await?;
    Ok(Some(summary(template, principal_id)))
}
async fn delete(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    template_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut tx, principal).await? else {
        return Ok(false);
    };
    if owner(&mut tx, template_id, principal_id).await?.is_none() {
        return Ok(false);
    }
    sqlx::query("DELETE FROM learning_activity_templates WHERE id=$1")
        .bind(template_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(true)
}
