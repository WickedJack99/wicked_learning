use serde_json::{Map, Value, json};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::admin_activity_learning_design::LearningDesignForm;
use wicked_learning_domain::identity_access::{AuthorizedPrincipal, permission_scope_allows};

use crate::admin_world_activity_history::record_activity_version;

pub struct PostgresAdminActivityLearningDesignRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminActivityLearningDesignRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &LearningDesignForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedLearningDesign>, ActivityLearningDesignError> {
        update(self.pool, principal, activity_id, form, expected_updated_at)
            .await
            .map_err(|error| match error {
                MutationError::Conflict => ActivityLearningDesignError::Conflict,
                MutationError::Storage(error) => {
                    tracing::error!(%error, "could not update activity learning-design metadata");
                    ActivityLearningDesignError::Unavailable
                }
            })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ActivityLearningDesignError {
    Conflict,
    Unavailable,
}

pub struct UpdatedLearningDesign {
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
    form: &LearningDesignForm,
    expected_updated_at: &str,
) -> Result<Option<UpdatedLearningDesign>, MutationError> {
    let mut transaction = pool.begin().await?;
    let Some(principal_id) = principal_id(&mut transaction, principal).await? else {
        return Ok(None);
    };
    let Some(current) = lock_scoped_activity(&mut transaction, activity_id).await? else {
        return Ok(None);
    };
    if !can_edit(
        &mut transaction,
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
    match &form.learning_intent {
        Some(intent) => {
            config.insert("learningIntent".to_owned(), json!(intent));
        }
        None => {
            config.remove("learningIntent");
        }
    }
    if form.competence_topics.is_empty() {
        config.remove("competenceTopics");
    } else {
        config.insert(
            "competenceTopics".to_owned(),
            json!(
                form.competence_topics
                    .iter()
                    .map(|topic| json!({
                        "topic": topic.name,
                        "slug": topic.slug,
                        "weight": topic.weight,
                    }))
                    .collect::<Vec<_>>()
            ),
        );
    }
    let config = Value::Object(config);
    if config == current.config {
        transaction.commit().await?;
        return Ok(Some(UpdatedLearningDesign {
            activity_id,
            updated_at: current.updated_at,
        }));
    }
    record_activity_version(&mut transaction, activity_id, principal).await?;
    ensure_topic_definitions(&mut transaction, form).await?;
    let updated_at: String = sqlx::query_scalar(
        "UPDATE learning_activities SET activity_config = $2, ai_review_status = 'needs_review', ai_reviewed_at = NULL, ai_review = NULL, updated_at = NOW() WHERE id = $1 RETURNING to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')",
    )
    .bind(activity_id)
    .bind(config)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(UpdatedLearningDesign {
        activity_id,
        updated_at,
    }))
}

async fn ensure_topic_definitions(
    transaction: &mut Transaction<'_, Postgres>,
    form: &LearningDesignForm,
) -> Result<(), sqlx::Error> {
    for topic in &form.competence_topics {
        sqlx::query(
            "INSERT INTO competence_topic_definitions (slug, name, description, growth_threshold, emittance_threshold, aura_threshold, is_active) VALUES ($1, $2, NULL, 20, 20, 10, TRUE) ON CONFLICT (slug) DO NOTHING",
        )
        .bind(&topic.slug)
        .bind(&topic.name)
        .execute(&mut **transaction)
        .await?;
    }
    Ok(())
}

async fn lock_scoped_activity(
    transaction: &mut Transaction<'_, Postgres>,
    activity_id: Uuid,
) -> Result<Option<ScopedActivity>, sqlx::Error> {
    sqlx::query_as(
        "SELECT nodes.map_id, maps.created_by_principal_id AS map_creator_id, activities.activity_config AS config, to_char(activities.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM learning_activities AS activities INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE activities.id = $1 FOR UPDATE OF activities, nodes",
    )
    .bind(activity_id)
    .fetch_optional(&mut **transaction)
    .await
}

async fn principal_id(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(&mut **transaction)
        .await
}

async fn can_edit(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    principal_id: Uuid,
    map_id: Uuid,
    map_creator_id: Option<Uuid>,
) -> Result<bool, sqlx::Error> {
    let direct: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM learning_map_editing_groups AS groups INNER JOIN learning_group_memberships AS memberships ON memberships.group_id = groups.group_id WHERE groups.map_id = $1 AND memberships.principal_id = $2)",
    )
    .bind(map_id)
    .bind(principal_id)
    .fetch_one(&mut **transaction)
    .await?;
    let Some(scope) = principal.permission_scope("world_activities", "ru") else {
        return Ok(false);
    };
    Ok(scope == "all"
        || (permission_scope_allows(scope, "own") && map_creator_id == Some(principal_id))
        || (permission_scope_allows(scope, "assigned") && direct)
        || direct)
}
