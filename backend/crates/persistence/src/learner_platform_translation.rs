use std::collections::BTreeMap;

use serde_json::Value;
use sqlx::{FromRow, PgPool};
use wicked_learning_application::{
    admin_translation_catalog::{english_platform_translations, string_values},
    learner_platform_translation::{
        LearnerPlatformTranslation, LearnerPlatformTranslationReadError,
        LearnerPlatformTranslationRepository,
    },
};
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

pub struct PostgresLearnerPlatformTranslationRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresLearnerPlatformTranslationRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl LearnerPlatformTranslationRepository for PostgresLearnerPlatformTranslationRepository<'_> {
    fn load_platform_translation(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl std::future::Future<
        Output = Result<LearnerPlatformTranslation, LearnerPlatformTranslationReadError>,
    > + Send {
        async move {
            load_platform_translation(self.pool, principal)
                .await
                .map_err(unavailable)
        }
    }
}

#[derive(FromRow)]
struct LocaleRow {
    code: Option<String>,
    translations: Option<Value>,
}

async fn load_platform_translation(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<LearnerPlatformTranslation, sqlx::Error> {
    let locale = sqlx::query_as::<_, LocaleRow>(
        "SELECT locales.code, locales.translations \
         FROM application_principals AS principals \
         LEFT JOIN learner_language_preferences AS preferences ON preferences.principal_id = principals.id \
         LEFT JOIN application_locales AS locales ON locales.code = COALESCE(preferences.locale, 'en') AND locales.is_enabled = TRUE \
         WHERE principals.identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await?;
    let locale = locale.unwrap_or(LocaleRow {
        code: None,
        translations: None,
    });
    match locale.code.as_deref() {
        Some(code) if code != "en" => Ok(LearnerPlatformTranslation {
            locale: code.to_owned(),
            translations: strings(locale.translations.as_ref()),
        }),
        _ => Ok(LearnerPlatformTranslation {
            locale: "en".to_owned(),
            translations: english_platform_translations()
                .into_iter()
                .filter_map(|(key, value)| value.as_str().map(|value| (key, value.to_owned())))
                .collect(),
        }),
    }
}

fn strings(translations: Option<&Value>) -> BTreeMap<String, String> {
    translations
        .map(string_values)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|(key, value)| value.as_str().map(|value| (key, value.to_owned())))
        .collect()
}

fn unavailable(error: sqlx::Error) -> LearnerPlatformTranslationReadError {
    tracing::error!(%error, "could not load the learner platform translation catalog");
    LearnerPlatformTranslationReadError
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::strings;

    #[test]
    fn keeps_only_platform_string_values() {
        assert_eq!(
            strings(Some(
                &json!({"common.cancel": "Cancel", "nested": {}, "count": 4})
            )),
            std::collections::BTreeMap::from([(
                String::from("common.cancel"),
                String::from("Cancel")
            )])
        );
    }
}
