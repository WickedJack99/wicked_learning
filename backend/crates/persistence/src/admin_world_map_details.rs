use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_world_map_details::{
    AdminWorldMapDetailsError, AdminWorldMapDetailsRepository as Port, MapDetailsVersion,
    MapDetailsVersionPage, RestoredWorldMapDetails, UpdateWorldMapDetailsForm,
    UpdatedWorldMapDetails,
};
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

pub struct PostgresAdminWorldMapDetailsRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminWorldMapDetailsRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresAdminWorldMapDetailsRepository<'_> {
    fn update_map_details(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        form: &UpdateWorldMapDetailsForm,
        expected_updated_at: &str,
    ) -> impl std::future::Future<
        Output = Result<Option<UpdatedWorldMapDetails>, AdminWorldMapDetailsError>,
    > + Send {
        async move {
            update_map_details(self.pool, principal, map_id, form, expected_updated_at)
                .await
                .map_err(map_error)
        }
    }

    fn list_map_versions(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        page: u32,
        per_page: u32,
    ) -> impl std::future::Future<
        Output = Result<Option<MapDetailsVersionPage>, AdminWorldMapDetailsError>,
    > + Send {
        async move {
            list_map_versions(self.pool, principal, map_id, page, per_page)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not list scoped map detail versions");
                    AdminWorldMapDetailsError::Unavailable
                })
        }
    }

    fn restore_map_version(
        &self,
        principal: &AuthorizedPrincipal,
        map_id: Uuid,
        version_id: Uuid,
    ) -> impl std::future::Future<
        Output = Result<Option<RestoredWorldMapDetails>, AdminWorldMapDetailsError>,
    > + Send {
        async move {
            restore_map_version(self.pool, principal, map_id, version_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not restore scoped map detail version");
                    AdminWorldMapDetailsError::Unavailable
                })
        }
    }
}

#[derive(FromRow)]
struct ScopedMap {
    creator_id: Option<Uuid>,
    map_assets_locked: bool,
    description: String,
    title: String,
    topic_id: Option<Uuid>,
    updated_at: String,
}

#[derive(FromRow)]
struct VersionRow {
    id: Uuid,
    title: String,
    description: String,
    topic_id: Option<Uuid>,
    map_assets_locked: bool,
    created_at: String,
}

enum MapDetailsMutationError {
    InvalidTopic,
    Conflict,
    Storage(sqlx::Error),
}

fn map_error(error: MapDetailsMutationError) -> AdminWorldMapDetailsError {
    match error {
        MapDetailsMutationError::InvalidTopic => AdminWorldMapDetailsError::InvalidTopic,
        MapDetailsMutationError::Conflict => AdminWorldMapDetailsError::Conflict,
        MapDetailsMutationError::Storage(error) => {
            tracing::error!(%error, "could not update scoped World Builder map details");
            AdminWorldMapDetailsError::Unavailable
        }
    }
}

impl From<sqlx::Error> for MapDetailsMutationError {
    fn from(error: sqlx::Error) -> Self {
        Self::Storage(error)
    }
}

async fn update_map_details(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_id: Uuid,
    form: &UpdateWorldMapDetailsForm,
    expected_updated_at: &str,
) -> Result<Option<UpdatedWorldMapDetails>, MapDetailsMutationError> {
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
    let Some(map) = sqlx::query_as::<_, ScopedMap>(
        "SELECT created_by_principal_id AS creator_id, map_assets_locked, description, title, topic_id, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_maps WHERE id = $1 FOR UPDATE",
    )
    .bind(map_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    if !can_update_map(
        &mut transaction,
        principal,
        principal_id,
        map_id,
        map.creator_id,
    )
    .await?
    {
        return Ok(None);
    }
    if map.updated_at != expected_updated_at {
        return Err(MapDetailsMutationError::Conflict);
    }
    if let Some(topic_id) = form.topic_id {
        let topic_exists: bool =
            sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_topics WHERE id = $1)")
                .bind(topic_id)
                .fetch_one(&mut *transaction)
                .await?;
        if !topic_exists {
            return Err(MapDetailsMutationError::InvalidTopic);
        }
    }
    snapshot_map_details(&mut transaction, map_id, principal_id, &map).await?;
    let updated_at: String = sqlx::query_scalar(
        "UPDATE learning_maps SET title = $2, description = $3, topic_id = $4, map_assets_locked = $5, updated_at = NOW() WHERE id = $1 RETURNING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')",
    )
    .bind(map_id)
    .bind(&form.title)
    .bind(&form.description)
    .bind(form.topic_id)
    .bind(form.map_assets_locked)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(UpdatedWorldMapDetails { map_id, updated_at }))
}

async fn list_map_versions(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_id: Uuid,
    page: u32,
    per_page: u32,
) -> Result<Option<MapDetailsVersionPage>, sqlx::Error> {
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
    let Some(map) = sqlx::query_as::<_, ScopedMap>(
        "SELECT created_by_principal_id AS creator_id, map_assets_locked, description, title, topic_id, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_maps WHERE id = $1",
    )
    .bind(map_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    if !can_update_map(
        &mut transaction,
        principal,
        principal_id,
        map_id,
        map.creator_id,
    )
    .await?
    {
        return Ok(None);
    }
    let total: i64 =
        sqlx::query_scalar("SELECT count(*) FROM learning_map_versions WHERE map_id = $1")
            .bind(map_id)
            .fetch_one(&mut *transaction)
            .await?;
    let offset = i64::from(page.saturating_sub(1)) * i64::from(per_page);
    let rows = sqlx::query_as::<_, VersionRow>(
        "SELECT id, title, description, topic_id, map_assets_locked, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at FROM learning_map_versions WHERE map_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3",
    )
    .bind(map_id)
    .bind(i64::from(per_page))
    .bind(offset)
    .fetch_all(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(MapDetailsVersionPage {
        items: rows.into_iter().map(version_from_row).collect(),
        page,
        per_page,
        total: total.max(0) as u64,
    }))
}

async fn restore_map_version(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    map_id: Uuid,
    version_id: Uuid,
) -> Result<Option<RestoredWorldMapDetails>, sqlx::Error> {
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
    let Some(map) = sqlx::query_as::<_, ScopedMap>(
        "SELECT created_by_principal_id AS creator_id, map_assets_locked, description, title, topic_id, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_maps WHERE id = $1 FOR UPDATE",
    )
    .bind(map_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    if !can_update_map(
        &mut transaction,
        principal,
        principal_id,
        map_id,
        map.creator_id,
    )
    .await?
    {
        return Ok(None);
    }
    let Some(version) = sqlx::query_as::<_, VersionRow>(
        "SELECT id, title, description, topic_id, map_assets_locked, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at FROM learning_map_versions WHERE id = $1 AND map_id = $2",
    )
    .bind(version_id)
    .bind(map_id)
    .fetch_optional(&mut *transaction)
    .await?
    else {
        return Ok(None);
    };
    snapshot_map_details(&mut transaction, map_id, principal_id, &map).await?;
    let updated_at: String = sqlx::query_scalar(
        "UPDATE learning_maps SET title = $2, description = $3, topic_id = $4, map_assets_locked = $5, updated_at = NOW() WHERE id = $1 RETURNING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')",
    )
    .bind(map_id)
    .bind(&version.title)
    .bind(&version.description)
    .bind(version.topic_id)
    .bind(version.map_assets_locked)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(RestoredWorldMapDetails {
        map_id,
        title: version.title,
        description: version.description,
        topic_id: version.topic_id,
        map_assets_locked: version.map_assets_locked,
        updated_at,
    }))
}

async fn snapshot_map_details(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    map_id: Uuid,
    principal_id: Uuid,
    map: &ScopedMap,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO learning_map_versions (id, map_id, changed_by_principal_id, title, description, topic_id, map_assets_locked) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(Uuid::new_v4())
    .bind(map_id)
    .bind(principal_id)
    .bind(&map.title)
    .bind(&map.description)
    .bind(map.topic_id)
    .bind(map.map_assets_locked)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

fn version_from_row(row: VersionRow) -> MapDetailsVersion {
    MapDetailsVersion {
        id: row.id,
        title: row.title,
        description: row.description,
        topic_id: row.topic_id,
        map_assets_locked: row.map_assets_locked,
        created_at: row.created_at,
    }
}

async fn can_update_map(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let direct_editor: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS editing_groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = editing_groups.group_id WHERE editing_groups.map_id = $1 AND memberships.principal_id = $2)",
    )
    .bind(map_id)
    .bind(principal_id)
    .fetch_one(&mut **transaction)
    .await?;
    let Some(scope) = principal.permission_scope("world_maps", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct_editor)
        || direct_editor)
}
