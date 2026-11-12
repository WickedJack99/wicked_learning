use serde_json::{Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_world_question::{
    AdminWorldQuestionError, AdminWorldQuestionRepository as Port, CreatedQuestionActivity,
    QuestionActivityForm, UpdatedQuestionActivity, generated_slug,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

use crate::admin_world_activity_history::record_activity_version;

pub struct PostgresAdminWorldQuestionRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldQuestionRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldQuestionRepository<'_> {
    fn create_question(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &QuestionActivityForm,
    ) -> impl std::future::Future<
        Output = Result<Option<CreatedQuestionActivity>, AdminWorldQuestionError>,
    > + Send {
        async move {
            create(self.pool, principal, node_id, form)
                .await
                .map_err(map_error)
        }
    }

    fn update_question(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &QuestionActivityForm,
        expected_updated_at: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<UpdatedQuestionActivity>, AdminWorldQuestionError>,
    > + Send {
        async move {
            update(self.pool, principal, activity_id, form, expected_updated_at)
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
    fn from(error: sqlx::Error) -> Self {
        Self::Storage(error)
    }
}

fn map_error(error: Error) -> AdminWorldQuestionError {
    match error {
        Error::Invalid => AdminWorldQuestionError::InvalidActivity,
        Error::Conflict => AdminWorldQuestionError::Conflict,
        Error::Storage(error) => {
            tracing::error!(%error, "could not mutate scoped World Builder question activity");
            AdminWorldQuestionError::Unavailable
        }
    }
}

async fn create(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    node_id: Uuid,
    form: &QuestionActivityForm,
) -> Result<Option<CreatedQuestionActivity>, Error> {
    let mut transaction = pool.begin().await?;
    let Some(node) = node(&mut transaction, principal, node_id).await? else {
        return Ok(None);
    };
    let Some(map_asset_id) = node.map_asset_id else {
        return Ok(None);
    };
    let Some(route_id) = sqlx::query_scalar::<_, Uuid>("SELECT id FROM learning_routes WHERE map_asset_id = $1 ORDER BY position, id LIMIT 1 FOR UPDATE").bind(map_asset_id).fetch_optional(&mut *transaction).await? else { return Ok(None); };
    let slug = unique_slug(&mut transaction, map_asset_id, form, None).await?;
    let position: i16 = sqlx::query_scalar("SELECT (COALESCE(MAX(position), -1)::integer + 1)::smallint FROM learning_activities WHERE route_id = $1").bind(route_id).fetch_one(&mut *transaction).await?;
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO learning_activities (id, route_id, slug, title, description, position, published_at, activity_type, activity_config, introduction, graph_position_x, graph_position_y, ai_review_status) VALUES ($1,$2,$3,$4,$5,$6,NOW(),'question',$7,$8,$9,$10,'needs_review')").bind(id).bind(route_id).bind(&slug).bind(&form.title).bind(form.introduction.clone().unwrap_or_default()).bind(position).bind(config(form)).bind(&form.introduction).bind(form.graph_position_x.map(f64::from)).bind(form.graph_position_y.map(f64::from)).execute(&mut *transaction).await?;
    transaction.commit().await?;
    Ok(Some(CreatedQuestionActivity {
        activity_id: id,
        slug,
    }))
}

async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    form: &QuestionActivityForm,
    expected: &str,
) -> Result<Option<UpdatedQuestionActivity>, Error> {
    let mut transaction = pool.begin().await?;
    let Some(current) = activity(&mut transaction, principal, activity_id).await? else {
        return Ok(None);
    };
    if current.updated_at != expected {
        return Err(Error::Conflict);
    }
    let slug = unique_slug(
        &mut transaction,
        current.map_asset_id,
        form,
        Some(activity_id),
    )
    .await?;
    let mut next = current.config.clone();
    let object = next.as_object_mut().ok_or(Error::Invalid)?;
    for (key, value) in config(form).as_object().ok_or(Error::Invalid)? {
        object.insert(key.clone(), value.clone());
    }
    if current.slug == slug
        && current.title == form.title
        && current.introduction == form.introduction
        && current.config == next
    {
        transaction.commit().await?;
        return Ok(Some(UpdatedQuestionActivity {
            activity_id,
            updated_at: current.updated_at,
        }));
    }
    record_activity_version(&mut transaction, activity_id, principal).await?;
    let updated_at: String = sqlx::query_scalar("UPDATE learning_activities SET slug=$2,title=$3,description=$4,introduction=$5,activity_config=$6,ai_review_status='needs_review',ai_reviewed_at=NULL,ai_review=NULL,updated_at=NOW() WHERE id=$1 RETURNING to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')").bind(activity_id).bind(slug).bind(&form.title).bind(form.introduction.clone().unwrap_or_default()).bind(&form.introduction).bind(next).fetch_one(&mut *transaction).await?;
    transaction.commit().await?;
    Ok(Some(UpdatedQuestionActivity {
        activity_id,
        updated_at,
    }))
}

pub fn config(form: &QuestionActivityForm) -> Value {
    json!({"prompt":form.prompt,"allowMultiple":form.allow_multiple,"feedbackCorrect":form.feedback_correct,"feedbackIncorrect":form.feedback_incorrect,"explanation":form.explanation,"options":form.options.iter().enumerate().map(|(index, option)| json!({"key":option.key.clone().unwrap_or_else(|| format!("answer-{}", index + 1)),"label":option.label,"body":option.body,"isCorrect":option.is_correct,"outcomeKey":option.outcome_key,"feedback":option.feedback,"weights":option.weights})).collect::<Vec<_>>()})
}

async fn unique_slug(
    transaction: &mut Transaction<'_, Postgres>,
    map_asset_id: Uuid,
    form: &QuestionActivityForm,
    excluded: Option<Uuid>,
) -> Result<String, Error> {
    let base = form
        .slug
        .clone()
        .unwrap_or_else(|| generated_slug(&form.title));
    let mut candidate = base.clone();
    for suffix in 2..=10_000 {
        let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_activities a INNER JOIN learning_routes r ON r.id=a.route_id WHERE r.map_asset_id=$1 AND a.slug=$2 AND ($3::uuid IS NULL OR a.id<>$3))").bind(map_asset_id).bind(&candidate).bind(excluded).fetch_one(&mut **transaction).await?;
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
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    id: Uuid,
) -> Result<Option<ScopedActivity>, sqlx::Error> {
    let Some(principal_id) = principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let Some(value) = sqlx::query_as::<_, ScopedActivity>("SELECT r.map_asset_id,n.map_id,m.created_by_principal_id AS map_creator_id,a.slug,a.title,a.introduction,a.activity_config AS config,to_char(a.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_activities a INNER JOIN learning_routes r ON r.id=a.route_id INNER JOIN learning_nodes n ON n.map_asset_id=r.map_asset_id INNER JOIN learning_maps m ON m.id=n.map_id WHERE a.id=$1 AND a.activity_type='question' FOR UPDATE OF a,n").bind(id).fetch_optional(&mut **transaction).await? else { return Ok(None); };
    Ok(scoped(
        transaction,
        principal,
        principal_id,
        value.map_id,
        value.map_creator_id,
    )
    .await?
    .then_some(value))
}

async fn node(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    id: Uuid,
) -> Result<Option<ScopedNode>, sqlx::Error> {
    let Some(principal_id) = principal_id(transaction, principal).await? else {
        return Ok(None);
    };
    let Some(value) = sqlx::query_as::<_, ScopedNode>("SELECT n.map_asset_id,n.map_id,m.created_by_principal_id AS map_creator_id FROM learning_nodes n INNER JOIN learning_maps m ON m.id=n.map_id WHERE n.id=$1 FOR UPDATE OF n").bind(id).fetch_optional(&mut **transaction).await? else { return Ok(None); };
    Ok(scoped(
        transaction,
        principal,
        principal_id,
        value.map_id,
        value.map_creator_id,
    )
    .await?
    .then_some(value))
}

async fn principal_id(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id=$1")
        .bind(principal.subject_id)
        .fetch_optional(&mut **transaction)
        .await
}

async fn scoped(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map: Uuid,
    creator: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let assigned: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups eg INNER JOIN learning_group_memberships gm ON gm.group_id=eg.group_id WHERE eg.map_id=$1 AND gm.principal_id=$2)").bind(map).bind(principal_id).fetch_one(&mut **transaction).await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && creator == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && assigned)
        || assigned)
}
