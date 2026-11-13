use std::{collections::BTreeMap, future::Future};

use serde_json::{Map, Value};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;
use wicked_learning_application::{
    activity_translation_catalog::{merge_strings_within_source_shape, source_payload},
    admin_translation_catalog::{
        AdminPlatformLanguage, AdminTranslationCatalogError, AdminTranslationCatalogRepository,
        PlatformLanguageForm, english_platform_translations, string_values, translation_catalog,
    },
};
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

pub struct PostgresAdminTranslationCatalogRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminTranslationCatalogRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl AdminTranslationCatalogRepository for PostgresAdminTranslationCatalogRepository<'_> {
    fn list_languages(
        &self,
    ) -> impl Future<Output = Result<Vec<AdminPlatformLanguage>, AdminTranslationCatalogError>> + Send
    {
        async move { list_languages(self.pool).await.map_err(map_error) }
    }

    fn create_language(
        &self,
        principal: &AuthorizedPrincipal,
        form: &PlatformLanguageForm,
    ) -> impl Future<Output = Result<AdminPlatformLanguage, AdminTranslationCatalogError>> + Send
    {
        async move {
            create_language(self.pool, principal, form)
                .await
                .map_err(map_error)
        }
    }

    fn update_language(
        &self,
        principal: &AuthorizedPrincipal,
        code: &str,
        form: &PlatformLanguageForm,
    ) -> impl Future<Output = Result<Option<AdminPlatformLanguage>, AdminTranslationCatalogError>> + Send
    {
        async move {
            update_language(self.pool, principal, code, form)
                .await
                .map_err(map_error)
        }
    }

    fn english_catalog(
        &self,
    ) -> impl Future<Output = Result<Value, AdminTranslationCatalogError>> + Send {
        async move {
            let activities = source_activity_payloads(self.pool)
                .await
                .map_err(map_error)?;
            Ok(translation_catalog(
                "en",
                Value::Object(english_platform_translations()),
                Value::Object(activities),
                None,
            ))
        }
    }

    fn language_catalog(
        &self,
        code: &str,
    ) -> impl Future<Output = Result<Option<Value>, AdminTranslationCatalogError>> + Send {
        async move {
            let language = sqlx::query_as::<_, LocaleCatalogRow>(
                "SELECT translations, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM application_locales WHERE code = $1",
            )
            .bind(code)
            .fetch_optional(self.pool)
            .await
            .map_err(map_error)?;
            let Some(language) = language else {
                return Ok(None);
            };
            let activities = localized_activity_payloads(self.pool, code)
                .await
                .map_err(map_error)?;
            Ok(Some(translation_catalog(
                code,
                Value::Object(string_values(&language.translations)),
                Value::Object(activities),
                Some(&language.updated_at),
            )))
        }
    }

    fn import_catalog(
        &self,
        principal: &AuthorizedPrincipal,
        code: &str,
        catalog: Value,
    ) -> impl Future<Output = Result<bool, AdminTranslationCatalogError>> + Send {
        async move {
            import_catalog(self.pool, principal, code, catalog)
                .await
                .map_err(map_error)
        }
    }
}

#[derive(FromRow)]
struct LanguageRow {
    code: String,
    name: String,
    native_name: String,
    is_enabled: bool,
    updated_at: String,
}

#[derive(FromRow)]
struct LocaleCatalogRow {
    translations: Value,
    updated_at: String,
}

#[derive(FromRow)]
struct ActivityRow {
    id: Uuid,
    title: String,
    introduction: Option<String>,
    config: Value,
}

#[derive(FromRow)]
struct DialogueNodeRow {
    activity_id: Uuid,
    id: Uuid,
    title: String,
    body: Option<String>,
}

#[derive(FromRow)]
struct TransitionRow {
    activity_id: Uuid,
    id: Uuid,
    label: Option<String>,
}

fn language(row: LanguageRow) -> AdminPlatformLanguage {
    AdminPlatformLanguage {
        code: row.code,
        name: row.name,
        native_name: row.native_name,
        is_enabled: row.is_enabled,
        updated_at: row.updated_at,
    }
}

async fn list_languages(pool: &PgPool) -> Result<Vec<AdminPlatformLanguage>, sqlx::Error> {
    let rows = sqlx::query_as::<_, LanguageRow>(
        "SELECT code, name, native_name, is_enabled, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM application_locales ORDER BY CASE WHEN code = 'en' THEN 0 ELSE 1 END, name ASC, code ASC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(language).collect())
}

async fn create_language(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    form: &PlatformLanguageForm,
) -> Result<AdminPlatformLanguage, sqlx::Error> {
    let principal_id = principal_id(pool, principal.subject_id).await?;
    // A locale must not appear in the learner selector before its platform and
    // playback renderers are ready. The later activation slice changes only
    // this gate, not any translated content or catalog shape.
    let row = sqlx::query_as::<_, LanguageRow>(
        "INSERT INTO application_locales (code, name, native_name, is_enabled, created_by_principal_id, updated_by_principal_id) VALUES ($1, $2, $3, FALSE, $4, $4) RETURNING code, name, native_name, is_enabled, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at",
    )
    .bind(&form.code)
    .bind(&form.name)
    .bind(&form.native_name)
    .bind(principal_id)
    .fetch_one(pool)
    .await?;
    Ok(language(row))
}

async fn update_language(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    code: &str,
    form: &PlatformLanguageForm,
) -> Result<Option<AdminPlatformLanguage>, sqlx::Error> {
    let principal_id = principal_id(pool, principal.subject_id).await?;
    let row = sqlx::query_as::<_, LanguageRow>(
        "UPDATE application_locales SET name = $2, native_name = $3, updated_by_principal_id = $4, updated_at = NOW() WHERE code = $1 AND code <> 'en' RETURNING code, name, native_name, is_enabled, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at",
    )
    .bind(code)
    .bind(&form.name)
    .bind(&form.native_name)
    .bind(principal_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(language))
}

async fn import_catalog(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
    code: &str,
    catalog: Value,
) -> Result<bool, sqlx::Error> {
    let principal_id = principal_id(pool, principal.subject_id).await?;
    let mut transaction = pool.begin().await?;
    let language = sqlx::query_as::<_, LocaleCatalogRow>(
        "SELECT translations, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at FROM application_locales WHERE code = $1 AND code <> 'en' FOR UPDATE",
    )
    .bind(code)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(language) = language else {
        transaction.commit().await?;
        return Ok(false);
    };
    let Some(catalog_object) = catalog.as_object() else {
        return Err(sqlx::Error::Protocol(
            "catalog must be an object".to_owned(),
        ));
    };
    let meta = catalog_object
        .get("meta")
        .and_then(Value::as_object)
        .ok_or_else(|| sqlx::Error::Protocol("catalog meta must be an object".to_owned()))?;
    if let Some(source_updated_at) = meta.get("source_updated_at").and_then(Value::as_str)
        && source_updated_at != language.updated_at
    {
        return Err(sqlx::Error::Protocol(
            "translation catalog was superseded".to_owned(),
        ));
    }
    let platform = catalog_object
        .get("platform")
        .ok_or_else(|| sqlx::Error::Protocol("catalog platform must be present".to_owned()))?;
    sqlx::query(
        "UPDATE application_locales SET translations = $2, updated_by_principal_id = $3, updated_at = NOW() WHERE code = $1",
    )
    .bind(code)
    .bind(Value::Object(string_values(platform)))
    .bind(principal_id)
    .execute(&mut *transaction)
    .await?;

    let candidates = catalog_object
        .get("activities")
        .and_then(Value::as_object)
        .ok_or_else(|| sqlx::Error::Protocol("catalog activities must be present".to_owned()))?;
    let payloads = source_activity_payloads_transaction(&mut transaction).await?;
    for (activity_id, source) in payloads {
        let Some(candidate) = candidates.get(&activity_id) else {
            continue;
        };
        if !candidate.is_object() {
            continue;
        }
        let activity_id = Uuid::parse_str(&activity_id)
            .map_err(|_| sqlx::Error::Protocol("activity id is invalid".to_owned()))?;
        let content = merge_strings_within_source_shape(&source, candidate);
        sqlx::query(
            "INSERT INTO learning_activity_translations (learning_activity_id, locale, content) VALUES ($1, $2, $3) ON CONFLICT (learning_activity_id, locale) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()",
        )
        .bind(activity_id)
        .bind(code)
        .bind(content)
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;
    Ok(true)
}

async fn source_activity_payloads(pool: &PgPool) -> Result<Map<String, Value>, sqlx::Error> {
    let mut transaction = pool.begin().await?;
    let payloads = source_activity_payloads_transaction(&mut transaction).await?;
    transaction.commit().await?;
    Ok(payloads)
}

async fn localized_activity_payloads(
    pool: &PgPool,
    code: &str,
) -> Result<Map<String, Value>, sqlx::Error> {
    let rows = sqlx::query_as::<_, LocalizedActivityRow>(
        "SELECT activities.id, translations.content FROM learning_activities AS activities LEFT JOIN learning_activity_translations AS translations ON translations.learning_activity_id = activities.id AND translations.locale = $1 ORDER BY activities.id ASC",
    )
    .bind(code)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|row| {
            (
                row.id.to_string(),
                row.content.unwrap_or_else(|| Value::Object(Map::new())),
            )
        })
        .collect())
}

#[derive(FromRow)]
struct LocalizedActivityRow {
    id: Uuid,
    content: Option<Value>,
}

async fn source_activity_payloads_transaction(
    transaction: &mut Transaction<'_, Postgres>,
) -> Result<Map<String, Value>, sqlx::Error> {
    let activities = sqlx::query_as::<_, ActivityRow>(
        "SELECT id, title, introduction, activity_config AS config FROM learning_activities ORDER BY id ASC",
    )
    .fetch_all(&mut **transaction)
    .await?;
    let nodes = sqlx::query_as::<_, DialogueNodeRow>(
        "SELECT activity_id, id, title, body FROM learning_npc_dialogue_nodes ORDER BY activity_id ASC, sort_order ASC, id ASC",
    )
    .fetch_all(&mut **transaction)
    .await?;
    let transitions = sqlx::query_as::<_, TransitionRow>(
        "SELECT from_activity_id AS activity_id, id, label FROM learning_activity_transitions ORDER BY from_activity_id ASC, created_at ASC, id ASC",
    )
    .fetch_all(&mut **transaction)
    .await?;
    let mut nodes_by_activity = BTreeMap::<Uuid, Vec<(String, String, Option<String>)>>::new();
    for node in nodes {
        nodes_by_activity
            .entry(node.activity_id)
            .or_default()
            .push((node.id.to_string(), node.title, node.body));
    }
    let mut transitions_by_activity = BTreeMap::<Uuid, Vec<(String, Option<String>)>>::new();
    for transition in transitions {
        transitions_by_activity
            .entry(transition.activity_id)
            .or_default()
            .push((transition.id.to_string(), transition.label));
    }
    Ok(activities
        .into_iter()
        .map(|activity| {
            let id = activity.id;
            (
                id.to_string(),
                source_payload(
                    &activity.title,
                    activity.introduction.as_deref(),
                    &activity.config,
                    nodes_by_activity.remove(&id).unwrap_or_default(),
                    transitions_by_activity.remove(&id).unwrap_or_default(),
                ),
            )
        })
        .collect())
}

async fn principal_id(pool: &PgPool, subject_id: Uuid) -> Result<Uuid, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(subject_id)
        .fetch_optional(pool)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

fn map_error(error: sqlx::Error) -> AdminTranslationCatalogError {
    if error
        .as_database_error()
        .and_then(|database| database.code())
        .is_some_and(|code| code == "23505")
    {
        return AdminTranslationCatalogError::Conflict;
    }
    if matches!(error, sqlx::Error::Protocol(_)) {
        return AdminTranslationCatalogError::Invalid;
    }
    tracing::error!(%error, "could not access the translation catalog");
    AdminTranslationCatalogError::Unavailable
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::string_values;

    #[test]
    fn keeps_only_string_platform_translation_values() {
        assert_eq!(
            string_values(&json!({"welcome": "Welcome", "nested": {}, "number": 3})),
            serde_json::Map::from_iter([(String::from("welcome"), json!("Welcome"))])
        );
    }
}
