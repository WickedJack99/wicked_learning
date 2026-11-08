use crate::admin_world_activity_history::record_activity_version;
use serde_json::{Map, Value, json};
use sqlx::{FromRow, PgPool, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_activity_completion_choice::ActivityCompletionChoiceForm;
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};
pub struct PostgresAdminActivityCompletionChoiceRepository<'pool> {
    pool: &'pool PgPool,
}
impl<'pool> PostgresAdminActivityCompletionChoiceRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ActivityCompletionChoiceForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedActivityCompletionChoice>, ActivityCompletionChoiceError> {
        update(self.pool, principal, activity_id, form, expected_updated_at)
            .await
            .map_err(|error| match error {
                MutationError::Conflict => ActivityCompletionChoiceError::Conflict,
                MutationError::Storage(error) => {
                    tracing::error!(%error, "could not update activity completion-choice context");
                    ActivityCompletionChoiceError::Unavailable
                }
            })
    }
}
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ActivityCompletionChoiceError {
    Conflict,
    Unavailable,
}
pub struct UpdatedActivityCompletionChoice {
    pub activity_id: Uuid,
    pub updated_at: String,
}
#[derive(FromRow)]
struct ScopedActivity {
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
    config: Value,
    updated_at: String,
}
enum MutationError {
    Conflict,
    Storage(sqlx::Error),
}
impl From<sqlx::Error> for MutationError {
    fn from(error: sqlx::Error) -> Self {
        Self::Storage(error)
    }
}
async fn update(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    activity_id: Uuid,
    form: &ActivityCompletionChoiceForm,
    expected_updated_at: &str,
) -> Result<Option<UpdatedActivityCompletionChoice>, MutationError> {
    let mut tx = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut tx, principal).await? else {
        return Ok(None);
    };
    let Some(current) = lock(&mut tx, activity_id).await? else {
        return Ok(None);
    };
    if !can_edit(
        &mut tx,
        principal,
        principal_id,
        current.map_id,
        current.map_creator_id,
    )
    .await?
    {
        return Ok(None);
    }
    if current.updated_at != expected_updated_at {
        return Err(MutationError::Conflict);
    }
    let mut config = current.config.as_object().cloned().unwrap_or_else(Map::new);
    match &form.prompt {
        Some(prompt) => {
            config.insert("completionChoicePrompt".to_owned(), json!(prompt));
        }
        None => {
            config.remove("completionChoicePrompt");
        }
    }
    let config = Value::Object(config);
    if config == current.config {
        tx.commit().await?;
        return Ok(Some(UpdatedActivityCompletionChoice {
            activity_id,
            updated_at: current.updated_at,
        }));
    }
    record_activity_version(&mut tx, activity_id, principal).await?;
    let updated_at: String = sqlx::query_scalar("UPDATE learning_activities SET activity_config = $2, ai_review_status = 'needs_review', ai_reviewed_at = NULL, ai_review = NULL, updated_at = NOW() WHERE id = $1 RETURNING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\')").bind(activity_id).bind(config).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok(Some(UpdatedActivityCompletionChoice {
        activity_id,
        updated_at,
    }))
}
async fn lock(
    tx: &mut Transaction<'_, sqlx::Postgres>,
    activity_id: Uuid,
) -> Result<Option<ScopedActivity>, sqlx::Error> {
    sqlx::query_as("SELECT nodes.map_id, maps.created_by_principal_id AS map_creator_id, activities.activity_config AS config, to_char(activities.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 FOR UPDATE OF activities, nodes").bind(activity_id).fetch_optional(&mut **tx).await
}
async fn principal_id(
    tx: &mut Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(&mut **tx)
        .await
}
async fn can_edit(
    tx: &mut Transaction<'_, sqlx::Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let direct: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)").bind(map_id).bind(principal_id).fetch_one(&mut **tx).await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct)
        || direct)
}
