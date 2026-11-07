use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

pub const DEFAULT_OPEN_PRACTICE_NEXT_STEP: &str =
    "Choose a useful next step, then continue when you are ready.";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OpenPracticeActivityForm {
    pub title: String,
    pub slug: Option<String>,
    pub introduction: Option<String>,
    pub next_step: String,
}

impl OpenPracticeActivityForm {
    pub fn parse(
        title: &str,
        slug: Option<&str>,
        introduction: Option<&str>,
        next_step: Option<&str>,
    ) -> Option<Self> {
        let title = title.trim();
        let slug = slug.map(str::trim).filter(|value| !value.is_empty());
        let introduction = introduction.map(str::to_owned);
        let next_step = next_step.map(str::trim).filter(|value| !value.is_empty());
        if title.is_empty()
            || title.chars().count() > 120
            || slug.is_some_and(|value| value.chars().count() > 140 || !valid_slug(value))
            || introduction
                .as_ref()
                .is_some_and(|value| value.chars().count() > 1_000)
            || next_step.is_some_and(|value| value.chars().count() > 4_000)
        {
            return None;
        }
        Some(Self {
            title: title.to_owned(),
            slug: slug.map(str::to_owned),
            introduction,
            next_step: next_step
                .unwrap_or(DEFAULT_OPEN_PRACTICE_NEXT_STEP)
                .to_owned(),
        })
    }
}

pub fn generated_slug(title: &str) -> String {
    let mut slug = String::new();
    let mut previous_was_separator = true;
    for character in deunicode::deunicode(title).chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
            previous_was_separator = false;
        } else if !previous_was_separator {
            slug.push('-');
            previous_was_separator = true;
        }
    }
    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        "activity".to_owned()
    } else {
        slug.to_owned()
    }
}

fn valid_slug(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldOpenPracticeError {
    InvalidActivity,
    Conflict,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatedOpenPracticeActivity {
    pub activity_id: Uuid,
    pub updated_at: String,
}

pub trait AdminWorldOpenPracticeRepository {
    fn create_open_practice(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &OpenPracticeActivityForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldOpenPracticeError>> + Send;

    fn update_open_practice(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &OpenPracticeActivityForm,
        expected_updated_at: &str,
    ) -> impl Future<
        Output = Result<Option<UpdatedOpenPracticeActivity>, AdminWorldOpenPracticeError>,
    > + Send;
}

/// Creates the source's self-directed activity type with its known, fully
/// validated playback configuration. Other source types retain their own
/// authoring slices rather than sharing an unvalidated JSON write path.
pub struct AdminWorldOpenPracticeCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldOpenPracticeCommand<'repository, Repository>
where
    Repository: AdminWorldOpenPracticeRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &OpenPracticeActivityForm,
    ) -> Result<Option<Uuid>, AdminWorldOpenPracticeError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .create_open_practice(principal, node_id, form)
            .await
    }

    /// Updates only the source fields whose complete Open practice behavior is
    /// represented by this contract. The expected timestamp preserves the
    /// source editor's reload-before-overwrite rule.
    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &OpenPracticeActivityForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedOpenPracticeActivity>, AdminWorldOpenPracticeError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .update_open_practice(principal, activity_id, form, expected_updated_at)
            .await
    }
}

#[cfg(test)]
mod tests {
    use std::{
        future::Future,
        sync::{
            Arc,
            atomic::{AtomicBool, Ordering},
        },
    };

    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{
        AdminWorldOpenPracticeCommand, AdminWorldOpenPracticeError,
        AdminWorldOpenPracticeRepository, DEFAULT_OPEN_PRACTICE_NEXT_STEP,
        OpenPracticeActivityForm, UpdatedOpenPracticeActivity, generated_slug,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldOpenPracticeRepository for RecordingRepository {
        fn create_open_practice(
            &self,
            _principal: &AuthorizedPrincipal,
            _node_id: Uuid,
            _form: &OpenPracticeActivityForm,
        ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldOpenPracticeError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn update_open_practice(
            &self,
            _principal: &AuthorizedPrincipal,
            _activity_id: Uuid,
            _form: &OpenPracticeActivityForm,
            _expected_updated_at: &str,
        ) -> impl Future<
            Output = Result<Option<UpdatedOpenPracticeActivity>, AdminWorldOpenPracticeError>,
        > + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    #[test]
    fn uses_the_source_open_practice_default_and_generated_slug() {
        let form = OpenPracticeActivityForm::parse(" Choose a next step ", None, None, Some(" "))
            .expect("source-bounded open practice form is valid");
        assert_eq!(form.next_step, DEFAULT_OPEN_PRACTICE_NEXT_STEP);
        assert_eq!(generated_slug(&form.title), "choose-a-next-step");
        assert_eq!(
            generated_slug("Über den nächsten Schritt"),
            "uber-den-nachsten-schritt"
        );
    }

    #[test]
    fn retains_source_field_bounds_and_greenfield_slug_safety() {
        assert!(
            OpenPracticeActivityForm::parse("Title", Some("safe-slug-2"), None, None).is_some()
        );
        assert!(OpenPracticeActivityForm::parse("", None, None, None).is_none());
        assert!(OpenPracticeActivityForm::parse("Title", Some("Not a slug"), None, None).is_none());
        assert!(
            OpenPracticeActivityForm::parse("Title", None, None, Some(&"x".repeat(4_001)))
                .is_none()
        );
    }

    #[tokio::test]
    async fn requires_source_world_activity_update_before_creating() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };
        let form = OpenPracticeActivityForm::parse("A practice", None, None, None)
            .expect("a bounded source form is valid");

        let result = AdminWorldOpenPracticeCommand::new(&repository)
            .create(&principal, Uuid::new_v4(), &form)
            .await
            .expect("authorization check succeeds");

        assert_eq!(result, None);
        assert!(!repository.called.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn requires_source_world_activity_update_before_updating() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };
        let form = OpenPracticeActivityForm::parse("A practice", None, None, None)
            .expect("a bounded source form is valid");

        let result = AdminWorldOpenPracticeCommand::new(&repository)
            .update(
                &principal,
                Uuid::new_v4(),
                &form,
                "2026-11-07T17:00:00.000000Z",
            )
            .await
            .expect("authorization check succeeds");

        assert_eq!(result, None);
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
