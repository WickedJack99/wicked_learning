use std::{collections::BTreeMap, future::Future};

use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearnerPlatformTranslation {
    pub locale: String,
    pub translations: BTreeMap<String, String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerPlatformTranslationReadError;

pub trait LearnerPlatformTranslationRepository {
    /// Resolves a private locale preference only when that locale remains
    /// enabled. A disabled/deleted preference safely falls back to English.
    fn load_platform_translation(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl Future<
        Output = Result<LearnerPlatformTranslation, LearnerPlatformTranslationReadError>,
    > + Send;
}

pub struct LearnerPlatformTranslationQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerPlatformTranslationQuery<'repository, Repository>
where
    Repository: LearnerPlatformTranslationRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<LearnerPlatformTranslation, LearnerPlatformTranslationReadError> {
        self.repository.load_platform_translation(principal).await
    }
}

#[cfg(test)]
mod tests {
    use std::{collections::BTreeMap, future::Future, sync::Mutex};

    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{
        LearnerPlatformTranslation, LearnerPlatformTranslationQuery,
        LearnerPlatformTranslationReadError, LearnerPlatformTranslationRepository,
    };

    struct RecordingRepository {
        subject_id: Mutex<Option<Uuid>>,
    }

    impl LearnerPlatformTranslationRepository for RecordingRepository {
        fn load_platform_translation(
            &self,
            principal: &AuthorizedPrincipal,
        ) -> impl Future<
            Output = Result<LearnerPlatformTranslation, LearnerPlatformTranslationReadError>,
        > + Send {
            *self.subject_id.lock().expect("test mutex is available") = Some(principal.subject_id);
            async {
                Ok(LearnerPlatformTranslation {
                    locale: "en".to_owned(),
                    translations: BTreeMap::from([(
                        String::from("common.cancel"),
                        String::from("Cancel"),
                    )]),
                })
            }
        }
    }

    #[tokio::test]
    async fn delegates_the_authenticated_learner_to_the_locale_repository() {
        let repository = RecordingRepository {
            subject_id: Mutex::new(None),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec![],
        };

        let catalog = LearnerPlatformTranslationQuery::new(&repository)
            .execute(&principal)
            .await
            .expect("translation query is available");

        assert_eq!(
            *repository
                .subject_id
                .lock()
                .expect("test mutex is available"),
            Some(principal.subject_id)
        );
        assert_eq!(catalog.locale, "en");
        assert_eq!(
            catalog
                .translations
                .get("common.cancel")
                .map(String::as_str),
            Some("Cancel")
        );
    }
}
