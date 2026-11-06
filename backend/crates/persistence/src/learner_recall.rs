use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_recall::{
    LearnerRecallError, LearnerRecallRepository as LearnerRecallRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerRecallItem, LearnerRecallQueue},
};

const MAXIMUM_RECALL_ITEMS: i64 = 24;

pub struct PostgresLearnerRecallRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerRecallRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct RecallItemRow {
    activity_slug: String,
    activity_title: String,
    is_due: bool,
    last_confidence: Option<String>,
    last_confidence_after_feedback: Option<String>,
    last_outcome: Option<String>,
    last_reviewed_at: Option<String>,
    map_title: String,
    next_review_at: String,
    node_slug: String,
    node_title: String,
    prompt: String,
    recall_item_id: Uuid,
    review_count: i32,
}

#[derive(FromRow)]
struct ActiveQuestionRow {
    activity_id: Uuid,
    principal_id: Uuid,
}

impl LearnerRecallRepositoryPort for PostgresLearnerRecallRepository<'_> {
    fn list(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl std::future::Future<Output = Result<LearnerRecallQueue, LearnerRecallError>> + Send
    {
        async move {
            list(self.pool, principal).await.map_err(|error| {
                tracing::error!(%error, "could not load learner recall queue");
                LearnerRecallError
            })
        }
    }

    fn queue_current_question(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl std::future::Future<Output = Result<Option<LearnerRecallItem>, LearnerRecallError>> + Send
    {
        async move {
            queue_current_question(self.pool, principal, play_run_id, activity_slug)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not queue learner recall question");
                    LearnerRecallError
                })
        }
    }

    fn remove(
        &self,
        principal: &AuthorizedPrincipal,
        recall_item_id: Uuid,
    ) -> impl std::future::Future<Output = Result<bool, LearnerRecallError>> + Send {
        async move {
            remove(self.pool, principal, recall_item_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not remove learner recall question");
                    LearnerRecallError
                })
        }
    }

    fn postpone(
        &self,
        principal: &AuthorizedPrincipal,
        recall_item_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<LearnerRecallItem>, LearnerRecallError>> + Send
    {
        async move {
            postpone(self.pool, principal, recall_item_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not postpone learner recall question");
                    LearnerRecallError
                })
        }
    }
}

async fn list(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<LearnerRecallQueue, sqlx::Error> {
    let items = sqlx::query_as::<_, RecallItemRow>(&recall_item_select(
        "items.principal_id = principals.id",
        "ORDER BY CASE WHEN items.next_review_at <= NOW() THEN 0 ELSE 1 END, items.next_review_at ASC, items.created_at DESC, items.id DESC LIMIT $3",
    ))
    .bind(principal.subject_id)
    .bind(&principal.roles)
    .bind(MAXIMUM_RECALL_ITEMS)
    .fetch_all(pool)
    .await?;

    Ok(LearnerRecallQueue {
        items: items.into_iter().map(recall_item).collect(),
    })
}

async fn queue_current_question(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<LearnerRecallItem>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(question) =
        active_question_for_update(&mut transaction, principal, play_run_id, activity_slug).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };

    let recall_item_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO learner_recall_items (principal_id, activity_id) VALUES ($1, $2) ON CONFLICT (principal_id, activity_id) DO UPDATE SET updated_at = learner_recall_items.updated_at RETURNING id",
    )
    .bind(question.principal_id)
    .bind(question.activity_id)
    .fetch_one(&mut *transaction)
    .await?;
    let item = load_item_for_update(&mut transaction, principal, recall_item_id).await?;
    transaction.commit().await?;

    Ok(item.map(recall_item))
}

async fn remove(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    recall_item_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(item) = load_item_for_update(&mut transaction, principal, recall_item_id).await?
    else {
        transaction.commit().await?;
        return Ok(false);
    };
    let deleted = sqlx::query(
        "DELETE FROM learner_recall_items WHERE id = $1 AND principal_id = (SELECT id FROM application_principals WHERE identity_subject_id = $2)",
    )
    .bind(item.recall_item_id)
    .bind(principal.subject_id)
    .execute(&mut *transaction)
    .await?
    .rows_affected()
        == 1;
    transaction.commit().await?;

    Ok(deleted)
}

async fn postpone(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    recall_item_id: Uuid,
) -> Result<Option<LearnerRecallItem>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(item) = load_item_for_update(&mut transaction, principal, recall_item_id).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };
    sqlx::query(
        "UPDATE learner_recall_items SET next_review_at = GREATEST(next_review_at, NOW()) + INTERVAL '1 day', updated_at = NOW() WHERE id = $1",
    )
    .bind(item.recall_item_id)
    .execute(&mut *transaction)
    .await?;
    let item = load_item_for_update(&mut transaction, principal, recall_item_id).await?;
    transaction.commit().await?;

    Ok(item.map(recall_item))
}

/// Finds the active question from any server-owned run type. Each branch
/// applies the same publication/access predicate, so an opaque run ID alone
/// can never turn a queue control into a visibility bypass.
async fn active_question_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    play_run_id: Uuid,
    activity_slug: &str,
) -> Result<Option<ActiveQuestionRow>, sqlx::Error> {
    sqlx::query_as::<_, ActiveQuestionRow>(
        "SELECT progress.current_activity_id AS activity_id, progress.principal_id FROM learner_route_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learning_activity_starts AS starts ON starts.id = progress.activity_start_id INNER JOIN learning_nodes AS nodes ON nodes.id = starts.node_id INNER JOIN learning_activities AS activities ON activities.id = progress.current_activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND progress.current_play_run_id = $2 AND progress.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'question' AND nodes.map_asset_id = assets.id AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) UNION ALL SELECT runs.activity_id, runs.principal_id FROM learner_revisit_runs AS runs INNER JOIN application_principals AS principals ON principals.id = runs.principal_id INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'question' AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) UNION ALL SELECT runs.activity_id, runs.principal_id FROM learner_recall_runs AS runs INNER JOIN application_principals AS principals ON principals.id = runs.principal_id INNER JOIN learning_activities AS activities ON activities.id = runs.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND runs.id = $2 AND runs.status = 'in_progress' AND activities.slug = $3 AND activities.activity_type = 'question' AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($4))) LIMIT 1",
    )
    .bind(principal.subject_id)
    .bind(play_run_id)
    .bind(activity_slug)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await
}

async fn load_item_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    recall_item_id: Uuid,
) -> Result<Option<RecallItemRow>, sqlx::Error> {
    sqlx::query_as::<_, RecallItemRow>(&recall_item_select(
        "items.id = $3 AND items.principal_id = principals.id",
        "FOR UPDATE OF items",
    ))
    .bind(principal.subject_id)
    .bind(&principal.roles)
    .bind(recall_item_id)
    .fetch_optional(&mut **transaction)
    .await
}

fn recall_item_select(predicate: &str, tail: &str) -> String {
    format!(
        "SELECT items.id AS recall_item_id, activities.slug AS activity_slug, activities.title AS activity_title, maps.title AS map_title, nodes.slug AS node_slug, nodes.title AS node_title, COALESCE(activities.activity_config ->> 'prompt', activities.title) AS prompt, items.next_review_at <= NOW() AS is_due, items.last_confidence, items.last_confidence_after_feedback, items.last_outcome, to_char(items.last_reviewed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS last_reviewed_at, to_char(items.next_review_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS next_review_at, items.review_count FROM learner_recall_items AS items INNER JOIN application_principals AS principals ON principals.id = items.principal_id INNER JOIN learning_activities AS activities ON activities.id = items.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND {predicate} AND activities.activity_type = 'question' AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($2))) {tail}"
    )
}

fn recall_item(row: RecallItemRow) -> LearnerRecallItem {
    LearnerRecallItem {
        recall_item_id: row.recall_item_id.to_string(),
        activity_slug: row.activity_slug,
        activity_title: row.activity_title,
        map_title: row.map_title,
        node_slug: row.node_slug,
        node_title: row.node_title,
        prompt: row.prompt,
        is_due: row.is_due,
        last_confidence: row.last_confidence,
        last_confidence_after_feedback: row.last_confidence_after_feedback,
        last_outcome: row.last_outcome,
        last_reviewed_at: row.last_reviewed_at,
        next_review_at: row.next_review_at,
        review_count: row.review_count,
    }
}

#[cfg(test)]
mod tests {
    use super::MAXIMUM_RECALL_ITEMS;

    #[test]
    fn keeps_the_source_queue_bound() {
        assert_eq!(MAXIMUM_RECALL_ITEMS, 24);
    }
}
