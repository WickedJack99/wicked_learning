use std::future::Future;

use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeedbackPromptPreference {
    pub status: String,
}

impl FeedbackPromptPreference {
    pub fn default_enabled() -> Self {
        Self {
            status: "enabled".to_owned(),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FeedbackPromptAction {
    Enable,
    Decline,
    Dismiss,
}

impl FeedbackPromptAction {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "enable" => Some(Self::Enable),
            "decline" => Some(Self::Decline),
            "dismiss" => Some(Self::Dismiss),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct FeedbackPromptPreferenceError;

pub trait FeedbackPromptPreferenceRepository {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl Future<Output = Result<FeedbackPromptPreference, FeedbackPromptPreferenceError>> + Send;
    fn update(
        &self,
        principal: &AuthorizedPrincipal,
        action: FeedbackPromptAction,
    ) -> impl Future<Output = Result<FeedbackPromptPreference, FeedbackPromptPreferenceError>> + Send;
}

pub struct FeedbackPromptPreferenceQuery<'a, Repository> {
    repository: &'a Repository,
}
impl<'a, Repository: FeedbackPromptPreferenceRepository>
    FeedbackPromptPreferenceQuery<'a, Repository>
{
    pub fn new(repository: &'a Repository) -> Self {
        Self { repository }
    }
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<FeedbackPromptPreference, FeedbackPromptPreferenceError> {
        self.repository.load(principal).await
    }
}
pub struct UpdateFeedbackPromptPreferenceCommand<'a, Repository> {
    repository: &'a Repository,
}
impl<'a, Repository: FeedbackPromptPreferenceRepository>
    UpdateFeedbackPromptPreferenceCommand<'a, Repository>
{
    pub fn new(repository: &'a Repository) -> Self {
        Self { repository }
    }
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        action: FeedbackPromptAction,
    ) -> Result<FeedbackPromptPreference, FeedbackPromptPreferenceError> {
        self.repository.update(principal, action).await
    }
}

#[cfg(test)]
mod tests {
    use super::FeedbackPromptAction;
    #[test]
    fn accepts_only_source_prompt_actions() {
        assert_eq!(
            FeedbackPromptAction::parse("decline"),
            Some(FeedbackPromptAction::Decline)
        );
        assert!(FeedbackPromptAction::parse("later").is_none());
    }
}
