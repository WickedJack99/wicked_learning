use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learning_companion::LearningCompanionSettings,
};

const MODES: [&str; 3] = ["scripted", "guided_ai", "open_ai"];
const AI_CAPABILITIES: [&str; 6] = [
    "current-context",
    "topic-context",
    "route-context",
    "nearby-places",
    "navigation-alternatives",
    "revisit-options",
];

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearningCompanionSettingsForm {
    pub ai_capabilities: Vec<String>,
    pub ai_enabled: bool,
    pub ai_template_id: Option<Uuid>,
    pub avatar_color: String,
    pub avatar_position_x: i16,
    pub avatar_position_y: i16,
    pub avatar_scale: i16,
    pub avatar_url: Option<String>,
    pub display_name: String,
    pub enabled: bool,
    pub mode: String,
    pub welcome_message: String,
}

impl LearningCompanionSettingsForm {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        enabled: bool,
        display_name: &str,
        avatar_url: Option<&str>,
        avatar_color: &str,
        avatar_position_x: i16,
        avatar_position_y: i16,
        avatar_scale: i16,
        welcome_message: &str,
        mode: &str,
        ai_enabled: bool,
        ai_template_id: Option<Uuid>,
        ai_capabilities: Vec<String>,
    ) -> Option<Self> {
        let display_name = bounded_required(display_name, 80)?;
        let welcome_message = bounded_required(welcome_message, 1_200)?;
        let avatar_color = avatar_color.trim();
        let mode = mode.trim();
        if !valid_hex_color(avatar_color)
            || !(0..=100).contains(&avatar_position_x)
            || !(0..=100).contains(&avatar_position_y)
            || !(80..=200).contains(&avatar_scale)
            || !MODES.contains(&mode)
            || ai_capabilities.len() > 3
            || ai_capabilities
                .iter()
                .any(|capability| !AI_CAPABILITIES.contains(&capability.as_str()))
            || has_duplicates(&ai_capabilities)
        {
            return None;
        }

        Some(Self {
            ai_capabilities,
            ai_enabled,
            ai_template_id,
            avatar_color: avatar_color.to_owned(),
            avatar_position_x,
            avatar_position_y,
            avatar_scale,
            avatar_url: optional_bounded(avatar_url, 2_048)?,
            display_name,
            enabled,
            mode: mode.to_owned(),
            welcome_message,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminLearningCompanionError {
    Invalid,
    Unavailable,
}

pub trait AdminLearningCompanionRepository {
    fn load(
        &self,
    ) -> impl Future<Output = Result<LearningCompanionSettings, AdminLearningCompanionError>> + Send;
    fn save(
        &self,
        principal: &AuthorizedPrincipal,
        form: &LearningCompanionSettingsForm,
    ) -> impl Future<Output = Result<Option<LearningCompanionSettings>, AdminLearningCompanionError>>
    + Send;
}

pub struct AdminLearningCompanionQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminLearningCompanionQuery<'repository, Repository>
where
    Repository: AdminLearningCompanionRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<LearningCompanionSettings>, AdminLearningCompanionError> {
        if !principal.has_permission("companion", "ro") {
            return Ok(None);
        }
        self.repository.load().await.map(Some)
    }
}

pub struct AdminLearningCompanionCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminLearningCompanionCommand<'repository, Repository>
where
    Repository: AdminLearningCompanionRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        form: &LearningCompanionSettingsForm,
    ) -> Result<Option<LearningCompanionSettings>, AdminLearningCompanionError> {
        if !principal.has_permission("companion", "ru") {
            return Ok(None);
        }
        self.repository.save(principal, form).await
    }
}

fn bounded_required(value: &str, maximum: usize) -> Option<String> {
    let value = value.trim();
    (!value.is_empty() && value.chars().count() <= maximum).then(|| value.to_owned())
}

fn optional_bounded(value: Option<&str>, maximum: usize) -> Option<Option<String>> {
    let value = value.map(str::trim).filter(|value| !value.is_empty());
    match value {
        None => Some(None),
        Some(value) if value.chars().count() <= maximum => Some(Some(value.to_owned())),
        Some(_) => None,
    }
}

fn valid_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value
            .chars()
            .skip(1)
            .all(|character| character.is_ascii_hexdigit())
}

fn has_duplicates(values: &[String]) -> bool {
    values
        .iter()
        .enumerate()
        .any(|(index, value)| values[..index].contains(value))
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
    use wicked_learning_domain::{
        identity_access::AuthorizedPrincipal, learning_companion::LearningCompanionSettings,
    };

    use super::{
        AdminLearningCompanionError, AdminLearningCompanionQuery, AdminLearningCompanionRepository,
        LearningCompanionSettingsForm,
    };

    struct Repository(Arc<AtomicBool>);

    impl AdminLearningCompanionRepository for Repository {
        fn load(
            &self,
        ) -> impl Future<Output = Result<LearningCompanionSettings, AdminLearningCompanionError>> + Send
        {
            self.0.store(true, Ordering::SeqCst);
            async { unreachable!("a denied query must not read settings") }
        }

        fn save(
            &self,
            _: &AuthorizedPrincipal,
            _: &LearningCompanionSettingsForm,
        ) -> impl Future<
            Output = Result<Option<LearningCompanionSettings>, AdminLearningCompanionError>,
        > + Send {
            async { unreachable!("this test does not write settings") }
        }
    }

    #[test]
    fn companion_settings_reject_unbounded_or_unknown_ai_capabilities() {
        assert!(
            LearningCompanionSettingsForm::parse(
                true,
                "Guide",
                None,
                "#5eead4",
                50,
                50,
                100,
                "A choice-preserving welcome.",
                "scripted",
                false,
                None,
                vec!["unknown".to_owned()],
            )
            .is_none()
        );

        assert!(
            LearningCompanionSettingsForm::parse(
                true,
                "Guide",
                None,
                "#5eead4",
                50,
                50,
                100,
                "A choice-preserving welcome.",
                "scripted",
                false,
                None,
                vec![
                    "current-context".to_owned(),
                    "topic-context".to_owned(),
                    "route-context".to_owned(),
                    "nearby-places".to_owned(),
                ],
            )
            .is_none()
        );
    }

    #[tokio::test]
    async fn companion_settings_require_the_source_read_permission() {
        let called = Arc::new(AtomicBool::new(false));
        let repository = Repository(called.clone());

        let result = AdminLearningCompanionQuery::new(&repository)
            .execute(&AuthorizedPrincipal {
                subject_id: Uuid::new_v4(),
                roles: vec![],
                capabilities: vec![],
            })
            .await
            .expect("authorization result");

        assert!(result.is_none());
        assert!(!called.load(Ordering::SeqCst));
    }
}
