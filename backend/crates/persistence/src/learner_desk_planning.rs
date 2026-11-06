use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::learner_desk_planning::{
    LearnerDeskPlanningPreferenceDraft, LearnerDeskPlanningPreferenceError,
    LearnerDeskPlanningPreferenceRepository as LearnerDeskPlanningPreferenceRepositoryPort,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerDeskPlanningPreference, LearnerDeskTimeBudget},
};

pub struct PostgresLearnerDeskPlanningPreferenceRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerDeskPlanningPreferenceRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct PreferenceRow {
    purpose_filter: String,
    time_budget: Option<i16>,
}

impl LearnerDeskPlanningPreferenceRepositoryPort
    for PostgresLearnerDeskPlanningPreferenceRepository<'_>
{
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl std::future::Future<
        Output = Result<LearnerDeskPlanningPreference, LearnerDeskPlanningPreferenceError>,
    > + Send {
        async move {
            load(self.pool, principal).await.map_err(|error| {
                tracing::error!(%error, "could not load learner desk planning preference");
                LearnerDeskPlanningPreferenceError
            })
        }
    }

    fn save(
        &self,
        principal: &AuthorizedPrincipal,
        draft: &LearnerDeskPlanningPreferenceDraft,
    ) -> impl std::future::Future<
        Output = Result<LearnerDeskPlanningPreference, LearnerDeskPlanningPreferenceError>,
    > + Send {
        async move {
            save(self.pool, principal, draft).await.map_err(|error| {
                tracing::error!(%error, "could not save learner desk planning preference");
                LearnerDeskPlanningPreferenceError
            })
        }
    }
}

async fn load(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<LearnerDeskPlanningPreference, sqlx::Error> {
    let preference = sqlx::query_as::<_, PreferenceRow>(
        "SELECT preferences.purpose_filter, preferences.time_budget FROM learner_desk_planning_preferences AS preferences INNER JOIN application_principals AS principals ON principals.id = preferences.principal_id WHERE principals.identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await?;

    Ok(preference
        .map(preference_from_row)
        .unwrap_or_else(LearnerDeskPlanningPreference::defaults))
}

async fn save(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    draft: &LearnerDeskPlanningPreferenceDraft,
) -> Result<LearnerDeskPlanningPreference, sqlx::Error> {
    let principal_id = application_principal_id(pool, principal)
        .await?
        .ok_or(sqlx::Error::RowNotFound)?;
    sqlx::query(
        "INSERT INTO learner_desk_planning_preferences (principal_id, purpose_filter, time_budget) VALUES ($1, $2, $3) ON CONFLICT (principal_id) DO UPDATE SET purpose_filter = EXCLUDED.purpose_filter, time_budget = EXCLUDED.time_budget, updated_at = NOW()",
    )
    .bind(principal_id)
    .bind(&draft.purpose_filter)
    .bind(draft.time_budget)
    .execute(pool)
    .await?;

    Ok(draft.clone().into_preference())
}

fn preference_from_row(row: PreferenceRow) -> LearnerDeskPlanningPreference {
    LearnerDeskPlanningPreference {
        is_saved: true,
        purpose_filter: row.purpose_filter,
        time_budget: row
            .time_budget
            .map(LearnerDeskTimeBudget::Minutes)
            .unwrap_or_else(|| LearnerDeskTimeBudget::Any("any".to_owned())),
    }
}

async fn application_principal_id(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(pool)
        .await
}
