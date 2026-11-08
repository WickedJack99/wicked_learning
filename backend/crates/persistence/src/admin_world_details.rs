use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_world_details::{
    AdminWorldDetailsError, AdminWorldDetailsRepository as Port, UpdateWorldDetailsForm,
    UpdatedWorldDetails, WorldDetailsVersion, WorldDetailsVersionPage,
};
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

pub struct PostgresAdminWorldDetailsRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldDetailsRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldDetailsRepository<'_> {
    fn update_world_details(
        &self,
        principal: &AuthorizedPrincipal,
        form: &UpdateWorldDetailsForm,
        expected_updated_at: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<UpdatedWorldDetails>, AdminWorldDetailsError>,
    > + Send {
        async move {
            update(self.pool, principal, form, expected_updated_at)
                .await
                .map_err(world_error)
        }
    }

    fn list_world_versions(
        &self,
        principal: &AuthorizedPrincipal,
        page: u32,
        per_page: u32,
    ) -> impl std::future::Future<
        Output = Result<Option<WorldDetailsVersionPage>, AdminWorldDetailsError>,
    > + Send {
        async move {
            list_versions(self.pool, principal, page, per_page)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not list current World detail versions");
                    AdminWorldDetailsError::Unavailable
                })
        }
    }

    fn restore_world_version(
        &self,
        principal: &AuthorizedPrincipal,
        version_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<UpdatedWorldDetails>, AdminWorldDetailsError>,
    > + Send {
        async move {
            restore_version(self.pool, principal, version_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not restore current World detail version");
                    AdminWorldDetailsError::Unavailable
                })
        }
    }
}

#[derive(FromRow)]
struct CurrentWorld {
    id: Uuid,
    title: String,
    description: String,
    updated_at: String,
}

#[derive(FromRow)]
struct VersionRow {
    id: Uuid,
    title: String,
    description: String,
    created_at: String,
}

enum WorldDetailsMutationError {
    Conflict,
    Storage(sqlx::Error),
}

fn world_error(error: WorldDetailsMutationError) -> AdminWorldDetailsError {
    match error {
        WorldDetailsMutationError::Conflict => AdminWorldDetailsError::Conflict,
        WorldDetailsMutationError::Storage(error) => {
            tracing::error!(%error, "could not update current World details");
            AdminWorldDetailsError::Unavailable
        }
    }
}

impl From<sqlx::Error> for WorldDetailsMutationError {
    fn from(error: sqlx::Error) -> Self {
        Self::Storage(error)
    }
}

async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    form: &UpdateWorldDetailsForm,
    expected_updated_at: &str,
) -> Result<Option<UpdatedWorldDetails>, WorldDetailsMutationError> {
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
    let Some(world) = sqlx::query_as::<_, CurrentWorld>(
        "SELECT id, title, description, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_worlds ORDER BY created_at ASC, slug ASC LIMIT 1 FOR UPDATE",
    )
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    if world.updated_at != expected_updated_at {
        return Err(WorldDetailsMutationError::Conflict);
    }
    sqlx::query("INSERT INTO learning_world_versions (id,world_id,changed_by_principal_id,title,description) VALUES ($1,$2,$3,$4,$5)")
        .bind(Uuid::new_v4())
        .bind(world.id)
        .bind(principal_id)
        .bind(&world.title)
        .bind(&world.description)
        .execute(&mut *transaction)
        .await?;
    let updated_at: String = sqlx::query_scalar(
        "UPDATE learning_worlds SET title = $2, description = $3, updated_at = NOW() WHERE id = $1 RETURNING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')",
    )
    .bind(world.id)
    .bind(&form.title)
    .bind(&form.description)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(UpdatedWorldDetails {
        id: world.id,
        title: form.title.clone(),
        description: form.description.clone(),
        updated_at,
    }))
}

async fn list_versions(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    page: u32,
    per_page: u32,
) -> Result<Option<WorldDetailsVersionPage>, sqlx::Error> {
    let principal_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM application_principals WHERE identity_subject_id = $1)",
    )
    .bind(principal.subject_id)
    .fetch_one(pool)
    .await?;
    if !principal_exists {
        return Ok(None);
    }
    let Some(world_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM learning_worlds ORDER BY created_at ASC, slug ASC LIMIT 1",
    )
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };
    let total: i64 =
        sqlx::query_scalar("SELECT count(*) FROM learning_world_versions WHERE world_id = $1")
            .bind(world_id)
            .fetch_one(pool)
            .await?;
    let offset = i64::from(page.saturating_sub(1)) * i64::from(per_page);
    let rows = sqlx::query_as::<_, VersionRow>(
        "SELECT id, title, description, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at FROM learning_world_versions WHERE world_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3",
    )
    .bind(world_id)
    .bind(i64::from(per_page))
    .bind(offset)
    .fetch_all(pool)
    .await?;
    Ok(Some(WorldDetailsVersionPage {
        items: rows
            .into_iter()
            .map(|row| WorldDetailsVersion {
                id: row.id,
                title: row.title,
                description: row.description,
                created_at: row.created_at,
            })
            .collect(),
        page,
        per_page,
        total: total.max(0) as u64,
    }))
}

async fn restore_version(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    version_id: Uuid,
) -> Result<Option<UpdatedWorldDetails>, sqlx::Error> {
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
    let Some(world) = sqlx::query_as::<_, CurrentWorld>(
        "SELECT id, title, description, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_worlds ORDER BY created_at ASC, slug ASC LIMIT 1 FOR UPDATE",
    )
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    let Some(version) = sqlx::query_as::<_, VersionRow>(
        "SELECT id, title, description, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at FROM learning_world_versions WHERE id = $1 AND world_id = $2",
    )
    .bind(version_id)
    .bind(world.id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    sqlx::query("INSERT INTO learning_world_versions (id,world_id,changed_by_principal_id,title,description) VALUES ($1,$2,$3,$4,$5)")
        .bind(Uuid::new_v4()).bind(world.id).bind(principal_id).bind(&world.title).bind(&world.description).execute(&mut *transaction).await?;
    let updated_at: String = sqlx::query_scalar("UPDATE learning_worlds SET title = $2, description = $3, updated_at = NOW() WHERE id = $1 RETURNING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')")
        .bind(world.id).bind(&version.title).bind(&version.description).fetch_one(&mut *transaction).await?;
    transaction.commit().await?;
    Ok(Some(UpdatedWorldDetails {
        id: world.id,
        title: version.title,
        description: version.description,
        updated_at,
    }))
}
