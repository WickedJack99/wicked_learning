use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_revisit_invitation::{
    LearnerRevisitInvitationAction, LearnerRevisitInvitationError,
    LearnerRevisitInvitationRepository as LearnerRevisitInvitationRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerRevisitInvitationActionResult,
};

pub struct PostgresLearnerRevisitInvitationRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerRevisitInvitationRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl LearnerRevisitInvitationRepositoryPort for PostgresLearnerRevisitInvitationRepository<'_> {
    fn update_due_invitation(
        &self,
        principal: &AuthorizedPrincipal,
        check_in_id: Uuid,
        action: LearnerRevisitInvitationAction,
    ) -> impl std::future::Future<
        Output = Result<
            Option<LearnerRevisitInvitationActionResult>,
            LearnerRevisitInvitationError,
        >,
    > + Send {
        async move {
            update_due_invitation(self.pool, principal, check_in_id, action)
                .await
                .map_err(|error| {
                    tracing::error!(%error, "could not update learner revisit invitation");
                    LearnerRevisitInvitationError
                })
        }
    }
}

#[derive(FromRow)]
struct DueInvitationRow {
    principal_id: Uuid,
}

#[derive(FromRow)]
struct UpdatedInvitationRow {
    available_at: Option<String>,
    revisit_status: String,
}

async fn update_due_invitation(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    check_in_id: Uuid,
    action: LearnerRevisitInvitationAction,
) -> Result<Option<LearnerRevisitInvitationActionResult>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let due = sqlx::query_as::<_, DueInvitationRow>(
        "SELECT progress.principal_id FROM learner_activity_progress AS progress INNER JOIN application_principals AS principals ON principals.id = progress.principal_id INNER JOIN learner_activity_check_ins AS check_ins ON check_ins.id = progress.revisit_check_in_id INNER JOIN learning_activities AS activities ON activities.id = progress.activity_id INNER JOIN learning_routes AS routes ON routes.id = activities.route_id INNER JOIN learning_map_assets AS assets ON assets.id = routes.map_asset_id INNER JOIN learning_nodes AS nodes ON nodes.map_asset_id = assets.id INNER JOIN learning_maps AS maps ON maps.id = nodes.map_id WHERE principals.identity_subject_id = $1 AND check_ins.id = $2 AND progress.status = 'completed' AND progress.revisit_status IN ('pending', 'snoozed') AND progress.revisit_available_at <= NOW() AND maps.published_at IS NOT NULL AND nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL AND activities.published_at IS NOT NULL AND (maps.access_roles @> '[\"public\"]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(maps.access_roles) AS access_role(role) WHERE access_role.role = ANY($3))) FOR UPDATE OF progress",
    )
    .bind(principal.subject_id)
    .bind(check_in_id)
    .bind(&principal.roles)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(due) = due else {
        transaction.commit().await?;
        return Ok(None);
    };
    let (status, snooze) = match action {
        LearnerRevisitInvitationAction::Dismiss => ("dismissed", false),
        LearnerRevisitInvitationAction::Snooze => ("snoozed", true),
    };
    let updated = sqlx::query_as::<_, UpdatedInvitationRow>(
        "UPDATE learner_activity_progress SET revisit_status = $3, revisit_available_at = CASE WHEN $4 THEN NOW() + INTERVAL '7 days' ELSE NULL END, updated_at = NOW() WHERE principal_id = $1 AND revisit_check_in_id = $2 RETURNING revisit_status, to_char(revisit_available_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS available_at",
    )
    .bind(due.principal_id)
    .bind(check_in_id)
    .bind(status)
    .bind(snooze)
    .fetch_one(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(Some(LearnerRevisitInvitationActionResult {
        check_in_id: check_in_id.to_string(),
        revisit_status: updated.revisit_status,
        available_at: updated.available_at,
    }))
}
