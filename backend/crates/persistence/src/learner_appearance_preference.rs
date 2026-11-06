use sqlx::PgPool;
use uuid::Uuid;
use wicked_learning_application::learner_appearance_preference::{
    LearnerAppearancePreferenceError, LearnerAppearancePreferenceRepository as Port,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerAppearance,
};

pub struct PostgresLearnerAppearancePreferenceRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerAppearancePreferenceRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresLearnerAppearancePreferenceRepository<'_> {
    fn save(
        &self,
        principal: &AuthorizedPrincipal,
        appearance: LearnerAppearance,
    ) -> impl std::future::Future<
        Output = Result<LearnerAppearance, LearnerAppearancePreferenceError>,
    > + Send {
        async move {
            let principal_id = sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM application_principals WHERE identity_subject_id = $1",
            )
            .bind(principal.subject_id)
            .fetch_optional(self.pool)
            .await
            .map_err(|_| LearnerAppearancePreferenceError)?
            .ok_or(LearnerAppearancePreferenceError)?;
            sqlx::query(
                "INSERT INTO learner_appearance_preferences (principal_id, appearance) VALUES ($1, $2) \
                 ON CONFLICT (principal_id) DO UPDATE SET appearance = EXCLUDED.appearance, updated_at = NOW()",
            )
            .bind(principal_id)
            .bind(appearance.as_str())
            .execute(self.pool)
            .await
            .map_err(|_| LearnerAppearancePreferenceError)?;
            Ok(appearance)
        }
    }
}
