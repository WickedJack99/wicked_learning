use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::learner_revisit_run::{
    LearnerRevisitRunError, LearnerRevisitRunRepository as LearnerRevisitRunRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerRevisitRun,
};

pub struct PostgresLearnerRevisitRunRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerRevisitRunRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl LearnerRevisitRunRepositoryPort for PostgresLearnerRevisitRunRepository<'_> {
    fn open_or_resume_due_invitation(
        &self,
        principal: &AuthorizedPrincipal,
        check_in_id: Uuid,
    ) -> impl std::future::Future<Output = Result<Option<LearnerRevisitRun>, LearnerRevisitRunError>>
    + Send {
        async move {
            open_or_resume_due_invitation(self.pool, principal, check_in_id)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not open learner revisit run");
                    LearnerRevisitRunError
                })
        }
    }
}

#[derive(FromRow)]
struct DueInvitationRow {
    activity_slug: String,
    node_slug: String,
    principal_id: Uuid,
    revisit_status: String,
}

#[derive(FromRow)]
struct ExistingRunRow {
    id: Uuid,
    status: String,
}

async fn open_or_resume_due_invitation(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    check_in_id: Uuid,
) -> Result<Option<LearnerRevisitRun>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let due = resolve_due_invitation_for_update(&mut transaction, principal, check_in_id).await?;
    let Some(due) = due else {
        transaction.commit().await?;
        return Ok(None);
    };

    let existing = sqlx::query_as::<_, ExistingRunRow>(
        "SELECT id, status FROM learner_revisit_runs WHERE check_in_id = $1 FOR UPDATE",
    )
    .bind(check_in_id)
    .fetch_optional(&mut *transaction)
    .await?;

    let run_id = match existing {
        Some(run) if run.status == "in_progress" => {
            sqlx::query(
                "UPDATE learner_revisit_runs SET last_entered_at = NOW(), updated_at = NOW() WHERE id = $1",
            )
            .bind(run.id)
            .execute(&mut *transaction)
            .await?;
            run.id
        }
        Some(_) => {
            transaction.commit().await?;
            return Ok(None);
        }
        None => {
            let run_id = Uuid::new_v4();
            sqlx::query(
                "INSERT INTO learner_revisit_runs (id, principal_id, check_in_id, activity_id, revisit_reason) SELECT $1, $2, $3, check_ins.activity_id, $4 FROM learner_activity_check_ins AS check_ins WHERE check_ins.id = $3",
            )
            .bind(run_id)
            .bind(due.principal_id)
            .bind(check_in_id)
            .bind(revisit_reason(&due.revisit_status))
            .execute(&mut *transaction)
            .await?;
            run_id
        }
    };

    transaction.commit().await?;
    Ok(Some(LearnerRevisitRun {
        activity_slug: due.activity_slug,
        node_slug: due.node_slug,
        play_run_id: run_id.to_string(),
        status: "in_progress".to_owned(),
    }))
}

async fn resolve_due_invitation_for_update(
    transaction: &mut Transaction<'_, Postgres>,
    principal: &AuthorizedPrincipal,
    check_in_id: Uuid,
) -> Result<Option<DueInvitationRow>, sqlx::Error> {
    sqlx::query_as::<_, DueInvitationRow>(
        "SELECT activities.slug AS activity_slug, nodes.slug AS node_slug, progress.principal_id, progress.revisit_status FROM learner_activity_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learner_activity_check_ins AS check_ins ON check_ins.id = progress.revisit_check_in_id AND check_ins.principal_id = progress.principal_id AND check_ins.activity_id = progress.activity_id INNER JOIN learning_activities AS activities ON activities.id = progress.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND check_ins.id = $2 AND progress.status = 'completed' AND progress.revisit_status IN ('pending', 'snoozed') AND progress.revisit_available_at <= NOW() AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND activities.activity_type IN ('open_practice', 'question', 'reflection', 'review') AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3))) FOR UPDATE OF progress",
    )
    .bind(principal.subject_id)
    .bind(check_in_id)
    .bind(&principal.roles)
    .fetch_optional(&mut **transaction)
    .await
}

fn revisit_reason(status: &str) -> &'static str {
    match status {
        "snoozed" => "later",
        _ => "pause",
    }
}

#[cfg(test)]
mod tests {
    use super::revisit_reason;

    #[test]
    fn preserves_the_source_revisit_reason() {
        assert_eq!(revisit_reason("pending"), "pause");
        assert_eq!(revisit_reason("snoozed"), "later");
    }
}
