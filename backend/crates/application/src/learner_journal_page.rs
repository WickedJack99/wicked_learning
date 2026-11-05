use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerJournalPage,
};

pub const MAX_MARKDOWN_CHARACTERS: usize = 100_000;
pub const MAX_SUBTOPIC_CHARACTERS: usize = 160;
pub const MAX_TITLE_CHARACTERS: usize = 240;
pub const MAX_TOPIC_CHARACTERS: usize = 160;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearnerJournalPageDraft {
    pub markdown: String,
    pub preferred_mode: String,
    pub subtopic: String,
    pub title: String,
    pub topic: String,
}

impl LearnerJournalPageDraft {
    pub fn new(
        title: String,
        topic: String,
        subtopic: Option<String>,
        markdown: Option<String>,
        preferred_mode: Option<String>,
        default_mode: &str,
    ) -> Option<Self> {
        let title = title.trim().to_owned();
        let topic = topic.trim().to_owned();
        let subtopic = subtopic.unwrap_or_default().trim().to_owned();
        let markdown = markdown.unwrap_or_default();
        let preferred_mode = preferred_mode.unwrap_or_else(|| default_mode.to_owned());
        if title.is_empty()
            || topic.is_empty()
            || title.chars().count() > MAX_TITLE_CHARACTERS
            || topic.chars().count() > MAX_TOPIC_CHARACTERS
            || subtopic.chars().count() > MAX_SUBTOPIC_CHARACTERS
            || markdown.chars().count() > MAX_MARKDOWN_CHARACTERS
            || !matches!(preferred_mode.as_str(), "view" | "edit")
        {
            return None;
        }

        Some(Self {
            markdown,
            preferred_mode,
            subtopic,
            title,
            topic,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerJournalPageWriteError;

/// All mutations must scope the target to the authenticated application
/// principal in SQL. `None` means the page does not exist for that principal,
/// so callers must not distinguish an unknown UUID from another learner's page.
pub trait LearnerJournalPageRepository {
    fn create(
        &self,
        principal: &AuthorizedPrincipal,
        draft: &LearnerJournalPageDraft,
    ) -> impl Future<Output = Result<LearnerJournalPage, LearnerJournalPageWriteError>> + Send;

    fn update(
        &self,
        principal: &AuthorizedPrincipal,
        page_id: Uuid,
        draft: &LearnerJournalPageDraft,
    ) -> impl Future<Output = Result<Option<LearnerJournalPage>, LearnerJournalPageWriteError>> + Send;

    fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        page_id: Uuid,
    ) -> impl Future<Output = Result<bool, LearnerJournalPageWriteError>> + Send;
}

pub struct LearnerJournalPageCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerJournalPageCommand<'repository, Repository>
where
    Repository: LearnerJournalPageRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        draft: &LearnerJournalPageDraft,
    ) -> Result<LearnerJournalPage, LearnerJournalPageWriteError> {
        self.repository.create(principal, draft).await
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        page_id: Uuid,
        draft: &LearnerJournalPageDraft,
    ) -> Result<Option<LearnerJournalPage>, LearnerJournalPageWriteError> {
        self.repository.update(principal, page_id, draft).await
    }

    pub async fn delete(
        &self,
        principal: &AuthorizedPrincipal,
        page_id: Uuid,
    ) -> Result<bool, LearnerJournalPageWriteError> {
        self.repository.delete(principal, page_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::LearnerJournalPageDraft;

    #[test]
    fn keeps_manual_titles_separate_from_shared_categories_and_allows_empty_markdown() {
        let first = LearnerJournalPageDraft::new(
            " First note ".to_owned(),
            " Field studies ".to_owned(),
            None,
            Some(String::new()),
            None,
            "edit",
        );
        let second = LearnerJournalPageDraft::new(
            "Second note".to_owned(),
            "Field studies".to_owned(),
            None,
            None,
            Some("view".to_owned()),
            "edit",
        );

        assert_eq!(
            first.as_ref().map(|draft| draft.title.as_str()),
            Some("First note")
        );
        assert_eq!(
            first.as_ref().map(|draft| draft.markdown.as_str()),
            Some("")
        );
        assert_eq!(
            second.as_ref().map(|draft| draft.topic.as_str()),
            Some("Field studies")
        );
        assert_eq!(
            second.as_ref().map(|draft| draft.preferred_mode.as_str()),
            Some("view")
        );
    }

    #[test]
    fn rejects_blank_or_unsupported_manual_page_fields() {
        assert!(
            LearnerJournalPageDraft::new(
                " ".to_owned(),
                "Field studies".to_owned(),
                None,
                None,
                None,
                "edit",
            )
            .is_none()
        );
        assert!(
            LearnerJournalPageDraft::new(
                "Note".to_owned(),
                "Field studies".to_owned(),
                None,
                None,
                Some("preview".to_owned()),
                "edit",
            )
            .is_none()
        );
    }
}
