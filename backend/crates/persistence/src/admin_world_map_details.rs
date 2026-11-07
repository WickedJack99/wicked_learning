use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_world_map_details::{
    AdminWorldMapDetailsError, AdminWorldMapDetailsRepository as Port, UpdateWorldMapDetailsForm,
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
    if map.title == form.title
        && map.description == form.description
        && map.topic_id == form.topic_id
        && map.map_assets_locked == form.map_assets_locked
    {
        transaction.commit().await?;
        return Ok(Some(UpdatedWorldMapDetails {
            map_id,
            updated_at: map.updated_at,
        }));
    }
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
