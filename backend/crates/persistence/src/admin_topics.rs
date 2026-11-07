use std::collections::HashSet;

use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_topics::{
    AdminTopicsError, AdminTopicsRepository as Port, TopicAreaForm, TopicForm, generated_topic_slug,
};
use wicked_learning_domain::world_content::{AdminTopic, AdminTopicAdministration, AdminTopicArea};

pub struct PostgresAdminTopicsRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminTopicsRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct AreaRow {
    id: Uuid,
    slug: String,
    title: String,
    description: Option<String>,
    sort_order: i16,
}

#[derive(FromRow)]
struct TopicRow {
    id: Uuid,
    area_id: Uuid,
    slug: String,
    title: String,
    description: Option<String>,
    content: Option<String>,
    is_published: bool,
    parent_id: Option<Uuid>,
}

impl Port for PostgresAdminTopicsRepository<'_> {
    fn list(
        &self,
    ) -> impl std::future::Future<Output = Result<AdminTopicAdministration, AdminTopicsError>> + Send
    {
        async move { list(self.pool).await.map_err(storage_error) }
    }

    fn create_area(
        &self,
        form: &TopicAreaForm,
        after_area_id: Option<Uuid>,
    ) -> impl std::future::Future<Output = Result<Option<AdminTopicArea>, AdminTopicsError>> + Send
    {
        async move {
            create_area(self.pool, form, after_area_id)
                .await
                .map_err(storage_error)
        }
    }

    fn update_area(
        &self,
        area_id: Uuid,
        form: &TopicAreaForm,
    ) -> impl std::future::Future<Output = Result<Option<AdminTopicArea>, AdminTopicsError>> + Send
    {
        async move {
            update_area(self.pool, area_id, form)
                .await
                .map_err(storage_error)
        }
    }

    fn reorder_areas(
        &self,
        area_ids: &[Uuid],
    ) -> impl std::future::Future<Output = Result<bool, AdminTopicsError>> + Send {
        async move {
            reorder_areas(self.pool, area_ids)
                .await
                .map_err(storage_error)
        }
    }

    fn create_topic(
        &self,
        area_id: Uuid,
        form: &TopicForm,
    ) -> impl std::future::Future<Output = Result<Option<AdminTopic>, AdminTopicsError>> + Send
    {
        async move {
            create_topic(self.pool, area_id, form)
                .await
                .map_err(storage_error)
        }
    }

    fn update_topic(
        &self,
        area_id: Uuid,
        topic_id: Uuid,
        form: &TopicForm,
    ) -> impl std::future::Future<Output = Result<Option<AdminTopic>, AdminTopicsError>> + Send
    {
        async move {
            update_topic(self.pool, area_id, topic_id, form)
                .await
                .map_err(storage_error)
        }
    }
}

fn storage_error(error: sqlx::Error) -> AdminTopicsError {
    tracing::error!(%error, "could not persist topic administration");
    AdminTopicsError
}

async fn list(pool: &PgPool) -> Result<AdminTopicAdministration, sqlx::Error> {
    let areas = sqlx::query_as::<_, AreaRow>(
        "SELECT id, slug, title, description, sort_order FROM learning_topic_areas ORDER BY sort_order ASC, title ASC, id ASC",
    )
    .fetch_all(pool)
    .await?;
    let topics = sqlx::query_as::<_, TopicRow>(
        "SELECT id, area_id, slug, title, description, content, published_at IS NOT NULL AS is_published, parent_id FROM learning_topics ORDER BY title ASC, id ASC",
    )
    .fetch_all(pool)
    .await?;
    let mut topics_by_area = std::collections::HashMap::<Uuid, Vec<AdminTopic>>::new();
    for topic in topics {
        topics_by_area
            .entry(topic.area_id)
            .or_default()
            .push(topic.into());
    }
    Ok(AdminTopicAdministration {
        areas: areas
            .into_iter()
            .map(|area| AdminTopicArea {
                id: area.id,
                slug: area.slug,
                title: area.title,
                description: area.description,
                sort_order: area.sort_order,
                topics: topics_by_area.remove(&area.id).unwrap_or_default(),
            })
            .collect(),
    })
}

async fn create_area(
    pool: &PgPool,
    form: &TopicAreaForm,
    after_area_id: Option<Uuid>,
) -> Result<Option<AdminTopicArea>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let areas = locked_areas(&mut transaction).await?;
    if after_area_id.is_some_and(|area_id| !areas.iter().any(|area| area.id == area_id)) {
        return Ok(None);
    }
    let slug = next_area_slug(
        &mut transaction,
        &generated_topic_slug(&form.title, "topic-area"),
    )
    .await?;
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO learning_topic_areas (id, slug, title, description, sort_order) VALUES ($1, $2, $3, $4, 0)",
    )
    .bind(id)
    .bind(slug)
    .bind(&form.title)
    .bind(&form.description)
    .execute(&mut *transaction)
    .await?;
    let mut ordered_ids = areas.into_iter().map(|area| area.id).collect::<Vec<_>>();
    let insert_at = after_area_id
        .and_then(|area_id| {
            ordered_ids
                .iter()
                .position(|id| *id == area_id)
                .map(|index| index + 1)
        })
        .unwrap_or(0);
    ordered_ids.insert(insert_at, id);
    persist_order(&mut transaction, &ordered_ids).await?;
    let area = load_area(&mut transaction, id).await?;
    transaction.commit().await?;
    Ok(area)
}

async fn update_area(
    pool: &PgPool,
    area_id: Uuid,
    form: &TopicAreaForm,
) -> Result<Option<AdminTopicArea>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let updated = sqlx::query_scalar::<_, Uuid>(
        "UPDATE learning_topic_areas SET title = $2, description = $3 WHERE id = $1 RETURNING id",
    )
    .bind(area_id)
    .bind(&form.title)
    .bind(&form.description)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(area_id) = updated else {
        return Ok(None);
    };
    let area = load_area(&mut transaction, area_id).await?;
    transaction.commit().await?;
    Ok(area)
}

async fn reorder_areas(pool: &PgPool, area_ids: &[Uuid]) -> Result<bool, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let stored = locked_areas(&mut transaction).await?;
    let stored_ids = stored.iter().map(|area| area.id).collect::<HashSet<_>>();
    let submitted_ids = area_ids.iter().copied().collect::<HashSet<_>>();
    if area_ids.len() != submitted_ids.len() || stored_ids != submitted_ids {
        return Ok(false);
    }
    persist_order(&mut transaction, area_ids).await?;
    transaction.commit().await?;
    Ok(true)
}

async fn create_topic(
    pool: &PgPool,
    area_id: Uuid,
    form: &TopicForm,
) -> Result<Option<AdminTopic>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    if !area_exists(&mut transaction, area_id).await?
        || !valid_parent(&mut transaction, area_id, form.parent_id).await?
    {
        return Ok(None);
    }
    let slug = next_topic_slug(
        &mut transaction,
        &generated_topic_slug(&form.title, "topic"),
    )
    .await?;
    let id = Uuid::new_v4();
    let topic = sqlx::query_as::<_, TopicRow>(
        "INSERT INTO learning_topics (id, area_id, slug, title, description, content, parent_id, published_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8 THEN NOW() ELSE NULL END) \
         RETURNING id, area_id, slug, title, description, content, published_at IS NOT NULL AS is_published, parent_id",
    )
    .bind(id)
    .bind(area_id)
    .bind(slug)
    .bind(&form.title)
    .bind(&form.description)
    .bind(&form.content)
    .bind(form.parent_id)
    .bind(form.is_published)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(topic.into()))
}

async fn update_topic(
    pool: &PgPool,
    area_id: Uuid,
    topic_id: Uuid,
    form: &TopicForm,
) -> Result<Option<AdminTopic>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    if !valid_parent(&mut transaction, area_id, form.parent_id).await?
        || form.parent_id == Some(topic_id)
    {
        return Ok(None);
    }
    let topic = sqlx::query_as::<_, TopicRow>(
        "UPDATE learning_topics SET title = $3, description = $4, content = $5, parent_id = $6, \
         published_at = CASE WHEN $7 THEN COALESCE(published_at, NOW()) ELSE NULL END \
         WHERE id = $1 AND area_id = $2 \
         RETURNING id, area_id, slug, title, description, content, published_at IS NOT NULL AS is_published, parent_id",
    )
    .bind(topic_id)
    .bind(area_id)
    .bind(&form.title)
    .bind(&form.description)
    .bind(&form.content)
    .bind(form.parent_id)
    .bind(form.is_published)
    .fetch_optional(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(topic.map(Into::into))
}

async fn locked_areas(
    transaction: &mut Transaction<'_, Postgres>,
) -> Result<Vec<AreaRow>, sqlx::Error> {
    sqlx::query_as::<_, AreaRow>(
        "SELECT id, slug, title, description, sort_order FROM learning_topic_areas ORDER BY sort_order ASC, title ASC, id ASC FOR UPDATE",
    )
    .fetch_all(&mut **transaction)
    .await
}

async fn load_area(
    transaction: &mut Transaction<'_, Postgres>,
    area_id: Uuid,
) -> Result<Option<AdminTopicArea>, sqlx::Error> {
    let area = sqlx::query_as::<_, AreaRow>(
        "SELECT id, slug, title, description, sort_order FROM learning_topic_areas WHERE id = $1",
    )
    .bind(area_id)
    .fetch_optional(&mut **transaction)
    .await?;
    let Some(area) = area else {
        return Ok(None);
    };
    let topics = sqlx::query_as::<_, TopicRow>(
        "SELECT id, area_id, slug, title, description, content, published_at IS NOT NULL AS is_published, parent_id FROM learning_topics WHERE area_id = $1 ORDER BY title ASC, id ASC",
    )
    .bind(area_id)
    .fetch_all(&mut **transaction)
    .await?
    .into_iter()
    .map(Into::into)
    .collect();
    Ok(Some(AdminTopicArea {
        id: area.id,
        slug: area.slug,
        title: area.title,
        description: area.description,
        sort_order: area.sort_order,
        topics,
    }))
}

async fn area_exists(
    transaction: &mut Transaction<'_, Postgres>,
    area_id: Uuid,
) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learning_topic_areas WHERE id = $1 FOR UPDATE",
    )
    .bind(area_id)
    .fetch_optional(&mut **transaction)
    .await?
    .is_some())
}

async fn valid_parent(
    transaction: &mut Transaction<'_, Postgres>,
    area_id: Uuid,
    parent_id: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let Some(parent_id) = parent_id else {
        return Ok(true);
    };
    Ok(sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learning_topics WHERE id = $1 AND area_id = $2 FOR UPDATE",
    )
    .bind(parent_id)
    .bind(area_id)
    .fetch_optional(&mut **transaction)
    .await?
    .is_some())
}

async fn next_area_slug(
    transaction: &mut Transaction<'_, Postgres>,
    base: &str,
) -> Result<String, sqlx::Error> {
    next_slug(transaction, "learning_topic_areas", base).await
}

async fn next_topic_slug(
    transaction: &mut Transaction<'_, Postgres>,
    base: &str,
) -> Result<String, sqlx::Error> {
    next_slug(transaction, "learning_topics", base).await
}

async fn next_slug(
    transaction: &mut Transaction<'_, Postgres>,
    table: &str,
    base: &str,
) -> Result<String, sqlx::Error> {
    for suffix in 1..10_000 {
        let candidate = if suffix == 1 {
            base.to_owned()
        } else {
            format!("{base}-{suffix}")
        };
        let query = if table == "learning_topic_areas" {
            "SELECT EXISTS (SELECT 1 FROM learning_topic_areas WHERE slug = $1)"
        } else {
            "SELECT EXISTS (SELECT 1 FROM learning_topics WHERE slug = $1)"
        };
        let exists: bool = sqlx::query_scalar(query)
            .bind(&candidate)
            .fetch_one(&mut **transaction)
            .await?;
        if !exists {
            return Ok(candidate);
        }
    }
    Err(sqlx::Error::Protocol(
        "could not allocate a topic slug".to_owned(),
    ))
}

async fn persist_order(
    transaction: &mut Transaction<'_, Postgres>,
    area_ids: &[Uuid],
) -> Result<(), sqlx::Error> {
    for (index, area_id) in area_ids.iter().enumerate() {
        let Some(sort_order) = i16::try_from((index + 1) * 10).ok() else {
            return Err(sqlx::Error::Protocol(
                "too many topic areas to order".to_owned(),
            ));
        };
        sqlx::query("UPDATE learning_topic_areas SET sort_order = $2 WHERE id = $1")
            .bind(area_id)
            .bind(sort_order)
            .execute(&mut **transaction)
            .await?;
    }
    Ok(())
}

impl From<TopicRow> for AdminTopic {
    fn from(row: TopicRow) -> Self {
        Self {
            id: row.id,
            slug: row.slug,
            title: row.title,
            description: row.description,
            content: row.content,
            is_published: row.is_published,
            parent_id: row.parent_id,
        }
    }
}
