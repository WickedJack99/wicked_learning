use std::future::Future;

use serde_json::{Map, Value, json};
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

pub const TRANSLATION_CATALOG_FORMAT: &str = "learning-worlds.translation-catalog";
pub const TRANSLATION_CATALOG_VERSION: u8 = 1;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminPlatformLanguage {
    pub code: String,
    pub name: String,
    pub native_name: String,
    pub is_enabled: bool,
    pub updated_at: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlatformLanguageForm {
    pub code: String,
    pub name: String,
    pub native_name: String,
}

impl PlatformLanguageForm {
    pub fn parse(code: &str, name: &str, native_name: &str) -> Option<Self> {
        let code = code.trim();
        let name = name.trim();
        let native_name = native_name.trim();
        (valid_locale_code(code)
            && code != "en"
            && bounded_nonempty(name, 80)
            && bounded_nonempty(native_name, 80))
        .then(|| Self {
            code: code.to_owned(),
            name: name.to_owned(),
            native_name: native_name.to_owned(),
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatePlatformLanguageForm {
    pub is_enabled: bool,
    pub name: String,
    pub native_name: String,
}

impl UpdatePlatformLanguageForm {
    pub fn parse(is_enabled: bool, name: &str, native_name: &str) -> Option<Self> {
        let name = name.trim();
        let native_name = native_name.trim();
        (bounded_nonempty(name, 80) && bounded_nonempty(native_name, 80)).then(|| Self {
            is_enabled,
            name: name.to_owned(),
            native_name: native_name.to_owned(),
        })
    }
}

pub trait AdminTranslationCatalogRepository {
    fn list_languages(
        &self,
    ) -> impl Future<Output = Result<Vec<AdminPlatformLanguage>, AdminTranslationCatalogError>> + Send;
    fn create_language(
        &self,
        principal: &AuthorizedPrincipal,
        form: &PlatformLanguageForm,
    ) -> impl Future<Output = Result<AdminPlatformLanguage, AdminTranslationCatalogError>> + Send;
    fn update_language(
        &self,
        principal: &AuthorizedPrincipal,
        code: &str,
        form: &UpdatePlatformLanguageForm,
    ) -> impl Future<Output = Result<Option<AdminPlatformLanguage>, AdminTranslationCatalogError>> + Send;
    fn english_catalog(
        &self,
    ) -> impl Future<Output = Result<Value, AdminTranslationCatalogError>> + Send;
    fn language_catalog(
        &self,
        code: &str,
    ) -> impl Future<Output = Result<Option<Value>, AdminTranslationCatalogError>> + Send;
    fn import_catalog(
        &self,
        principal: &AuthorizedPrincipal,
        code: &str,
        catalog: Value,
    ) -> impl Future<Output = Result<bool, AdminTranslationCatalogError>> + Send;
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminTranslationCatalogError {
    Conflict,
    Invalid,
    Unavailable,
}

pub struct AdminTranslationCatalogCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminTranslationCatalogCommand<'repository, Repository>
where
    Repository: AdminTranslationCatalogRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn list(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<Vec<AdminPlatformLanguage>>, AdminTranslationCatalogError> {
        if !can_read(principal) {
            return Ok(None);
        }
        self.repository.list_languages().await.map(Some)
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &PlatformLanguageForm,
    ) -> Result<Option<AdminPlatformLanguage>, AdminTranslationCatalogError> {
        if !can_write(principal) {
            return Ok(None);
        }
        self.repository
            .create_language(principal, form)
            .await
            .map(Some)
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        code: &str,
        form: &UpdatePlatformLanguageForm,
    ) -> Result<Option<AdminPlatformLanguage>, AdminTranslationCatalogError> {
        if !can_write(principal) || !valid_locale_code(code) || code == "en" {
            return Ok(None);
        }
        self.repository.update_language(principal, code, form).await
    }

    pub async fn english_export(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<Value>, AdminTranslationCatalogError> {
        if !can_read(principal) {
            return Ok(None);
        }
        self.repository.english_catalog().await.map(Some)
    }

    pub async fn language_export(
        &self,
        principal: &AuthorizedPrincipal,
        code: &str,
    ) -> Result<Option<Value>, AdminTranslationCatalogError> {
        if !can_read(principal) || !valid_locale_code(code) || code == "en" {
            return Ok(None);
        }
        self.repository.language_catalog(code).await
    }

    pub async fn import(
        &self,
        principal: &AuthorizedPrincipal,
        code: &str,
        catalog: Value,
    ) -> Result<Option<()>, AdminTranslationCatalogError> {
        if !can_write(principal)
            || !valid_locale_code(code)
            || code == "en"
            || !valid_catalog_shape(&catalog, code)
        {
            return Ok(None);
        }
        self.repository
            .import_catalog(principal, code, catalog)
            .await
            .map(|imported| imported.then_some(()))
    }
}

pub fn english_platform_translations() -> Map<String, Value> {
    [
        include_str!("../../../../lang/en/activities.json"),
        include_str!("../../../../lang/en/bookmarks.json"),
        include_str!("../../../../lang/en/common.json"),
        include_str!("../../../../lang/en/competence.json"),
        include_str!("../../../../lang/en/feedback.json"),
        include_str!("../../../../lang/en/home.json"),
        include_str!("../../../../lang/en/journal.json"),
        include_str!("../../../../lang/en/learning.json"),
        include_str!("../../../../lang/en/navigation.json"),
        include_str!("../../../../lang/en/organizations.json"),
        include_str!("../../../../lang/en/paths.json"),
        include_str!("../../../../lang/en/settings.json"),
        include_str!("../../../../lang/en/topics.json"),
        include_str!("../../../../lang/en/world.json"),
    ]
    .into_iter()
    .fold(Map::new(), |mut translations, source| {
        let Value::Object(values) = serde_json::from_str(source)
            .expect("committed English translation source is valid JSON")
        else {
            panic!("committed English translation source is an object");
        };
        translations.extend(
            values
                .into_iter()
                .filter(|(key, value)| !key.is_empty() && value.is_string()),
        );
        translations
    })
}

pub fn translation_catalog(
    locale: &str,
    platform: Value,
    activities: Value,
    updated_at: Option<&str>,
) -> Value {
    let mut meta = Map::from_iter([
        ("format".to_owned(), json!(TRANSLATION_CATALOG_FORMAT)),
        ("version".to_owned(), json!(TRANSLATION_CATALOG_VERSION)),
        ("locale".to_owned(), json!(locale)),
    ]);
    if let Some(updated_at) = updated_at {
        meta.insert("source_updated_at".to_owned(), json!(updated_at));
    }
    json!({
        "meta": meta,
        "platform": platform,
        "activities": activities,
    })
}

pub fn string_values(values: &Value) -> Map<String, Value> {
    values
        .as_object()
        .map(|values| {
            values
                .iter()
                .filter_map(|(key, value)| {
                    (!key.is_empty() && value.is_string()).then(|| (key.clone(), value.clone()))
                })
                .collect()
        })
        .unwrap_or_default()
}

pub fn valid_catalog_shape(catalog: &Value, locale: &str) -> bool {
    let Some(catalog) = catalog.as_object() else {
        return false;
    };
    let Some(meta) = catalog.get("meta").and_then(Value::as_object) else {
        return false;
    };
    meta.get("format").and_then(Value::as_str) == Some(TRANSLATION_CATALOG_FORMAT)
        && meta.get("locale").and_then(Value::as_str) == Some(locale)
        && catalog.get("platform").is_some_and(Value::is_object)
        && catalog.get("activities").is_some_and(Value::is_object)
}

fn can_read(principal: &AuthorizedPrincipal) -> bool {
    principal.has_permission("languages", "ro")
}

fn can_write(principal: &AuthorizedPrincipal) -> bool {
    principal.has_permission("languages", "ru")
}

fn valid_locale_code(code: &str) -> bool {
    let bytes = code.as_bytes();
    let primary_end = bytes
        .iter()
        .position(|byte| *byte == b'-')
        .unwrap_or(bytes.len());
    let primary_valid = (2..=3).contains(&primary_end)
        && bytes[..primary_end]
            .iter()
            .all(|byte| byte.is_ascii_lowercase());
    primary_valid
        && (primary_end == bytes.len()
            || (bytes.len() == primary_end + 3
                && bytes[primary_end + 1].is_ascii_uppercase()
                && bytes[primary_end + 2].is_ascii_uppercase()))
}

fn bounded_nonempty(value: &str, maximum: usize) -> bool {
    !value.is_empty() && value.chars().count() <= maximum
}

#[cfg(test)]
mod tests {
    use serde_json::{Value, json};
    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{
        AdminTranslationCatalogCommand, AdminTranslationCatalogError,
        AdminTranslationCatalogRepository, PlatformLanguageForm, UpdatePlatformLanguageForm,
        english_platform_translations, valid_catalog_shape,
    };

    struct Repository;

    impl AdminTranslationCatalogRepository for Repository {
        fn list_languages(
            &self,
        ) -> impl std::future::Future<
            Output = Result<Vec<super::AdminPlatformLanguage>, AdminTranslationCatalogError>,
        > + Send {
            std::future::ready(Ok(vec![]))
        }

        fn create_language(
            &self,
            _: &AuthorizedPrincipal,
            _: &PlatformLanguageForm,
        ) -> impl std::future::Future<
            Output = Result<super::AdminPlatformLanguage, AdminTranslationCatalogError>,
        > + Send {
            std::future::ready(Err(AdminTranslationCatalogError::Unavailable))
        }

        fn update_language(
            &self,
            _: &AuthorizedPrincipal,
            _: &str,
            _: &UpdatePlatformLanguageForm,
        ) -> impl std::future::Future<
            Output = Result<Option<super::AdminPlatformLanguage>, AdminTranslationCatalogError>,
        > + Send {
            std::future::ready(Ok(None))
        }

        fn english_catalog(
            &self,
        ) -> impl std::future::Future<Output = Result<Value, AdminTranslationCatalogError>> + Send
        {
            std::future::ready(Ok(json!({})))
        }

        fn language_catalog(
            &self,
            _: &str,
        ) -> impl std::future::Future<Output = Result<Option<Value>, AdminTranslationCatalogError>> + Send
        {
            std::future::ready(Ok(None))
        }

        fn import_catalog(
            &self,
            _: &AuthorizedPrincipal,
            _: &str,
            _: Value,
        ) -> impl std::future::Future<Output = Result<bool, AdminTranslationCatalogError>> + Send
        {
            std::future::ready(Ok(false))
        }
    }

    #[test]
    fn retains_source_locale_and_catalog_shape_constraints() {
        assert!(PlatformLanguageForm::parse("de", "German", "Deutsch").is_some());
        assert!(PlatformLanguageForm::parse("en", "English", "English").is_none());
        assert!(PlatformLanguageForm::parse("de-de", "German", "Deutsch").is_none());
        assert!(UpdatePlatformLanguageForm::parse(true, "German", "Deutsch").is_some());
        assert!(UpdatePlatformLanguageForm::parse(false, "", "Deutsch").is_none());
        assert!(valid_catalog_shape(
            &json!({"meta":{"format":"learning-worlds.translation-catalog","locale":"de"},"platform":{},"activities":{}}),
            "de",
        ));
        assert!(!valid_catalog_shape(
            &json!({"meta":{"locale":"de"},"platform":{},"activities":{}}),
            "de"
        ));
    }

    #[test]
    fn embeds_the_committed_english_platform_source_for_export() {
        let translations = english_platform_translations();
        assert!(translations.len() > 100);
        assert!(translations.values().all(Value::is_string));
    }

    #[tokio::test]
    async fn requires_the_source_languages_permission() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec![],
        };
        let form = PlatformLanguageForm::parse("de", "German", "Deutsch").unwrap();
        assert!(
            AdminTranslationCatalogCommand::new(&Repository)
                .create(&principal, &form)
                .await
                .unwrap()
                .is_none()
        );
    }
}
