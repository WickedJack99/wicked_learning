use std::future::Future;

use serde_json::Value;
use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

/// Copy selected for the learner's current activity. `translation` is `None`
/// for English or when the selected enabled locale has no stored copy.
#[derive(Clone, Debug, PartialEq)]
pub struct ActiveActivityTranslation {
    pub translation: Option<Value>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerActivityTranslationReadError;

pub trait LearnerActivityTranslationRepository {
    /// Resolves only an activity that is the caller's current step in an
    /// active, visible route run. The route, map and node access boundary is
    /// intentionally owned by persistence rather than the browser path.
    fn load_active_translation(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl Future<
        Output = Result<Option<ActiveActivityTranslation>, LearnerActivityTranslationReadError>,
    > + Send;
}

pub struct LearnerActivityTranslationQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerActivityTranslationQuery<'repository, Repository>
where
    Repository: LearnerActivityTranslationRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> Result<Option<ActiveActivityTranslation>, LearnerActivityTranslationReadError> {
        self.repository
            .load_active_translation(principal, play_run_id, activity_slug)
            .await
    }
}

#[cfg(test)]
mod tests {
    use std::{future::Future, sync::Mutex};

    use serde_json::json;
    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{
        ActiveActivityTranslation, LearnerActivityTranslationQuery,
        LearnerActivityTranslationReadError, LearnerActivityTranslationRepository,
    };

    struct RecordingRepository {
        received: Mutex<Option<(Uuid, Uuid, String)>>,
    }

    impl LearnerActivityTranslationRepository for RecordingRepository {
        fn load_active_translation(
            &self,
            principal: &AuthorizedPrincipal,
            play_run_id: Uuid,
            activity_slug: &str,
        ) -> impl Future<
            Output = Result<Option<ActiveActivityTranslation>, LearnerActivityTranslationReadError>,
        > + Send {
            *self.received.lock().expect("test mutex is available") =
                Some((principal.subject_id, play_run_id, activity_slug.to_owned()));
            async {
                Ok(Some(ActiveActivityTranslation {
                    translation: Some(json!({ "title": "Translated" })),
                }))
            }
        }
    }

    #[tokio::test]
    async fn delegates_the_current_run_and_activity_to_the_scoped_repository() {
        let repository = RecordingRepository {
            received: Mutex::new(None),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec![],
        };
        let play_run_id = Uuid::new_v4();

        let translation = LearnerActivityTranslationQuery::new(&repository)
            .execute(&principal, play_run_id, "active-activity")
            .await
            .expect("translation query is available");

        assert_eq!(
            *repository.received.lock().expect("test mutex is available"),
            Some((
                principal.subject_id,
                play_run_id,
                "active-activity".to_owned(),
            ))
        );
        assert_eq!(
            translation.and_then(|translation| translation.translation),
            Some(json!({ "title": "Translated" }))
        );
    }
}
