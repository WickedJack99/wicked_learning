use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

pub const DEFAULT_REFLECTION_PROMPT: &str = "What feels clearer now?";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReflectionActivityForm {
    pub title: String,
    pub slug: Option<String>,
    pub introduction: Option<String>,
    pub prompt: String,
    pub note: String,
    pub topic: String,
    pub subtopic: String,
}

impl ReflectionActivityForm {
    pub fn parse(
        title: &str,
        slug: Option<&str>,
        introduction: Option<&str>,
        prompt: &str,
        note: &str,
        topic: &str,
        subtopic: &str,
    ) -> Option<Self> {
        let title = title.trim();
        let slug = slug.map(str::trim).filter(|value| !value.is_empty());
        let introduction = introduction.map(str::to_owned);
        let prompt = prompt.trim();
        let note = note.trim();
        let topic = topic.trim();
        let subtopic = subtopic.trim();
        if title.is_empty()
            || title.chars().count() > 120
            || slug.is_some_and(|value| value.chars().count() > 140 || !valid_slug(value))
            || introduction
                .as_ref()
                .is_some_and(|value| value.chars().count() > 1_000)
            || prompt.chars().count() > 4_000
            || note.chars().count() > 2_000
            || topic.chars().count() > 160
            || subtopic.chars().count() > 160
        {
            return None;
        }
        Some(Self {
            title: title.to_owned(),
            slug: slug.map(str::to_owned),
            introduction,
            prompt: prompt.to_owned(),
            note: note.to_owned(),
            topic: topic.to_owned(),
            subtopic: subtopic.to_owned(),
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
pub enum AdminWorldReflectionError {
    InvalidActivity,
    Conflict,
    Unavailable,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReflectionActivityType {
    Reflection,
    Review,
}

impl ReflectionActivityType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Reflection => "reflection",
            Self::Review => "review",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatedReflectionActivity {
    pub activity_id: Uuid,
    pub updated_at: String,
}

pub trait AdminWorldReflectionRepository {
    fn create_reflection(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &ReflectionActivityForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldReflectionError>> + Send;

    fn update_reflection(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ReflectionActivityForm,
        expected_updated_at: &str,
    ) -> impl Future<Output = Result<Option<UpdatedReflectionActivity>, AdminWorldReflectionError>> + Send;

    fn create_review(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &ReflectionActivityForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldReflectionError>> + Send;

    fn update_review(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ReflectionActivityForm,
        expected_updated_at: &str,
    ) -> impl Future<Output = Result<Option<UpdatedReflectionActivity>, AdminWorldReflectionError>> + Send;
}

/// Writes only the source Reflection fields. Review/revisit and other activity
/// types retain their distinct behavior rather than sharing an untyped JSON
/// authoring command.
pub struct AdminWorldReflectionCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminWorldReflectionCommand<'repository, Repository>
where
    Repository: AdminWorldReflectionRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &ReflectionActivityForm,
    ) -> Result<Option<Uuid>, AdminWorldReflectionError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .create_reflection(principal, node_id, form)
            .await
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ReflectionActivityForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedReflectionActivity>, AdminWorldReflectionError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .update_reflection(principal, activity_id, form, expected_updated_at)
            .await
    }
}

/// Writes the source Review/revisit form while retaining its distinct activity
/// type and learner playback behavior.
pub struct AdminWorldReviewCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: AdminWorldReflectionRepository>
    AdminWorldReviewCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &ReflectionActivityForm,
    ) -> Result<Option<Uuid>, AdminWorldReflectionError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .create_review(principal, node_id, form)
            .await
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &ReflectionActivityForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedReflectionActivity>, AdminWorldReflectionError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .update_review(principal, activity_id, form, expected_updated_at)
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
        AdminWorldReflectionCommand, AdminWorldReflectionError, AdminWorldReflectionRepository,
        AdminWorldReviewCommand, DEFAULT_REFLECTION_PROMPT, ReflectionActivityForm,
        UpdatedReflectionActivity, generated_slug,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldReflectionRepository for RecordingRepository {
        fn create_reflection(
            &self,
            _principal: &AuthorizedPrincipal,
            _node_id: Uuid,
            _form: &ReflectionActivityForm,
        ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldReflectionError>> + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn update_reflection(
            &self,
            _principal: &AuthorizedPrincipal,
            _activity_id: Uuid,
            _form: &ReflectionActivityForm,
            _expected_updated_at: &str,
        ) -> impl Future<
            Output = Result<Option<UpdatedReflectionActivity>, AdminWorldReflectionError>,
        > + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn create_review(
            &self,
            _principal: &AuthorizedPrincipal,
            _node_id: Uuid,
            _form: &ReflectionActivityForm,
        ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldReflectionError>> + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn update_review(
            &self,
            _principal: &AuthorizedPrincipal,
            _activity_id: Uuid,
            _form: &ReflectionActivityForm,
            _expected_updated_at: &str,
        ) -> impl Future<
            Output = Result<Option<UpdatedReflectionActivity>, AdminWorldReflectionError>,
        > + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    fn form() -> ReflectionActivityForm {
        ReflectionActivityForm::parse(
            "A reflection",
            None,
            None,
            DEFAULT_REFLECTION_PROMPT,
            "",
            "",
            "",
        )
        .expect("a bounded reflection form is valid")
    }

    #[test]
    fn normalizes_source_reflection_defaults_and_bounds() {
        let form = form();
        assert_eq!(form.prompt, DEFAULT_REFLECTION_PROMPT);
        assert_eq!(form.note, "");
        assert_eq!(generated_slug("Über a thought"), "uber-a-thought");
        assert!(
            ReflectionActivityForm::parse("Title", None, None, &"x".repeat(4_001), "", "", "")
                .is_none()
        );
        assert!(
            ReflectionActivityForm::parse("Title", None, None, "", &"x".repeat(2_001), "", "")
                .is_none()
        );
    }

    #[tokio::test]
    async fn requires_source_world_activity_update_before_writing() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };

        let result = AdminWorldReflectionCommand::new(&repository)
            .create(&principal, Uuid::new_v4(), &form())
            .await
            .expect("authorization check succeeds");
        assert_eq!(result, None);
        assert!(!repository.called.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn requires_source_world_activity_update_before_editing() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_nodes:rud:all".to_owned()],
        };

        let result = AdminWorldReflectionCommand::new(&repository)
            .update(
                &principal,
                Uuid::new_v4(),
                &form(),
                "2026-11-07T17:00:00.000000Z",
            )
            .await
            .expect("authorization check succeeds");
        assert_eq!(result, None);
        assert!(!repository.called.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn keeps_review_authoring_distinct_from_reflection_writes() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec![],
        };

        let result = AdminWorldReviewCommand::new(&repository)
            .create(&principal, Uuid::new_v4(), &form())
            .await
            .expect("authorization check succeeds");
        assert_eq!(result, None);
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
