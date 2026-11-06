use sqlx::PgPool;
use uuid::Uuid;
use wicked_learning_application::learner_language_preference::{
    AvailableLanguage, LearnerLanguagePreference, LearnerLanguagePreferenceError,
    LearnerLanguagePreferenceRepository as Port,
};
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

pub struct PostgresLearnerLanguagePreferenceRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerLanguagePreferenceRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl Port for PostgresLearnerLanguagePreferenceRepository<'_> {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl std::future::Future<
        Output = Result<LearnerLanguagePreference, LearnerLanguagePreferenceError>,
    > + Send {
        async move { load_preference(self.pool, principal.subject_id).await }
    }

    fn save(
        &self,
        principal: &AuthorizedPrincipal,
        locale: String,
    ) -> impl std::future::Future<
        Output = Result<LearnerLanguagePreference, LearnerLanguagePreferenceError>,
    > + Send {
        async move {
            let principal_id = principal_id(self.pool, principal.subject_id).await?;
            let enabled = sqlx::query_scalar::<_, bool>(
                "SELECT is_enabled FROM application_locales WHERE code = $1",
            )
            .bind(&locale)
            .fetch_optional(self.pool)
            .await
            .map_err(|_| LearnerLanguagePreferenceError::Unavailable)?;
            if enabled != Some(true) {
                return Err(LearnerLanguagePreferenceError::InvalidLocale);
            }
            sqlx::query("INSERT INTO learner_language_preferences (principal_id, locale) VALUES ($1, $2) ON CONFLICT (principal_id) DO UPDATE SET locale = EXCLUDED.locale, updated_at = NOW()")
                .bind(principal_id).bind(locale).execute(self.pool).await.map_err(|_| LearnerLanguagePreferenceError::Unavailable)?;
            load_preference(self.pool, principal.subject_id).await
        }
    }
}

async fn load_preference(
    pool: &PgPool,
    subject_id: Uuid,
) -> Result<LearnerLanguagePreference, LearnerLanguagePreferenceError> {
    let available_languages = sqlx::query_as::<_, LanguageRow>("SELECT code, name, native_name FROM application_locales WHERE is_enabled = TRUE ORDER BY name")
        .fetch_all(pool).await.map_err(|_| LearnerLanguagePreferenceError::Unavailable)?
        .into_iter().map(|row| AvailableLanguage { code: row.code, name: row.name, native_name: row.native_name }).collect();
    let locale = sqlx::query_scalar::<_, String>("SELECT COALESCE(preferences.locale, 'en') FROM application_principals AS principals LEFT JOIN learner_language_preferences AS preferences ON preferences.principal_id = principals.id WHERE principals.identity_subject_id = $1")
        .bind(subject_id).fetch_optional(pool).await.map_err(|_| LearnerLanguagePreferenceError::Unavailable)?
        .ok_or(LearnerLanguagePreferenceError::Unavailable)?;
    Ok(LearnerLanguagePreference {
        available_languages,
        locale,
    })
}

async fn principal_id(
    pool: &PgPool,
    subject_id: Uuid,
) -> Result<Uuid, LearnerLanguagePreferenceError> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(subject_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| LearnerLanguagePreferenceError::Unavailable)?
        .ok_or(LearnerLanguagePreferenceError::Unavailable)
}

#[derive(sqlx::FromRow)]
struct LanguageRow {
    code: String,
    name: String,
    native_name: String,
}
