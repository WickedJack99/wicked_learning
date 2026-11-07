use sqlx::PgPool;
use uuid::Uuid;
use wicked_learning_application::admin_world_map_create::{
    AdminWorldMapCreateError, AdminWorldMapCreateRepository as Port, CreateWorldMapForm,
    generated_map_slug,
};
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

pub struct PostgresAdminWorldMapCreateRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldMapCreateRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldMapCreateRepository<'_> {
    fn create_map(
        &self,
        principal: &AuthorizedPrincipal,
        form: &CreateWorldMapForm,
    ) -> impl std::future::Future<Output = Result<Option<Uuid>, AdminWorldMapCreateError>> + Send
    {
        async move {
            create_map(self.pool, principal, form)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not create World Builder map");
                    AdminWorldMapCreateError
                })
        }
    }
}

async fn create_map(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    form: &CreateWorldMapForm,
) -> Result<Option<Uuid>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    let Some(world_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learning_worlds ORDER BY created_at ASC, slug ASC LIMIT 1 FOR UPDATE",
    )
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    let base = form
        .slug
        .clone()
        .unwrap_or_else(|| generated_map_slug(&form.title));
    let slug = unique_slug(&mut transaction, world_id, &base, form.slug.is_some()).await?;
    if slug.is_empty() {
        return Ok(None);
    }
    let position: i16 = sqlx::query_scalar(
        "SELECT (COALESCE(MAX(position), -1)::integer + 1)::smallint FROM learning_maps WHERE world_id = $1",
    ).bind(world_id).fetch_one(&mut *transaction).await?;
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO learning_maps (id, world_id, slug, title, description, position, created_by_principal_id, published_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)",
    ).bind(id).bind(world_id).bind(slug).bind(&form.title).bind(form.description.as_deref().unwrap_or("")).bind(position).bind(principal_id).execute(&mut *transaction).await?;
    transaction.commit().await?;
    Ok(Some(id))
}

async fn unique_slug(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    world_id: Uuid,
    base: &str,
    explicit: bool,
) -> Result<String, sqlx::Error> {
    let mut candidate = base.to_owned();
    for suffix in 2..10_000 {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM learning_maps WHERE world_id = $1 AND slug = $2)",
        )
        .bind(world_id)
        .bind(&candidate)
        .fetch_one(&mut **transaction)
        .await?;
        if !exists {
            return Ok(candidate);
        }
        if explicit {
            return Ok(String::new());
        }
        candidate = format!("{base}-{suffix}");
        if candidate.len() > 140 {
            return Ok(String::new());
        }
    }
    Ok(String::new())
}
