use sqlx::PgPool;
use wicked_learning_application::platform_feedback::{
    PlatformFeedbackDraft, PlatformFeedbackRepository as Port, PlatformFeedbackSubmissionError,
};
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

pub struct PostgresPlatformFeedbackRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresPlatformFeedbackRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresPlatformFeedbackRepository<'_> {
    fn submit(
        &self,
        principal: &AuthorizedPrincipal,
        draft: &PlatformFeedbackDraft,
    ) -> impl std::future::Future<Output = Result<(), PlatformFeedbackSubmissionError>> + Send {
        async move {
            let result = sqlx::query(
                "INSERT INTO application_platform_feedback (principal_id, category, message, submitted_at) SELECT id, $2, $3, NOW() FROM application_principals WHERE identity_subject_id = $1",
            )
            .bind(principal.subject_id)
            .bind(&draft.category)
            .bind(&draft.message)
            .execute(self.pool)
            .await
            .map_err(|_| PlatformFeedbackSubmissionError)?;

            (result.rows_affected() == 1)
                .then_some(())
                .ok_or(PlatformFeedbackSubmissionError)
        }
    }
}
