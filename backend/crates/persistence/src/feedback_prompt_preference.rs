use sqlx::PgPool;
use wicked_learning_application::feedback_prompt_preference::{
    FeedbackPromptAction, FeedbackPromptPreference, FeedbackPromptPreferenceError,
    FeedbackPromptPreferenceRepository as Port,
};
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

pub struct PostgresFeedbackPromptPreferenceRepository<'a> {
    pool: &'a PgPool,
}
impl<'a> PostgresFeedbackPromptPreferenceRepository<'a> {
    pub fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }
}
impl Port for PostgresFeedbackPromptPreferenceRepository<'_> {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl std::future::Future<
        Output = Result<FeedbackPromptPreference, FeedbackPromptPreferenceError>,
    > + Send {
        async move { load(self.pool, principal).await }
    }
    fn update(
        &self,
        principal: &AuthorizedPrincipal,
        action: FeedbackPromptAction,
    ) -> impl std::future::Future<
        Output = Result<FeedbackPromptPreference, FeedbackPromptPreferenceError>,
    > + Send {
        async move {
            let (status, snooze_days) = match action {
                FeedbackPromptAction::Enable => ("enabled", None),
                FeedbackPromptAction::Decline => ("declined", None),
                FeedbackPromptAction::Dismiss => ("snoozed", Some(14_i32)),
            };
            sqlx::query("INSERT INTO learner_feedback_prompt_preferences (principal_id, status, snoozed_until) SELECT id, $2, CASE WHEN $3::integer IS NULL THEN NULL ELSE NOW() + ($3::integer * INTERVAL '1 day') END FROM application_principals WHERE identity_subject_id = $1 ON CONFLICT (principal_id) DO UPDATE SET status = EXCLUDED.status, snoozed_until = EXCLUDED.snoozed_until, updated_at = NOW()")
            .bind(principal.subject_id).bind(status).bind(snooze_days).execute(self.pool).await.map_err(|_| FeedbackPromptPreferenceError)?;
            load(self.pool, principal).await
        }
    }
}

async fn load(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<FeedbackPromptPreference, FeedbackPromptPreferenceError> {
    let status = sqlx::query_scalar::<_, String>("SELECT CASE WHEN status = 'snoozed' AND snoozed_until <= NOW() THEN 'enabled' ELSE status END FROM learner_feedback_prompt_preferences AS preferences INNER JOIN application_principals AS principals ON principals.id = preferences.principal_id WHERE principals.identity_subject_id = $1")
        .bind(principal.subject_id).fetch_optional(pool).await.map_err(|_| FeedbackPromptPreferenceError)?;
    Ok(status
        .map(|status| FeedbackPromptPreference { status })
        .unwrap_or_else(FeedbackPromptPreference::default_enabled))
}
