use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_world_message::{
    AdminWorldMessageError, AdminWorldMessageRepository as Port, CreatedMessageActivity,
    MessageActivityForm, UpdatedMessageActivity, generated_slug,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

use crate::admin_world_activity_history::record_activity_version;

pub struct PostgresAdminWorldMessageRepository<'pool> {
    pool: &'pool PgPool,
}
impl<'pool> PostgresAdminWorldMessageRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}
impl Port for PostgresAdminWorldMessageRepository<'_> {
    fn create_message(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &MessageActivityForm,
    ) -> impl std::future::Future<
        Output = Result<Option<CreatedMessageActivity>, AdminWorldMessageError>,
    > + Send {
        async move {
            create(self.pool, principal, node_id, form)
                .await
                .map_err(map_error)
        }
    }
    fn update_message(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &MessageActivityForm,
        expected: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<UpdatedMessageActivity>, AdminWorldMessageError>,
    > + Send {
        async move {
            update(self.pool, principal, activity_id, form, expected)
                .await
                .map_err(map_error)
        }
    }
}
#[derive(FromRow)]
struct ScopedNode {
    map_asset_id: Option<Uuid>,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
}
#[derive(FromRow)]
struct ScopedActivity {
    map_asset_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
    activity_type: String,
    slug: String,
    title: String,
    introduction: Option<String>,
    config: Value,
    updated_at: String,
}
enum Error {
    Invalid,
    Conflict,
    Storage(sqlx::Error),
}
impl From<sqlx::Error> for Error {
    fn from(value: sqlx::Error) -> Self {
        Self::Storage(value)
    }
}
fn map_error(value: Error) -> AdminWorldMessageError {
    match value {
        Error::Invalid => AdminWorldMessageError::InvalidActivity,
        Error::Conflict => AdminWorldMessageError::Conflict,
        Error::Storage(error) => {
            tracing::error!(%error, "could not mutate scoped World Builder message activity");
            AdminWorldMessageError::Unavailable
        }
    }
}

async fn create(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    form: &MessageActivityForm,
) -> Result<Option<CreatedMessageActivity>, Error> {
    let mut tx = pool.begin().await?;
    let Some(node) = node(&mut tx, principal, node_id).await? else {
        return Ok(None);
    };
    let Some(asset) = node.map_asset_id else {
        return Ok(None);
    };
    let Some(route) = sqlx::query_scalar::<_, Uuid>("SELECT id FROM learning_routes WHERE map_asset_id = $1 ORDER BY position, id LIMIT 1 FOR UPDATE").bind(asset).fetch_optional(&mut *tx).await? else { return Ok(None); };
    let topic = topic(&mut tx, asset, form).await?;
    let slug = unique_slug(&mut tx, asset, form, None).await?;
    let position: i16 = sqlx::query_scalar("SELECT (COALESCE(MAX(position), -1)::integer + 1)::smallint FROM learning_activities WHERE route_id = $1").bind(route).fetch_one(&mut *tx).await?;
    let id = Uuid::new_v4();
    let activity_config = config(form, topic);
    sqlx::query("INSERT INTO learning_activities (id, route_id, slug, title, description, position, published_at, activity_type, activity_config, introduction, graph_position_x, graph_position_y, ai_review_status) VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9,$10,$11,'needs_review')").bind(id).bind(route).bind(&slug).bind(&form.title).bind(form.introduction.clone().unwrap_or_default()).bind(position).bind(&form.activity_type).bind(&activity_config).bind(&form.introduction).bind(form.graph_position_x.map(f64::from)).bind(form.graph_position_y.map(f64::from)).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Some(CreatedMessageActivity {
        activity_id: id,
        config: activity_config,
        slug,
    }))
}
async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    form: &MessageActivityForm,
    expected: &str,
) -> Result<Option<UpdatedMessageActivity>, Error> {
    let mut tx = pool.begin().await?;
    let Some(current) = activity(&mut tx, principal, activity_id).await? else {
        return Ok(None);
    };
    if current.updated_at != expected {
        return Err(Error::Conflict);
    }
    if current.activity_type != form.activity_type {
        return Err(Error::Invalid);
    }
    if current.config.get("messageTopicId").is_none() {
        return Err(Error::Invalid);
    }
    let topic = topic(&mut tx, current.map_asset_id, form).await?;
    let slug = unique_slug(&mut tx, current.map_asset_id, form, Some(activity_id)).await?;
    let next = config(form, topic);
    if current.slug == slug
        && current.title == form.title
        && current.introduction == form.introduction
        && current.config == next
    {
        tx.commit().await?;
        return Ok(Some(UpdatedMessageActivity {
            activity_id,
            updated_at: current.updated_at,
        }));
    }
    record_activity_version(&mut tx, activity_id, principal).await?;
    let updated_at: String = sqlx::query_scalar("UPDATE learning_activities SET slug=$2,title=$3,description=$4,introduction=$5,activity_config=$6,ai_review_status='needs_review',ai_reviewed_at=NULL,ai_review=NULL,updated_at=NOW() WHERE id=$1 RETURNING to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')").bind(activity_id).bind(slug).bind(&form.title).bind(form.introduction.clone().unwrap_or_default()).bind(&form.introduction).bind(next).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok(Some(UpdatedMessageActivity {
        activity_id,
        updated_at,
    }))
}
fn config(form: &MessageActivityForm, topic: Uuid) -> Value {
    json!({"messageTopicId":topic,"messageAudience":form.audience,"messageAllowResponses":form.allow_responses,"messageResponsePrompt":form.response_prompt,"messagePrompt":form.prompt,"messageInputLabel":form.input_label,"messageUi":{"surfaceColorDark":form.ui.surface_color_dark,"surfaceColorLight":form.ui.surface_color_light,"cardColorDark":form.ui.card_color_dark,"cardColorLight":form.ui.card_color_light,"cardBorderColorDark":form.ui.card_border_color_dark,"cardBorderColorLight":form.ui.card_border_color_light,"textColorDark":form.ui.text_color_dark,"textColorLight":form.ui.text_color_light,"accentColorDark":form.ui.accent_color_dark,"accentColorLight":form.ui.accent_color_light}})
}
async fn topic(
    tx: &mut Transaction<'_, Postgres>,
    asset: Uuid,
    form: &MessageActivityForm,
) -> Result<Uuid, Error> {
    if let Some(id) = form.topic_id {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM learning_message_topics WHERE id=$1 AND map_asset_id=$2)",
        )
        .bind(id)
        .bind(asset)
        .fetch_one(&mut **tx)
        .await?;
        return exists.then_some(id).ok_or(Error::Invalid);
    }
    let slug = generated_slug(&form.topic_title);
    Ok(sqlx::query_scalar("INSERT INTO learning_message_topics (id,map_asset_id,slug,title) VALUES ($1,$2,$3,$4) ON CONFLICT (map_asset_id,slug) DO UPDATE SET updated_at=NOW() RETURNING id").bind(Uuid::new_v4()).bind(asset).bind(slug).bind(&form.topic_title).fetch_one(&mut **tx).await?)
}
async fn unique_slug(
    tx: &mut Transaction<'_, Postgres>,
    asset: Uuid,
    form: &MessageActivityForm,
    excluded: Option<Uuid>,
) -> Result<String, Error> {
    let base = form
        .slug
        .clone()
        .unwrap_or_else(|| generated_slug(&form.title));
    let mut candidate = base.clone();
    for suffix in 2..=10_000 {
        let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_activities a INNER JOIN learning_routes r ON r.id=a.route_id WHERE r.map_asset_id=$1 AND a.slug=$2 AND ($3::uuid IS NULL OR a.id<>$3))").bind(asset).bind(&candidate).bind(excluded).fetch_one(&mut **tx).await?;
        if !exists {
            return Ok(candidate);
        }
        if form.slug.is_some() {
            return Err(Error::Invalid);
        }
        candidate = format!("{base}-{suffix}");
        if candidate.len() > 140 {
            return Err(Error::Invalid);
        }
    }
    Err(Error::Invalid)
}
async fn activity(
    tx: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    id: Uuid,
) -> Result<Option<ScopedActivity>, sqlx::Error> {
    let Some(principal_id) = principal_id(tx, principal).await? else {
        return Ok(None);
    };
    let Some(value) = sqlx::query_as::<_, ScopedActivity>("SELECT r.map_asset_id,n.map_id,m.created_by_principal_id AS map_creator_id,a.activity_type,a.slug,a.title,a.introduction,a.activity_config AS config,to_char(a.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_activities a INNER JOIN learning_routes r ON r.id=a.route_id INNER JOIN learning_nodes n ON n.map_asset_id=r.map_asset_id INNER JOIN learning_maps m ON m.id=n.map_id WHERE a.id=$1 AND a.activity_type IN ('message_prompt','message_wall') FOR UPDATE OF a,n").bind(id).fetch_optional(&mut **tx).await? else { return Ok(None); };
    Ok(scoped(
        tx,
        principal,
        principal_id,
        value.map_id,
        value.map_creator_id,
    )
    .await?
    .then_some(value))
}
async fn node(
    tx: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    id: Uuid,
) -> Result<Option<ScopedNode>, sqlx::Error> {
    let Some(principal_id) = principal_id(tx, principal).await? else {
        return Ok(None);
    };
    let Some(value) = sqlx::query_as::<_, ScopedNode>("SELECT n.map_asset_id,n.map_id,m.created_by_principal_id AS map_creator_id FROM learning_nodes n INNER JOIN learning_maps m ON m.id=n.map_id WHERE n.id=$1 FOR UPDATE OF n").bind(id).fetch_optional(&mut **tx).await? else { return Ok(None); };
    Ok(scoped(
        tx,
        principal,
        principal_id,
        value.map_id,
        value.map_creator_id,
    )
    .await?
    .then_some(value))
}
async fn principal_id(
    tx: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id=$1")
        .bind(principal.subject_id)
        .fetch_optional(&mut **tx)
        .await
}
async fn scoped(
    tx: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map: Uuid,
    creator: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let assigned: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups eg INNER JOIN learning_group_memberships gm ON gm.group_id=eg.group_id WHERE eg.map_id=$1 AND gm.principal_id=$2)").bind(map).bind(principal_id).fetch_one(&mut **tx).await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && creator == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && assigned)
        || assigned)
}
