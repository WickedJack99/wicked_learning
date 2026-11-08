use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::{ApplicationCapability, AuthorizedPrincipal},
    learner_state::{LearnerJournalTheme, LearnerJournalThemeMode},
};

pub const MAX_FEEDBACK_CHARACTERS: usize = 20_000;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct JournalFeedbackReviewError;

#[derive(Clone, Debug)]
pub struct JournalFeedbackPolicy {
    pub allow_review_requests: bool,
    pub theme: LearnerJournalTheme,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminJournalFeedbackIdentity {
    pub email: Option<String>,
    pub name: Option<String>,
    pub subject_id: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminJournalFeedbackPageContent {
    pub id: Option<String>,
    pub markdown: String,
    pub subtopic: Option<String>,
    pub title: String,
    pub topic: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminJournalFeedbackDomain {
    pub id: Option<String>,
    pub label: String,
    pub type_: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminJournalFeedbackItem {
    pub domain: AdminJournalFeedbackDomain,
    pub feedback: Option<String>,
    pub id: String,
    pub page: AdminJournalFeedbackPageContent,
    pub requested_at: String,
    pub requester: AdminJournalFeedbackIdentity,
    pub responded_at: Option<String>,
    pub status: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminJournalFeedbackPagination {
    pub current_page: i64,
    pub last_page: i64,
    pub per_page: i64,
    pub total: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminJournalFeedbackPage {
    pub items: Vec<AdminJournalFeedbackItem>,
    pub pagination: AdminJournalFeedbackPagination,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RespondJournalFeedbackResult {
    AlreadyResponded,
    NotFound,
    Responded,
}

pub trait JournalFeedbackReviewRepository {
    fn policy(
        &self,
    ) -> impl Future<Output = Result<JournalFeedbackPolicy, JournalFeedbackReviewError>> + Send;
    fn update_policy(
        &self,
        policy: JournalFeedbackPolicy,
    ) -> impl Future<Output = Result<JournalFeedbackPolicy, JournalFeedbackReviewError>> + Send;
    fn list(
        &self,
        page: i64,
    ) -> impl Future<Output = Result<AdminJournalFeedbackPage, JournalFeedbackReviewError>> + Send;
    fn respond(
        &self,
        principal: &AuthorizedPrincipal,
        request_id: Uuid,
        feedback: &str,
    ) -> impl Future<Output = Result<RespondJournalFeedbackResult, JournalFeedbackReviewError>> + Send;
}

pub struct JournalFeedbackPolicyQuery<'repository, Repository> {
    repository: &'repository Repository,
}
pub struct UpdateJournalFeedbackPolicy<'repository, Repository> {
    repository: &'repository Repository,
}
pub struct JournalFeedbackReviewQuery<'repository, Repository> {
    repository: &'repository Repository,
}
pub struct RespondToJournalFeedback<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: JournalFeedbackReviewRepository>
    JournalFeedbackPolicyQuery<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<JournalFeedbackPolicy>, JournalFeedbackReviewError> {
        if !principal.has_capability(ApplicationCapability::ManageJournalFeedbackPolicy) {
            return Ok(None);
        }
        self.repository.policy().await.map(Some)
    }
}

impl<'repository, Repository: JournalFeedbackReviewRepository>
    UpdateJournalFeedbackPolicy<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        policy: JournalFeedbackPolicy,
    ) -> Result<Option<JournalFeedbackPolicy>, JournalFeedbackReviewError> {
        if !principal.has_capability(ApplicationCapability::ManageJournalFeedbackPolicy)
            || !valid_journal_theme(&policy.theme)
        {
            return Ok(None);
        }
        self.repository.update_policy(policy).await.map(Some)
    }
}

/// The source accepts a complete, normalized Journal theme from its settings
/// form. Keep its bounds at the application boundary so alternate HTTP routes
/// cannot persist unbounded presentation JSON.
pub fn valid_journal_theme(theme: &LearnerJournalTheme) -> bool {
    valid_journal_theme_mode(&theme.dark) && valid_journal_theme_mode(&theme.light)
}

fn valid_journal_theme_mode(theme: &LearnerJournalThemeMode) -> bool {
    let colors = [
        &theme.accent,
        &theme.accent_text,
        &theme.background_overlay,
        &theme.body_text,
        &theme.button_background,
        &theme.button_border,
        &theme.button_text,
        &theme.content_background,
        &theme.header_background,
        &theme.heading_text,
        &theme.input_background,
        &theme.muted_text,
        &theme.panel_background,
        &theme.panel_border,
        &theme.selected_background,
        &theme.selected_border,
        &theme.selected_text,
        &theme.sidebar_background,
    ];
    let opacities = [
        theme.accent_opacity,
        theme.accent_text_opacity,
        theme.background_overlay_opacity,
        theme.body_text_opacity,
        theme.button_background_opacity,
        theme.button_border_opacity,
        theme.button_text_opacity,
        theme.content_background_opacity,
        theme.header_background_opacity,
        theme.heading_text_opacity,
        theme.input_background_opacity,
        theme.muted_text_opacity,
        theme.panel_background_opacity,
        theme.panel_border_opacity,
        theme.selected_background_opacity,
        theme.selected_border_opacity,
        theme.selected_text_opacity,
        theme.sidebar_background_opacity,
    ];

    theme.background_image.chars().count() <= 2_048
        && (0..=100).contains(&theme.background_position_x)
        && (0..=100).contains(&theme.background_position_y)
        && (25..=300).contains(&theme.background_zoom)
        && theme.background_assets.len() <= 12
        && colors.iter().all(|value| value.chars().count() <= 64)
        && opacities.iter().all(|value| (0..=100).contains(value))
        && theme.background_assets.iter().all(|asset| {
            asset.id.chars().count() <= 64
                && asset.image.chars().count() <= 2_048
                && (0..=100).contains(&asset.position_x)
                && (0..=100).contains(&asset.position_y)
                && (25..=300).contains(&asset.zoom)
        })
}

impl<'repository, Repository: JournalFeedbackReviewRepository>
    JournalFeedbackReviewQuery<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        page: i64,
    ) -> Result<Option<AdminJournalFeedbackPage>, JournalFeedbackReviewError> {
        if !principal.has_capability(ApplicationCapability::ViewJournalFeedback)
            || !(1..=10_000).contains(&page)
        {
            return Ok(None);
        }
        self.repository.list(page).await.map(Some)
    }
}

impl<'repository, Repository: JournalFeedbackReviewRepository>
    RespondToJournalFeedback<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        request_id: Uuid,
        feedback: &str,
    ) -> Result<Option<RespondJournalFeedbackResult>, JournalFeedbackReviewError> {
        let feedback = feedback.trim();
        if !principal.has_capability(ApplicationCapability::ReviewJournalFeedback)
            || feedback.is_empty()
            || feedback.chars().count() > MAX_FEEDBACK_CHARACTERS
        {
            return Ok(None);
        }
        self.repository
            .respond(principal, request_id, feedback)
            .await
            .map(Some)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Repository;
    impl JournalFeedbackReviewRepository for Repository {
        fn policy(
            &self,
        ) -> impl Future<Output = Result<JournalFeedbackPolicy, JournalFeedbackReviewError>> + Send
        {
            async { panic!("unauthorized policy reads must not reach the repository") }
        }
        fn update_policy(
            &self,
            _: JournalFeedbackPolicy,
        ) -> impl Future<Output = Result<JournalFeedbackPolicy, JournalFeedbackReviewError>> + Send
        {
            async { panic!("unauthorized policy writes must not reach the repository") }
        }
        fn list(
            &self,
            _: i64,
        ) -> impl Future<Output = Result<AdminJournalFeedbackPage, JournalFeedbackReviewError>> + Send
        {
            async { panic!("unauthorized reads must not reach the repository") }
        }
        fn respond(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
            _: &str,
        ) -> impl Future<Output = Result<RespondJournalFeedbackResult, JournalFeedbackReviewError>> + Send
        {
            async { panic!("unauthorized replies must not reach the repository") }
        }
    }

    #[tokio::test]
    async fn requires_separate_capabilities_for_private_journal_policy_and_review() {
        let repository = Repository;
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec![],
        };
        assert!(
            JournalFeedbackPolicyQuery::new(&repository)
                .execute(&principal)
                .await
                .unwrap()
                .is_none()
        );
        assert!(
            JournalFeedbackReviewQuery::new(&repository)
                .execute(&principal, 1)
                .await
                .unwrap()
                .is_none()
        );
        assert!(
            RespondToJournalFeedback::new(&repository)
                .execute(&principal, Uuid::new_v4(), "helpful reply")
                .await
                .unwrap()
                .is_none()
        );
    }

    #[test]
    fn journal_theme_validation_preserves_source_configuration_bounds() {
        let mut theme = wicked_learning_domain::learner_state::default_learner_journal_theme();
        assert!(valid_journal_theme(&theme));

        theme.dark.background_zoom = 301;
        assert!(!valid_journal_theme(&theme));
    }

    #[tokio::test]
    async fn invalid_journal_theme_does_not_reach_an_authorized_repository() {
        let repository = Repository;
        let mut theme = wicked_learning_domain::learner_state::default_learner_journal_theme();
        theme.light.background_assets = vec![
            wicked_learning_domain::learner_state::LearnerJournalBackgroundAsset {
                id: "asset".to_owned(),
                image: String::new(),
                position_x: 50,
                position_y: 50,
                zoom: 100,
            };
            13
        ];
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec![
                ApplicationCapability::ManageJournalFeedbackPolicy
                    .key()
                    .to_owned(),
            ],
        };

        assert!(
            UpdateJournalFeedbackPolicy::new(&repository)
                .execute(
                    &principal,
                    JournalFeedbackPolicy {
                        allow_review_requests: true,
                        theme,
                    },
                )
                .await
                .unwrap()
                .is_none()
        );
    }
}
