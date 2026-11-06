use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_recall_run::{
    LearnerRecallRunError, LearnerRecallRunRepository as LearnerRecallRunRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerRecallRun,
};

pub struct PostgresLearnerRecallRunRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerRecallRunRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct AvailableRecallItemRow {
    activity_id: Uuid,
    activity_slug: String,
    node_slug: String,
    principal_id: Uuid,
}

#[derive(FromRow)]
struct ExistingRunRow {
    id: Uuid,
}

impl LearnerRecallRunRepositoryPort for PostgresLearnerRecallRunRepository<'_> {
    fn open_or_resume(
        &self,
        principal: &AuthorizedPrincipal,
        recall_item_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<LearnerRecallRun>, LearnerRecallRunError>> + Send
    {
        async move {
            open_or_resume(self.pool, principal, recall_item_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not open learner recall run");
                    LearnerRecallRunError
                })
        }
    }
}

async fn open_or_resume(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    recall_item_id: Uuid,
) -> Result<Option<LearnerRecallRun>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let Some(item) = available_item_for_update(&mut transaction, principal, recall_item_id).await?
    else {
        transaction.commit().await?;
        return Ok(None);
    };

    let existing = sqlx::query_as::<_, ExistingRunRow>(
        "SELECT id FROM learner_recall_runs WHERE principal_id = $1 AND activity_id = $2 AND status = 'in_progress' FOR UPDATE",
    )
    .bind(item.principal_id)
    .bind(item.activity_id)
    .fetch_optional(&mut *transaction)
    .await?;

    let run_id = match existing {
        Some(run) => {
            sqlx::query(
                "UPDATE learner_recall_runs SET last_entered_at = NOW(), updated_at = NOW(), recall_item_id = $2 WHERE id = $1",
            )
            .bind(run.id)
            .bind(recall_item_id)
            .execute(&mut *transaction)
            .await?;
            run.id
        }
        None => {
            let run_id = Uuid::new_v4();
            sqlx::query(
                "INSERT INTO learner_recall_runs (id, principal_id, recall_item_id, activity_id) VALUES ($1, $2, $3, $4)",
            )
            .bind(run_id)
            .bind(item.principal_id)
            .bind(recall_item_id)
            .bind(item.activity_id)
            .execute(&mut *transaction)
            .await?;
            run_id
        }
    };

    transaction.commit().await?;
    Ok(Some(LearnerRecallRun {
        activity_slug: item.activity_slug,
        node_slug: item.node_slug,
        play_run_id: run_id.to_string(),
        status: "in_progress".to_owned(),
    }))
}

async fn available_item_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    recall_item_id: Uuid,
) -> Result<Option<AvailableRecallItemRow>, sqlx::Error> {
    sqlx::query_as::<_, AvailableRecallItemRow>(
        "SELECT items.activity_id, activities.slug AS activity_slug, nodes.slug AS node_slug, items.principal_id FROM learner_recall_items AS items INNER JOIN application_principals AS principals ON principals.id = items.principal_id INNER JOIN learning_activities AS activities ON activities.id = items.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND items.id = $2 AND activities.activity_type = 'question' AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3))) FOR UPDATE OF items",
    )
    .bind(principal.subject_id)
    .bind(recall_item_id)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await
}
