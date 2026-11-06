use std::{
    fmt::{Display, Formatter},
    future::Future,
    pin::Pin,
};

use futures_util::stream::Stream;
use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearnerJournalExportPage {
    pub markdown: String,
    pub subtopic: String,
    pub title: String,
    pub topic: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerJournalExportError;

impl Display for LearnerJournalExportError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("could not export learner journal")
    }
}

impl std::error::Error for LearnerJournalExportError {}

pub type LearnerJournalExportStream =
    Pin<Box<dyn Stream<Item = Result<LearnerJournalExportPage, LearnerJournalExportError>> + Send>>;

/// The repository checks that an authenticated identity has an application
/// principal before opening the body stream. Every streamed row must remain
/// owner-scoped in SQL; this use case never accepts a browser-supplied user or
/// page identifier.
pub trait LearnerJournalExportRepository {
    fn has_principal(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl Future<Output = Result<bool, LearnerJournalExportError>> + Send;

    fn stream_pages(&self, identity_subject_id: Uuid) -> LearnerJournalExportStream;
}

pub struct LearnerJournalExportQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerJournalExportQuery<'repository, Repository>
where
    Repository: LearnerJournalExportRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<LearnerJournalExportStream>, LearnerJournalExportError> {
        if !self.repository.has_principal(principal).await? {
            return Ok(None);
        }

        Ok(Some(self.repository.stream_pages(principal.subject_id)))
    }
}

/// Preserves the existing Laravel export body for one page. The API emits the
/// separators and terminal newline while it streams these page chunks.
pub fn format_page(page: &LearnerJournalExportPage) -> String {
    let category = if page.subtopic.is_empty() {
        page.topic.clone()
    } else {
        format!("{} / {}", page.topic, page.subtopic)
    };

    format!(
        "# {}\n\n_Category: {}_\n\n{}",
        page.title,
        category,
        page.markdown.trim()
    )
}

#[cfg(test)]
mod tests {
    use super::{LearnerJournalExportPage, format_page};

    #[test]
    fn formats_each_page_exactly_like_the_source_markdown_export() {
        assert_eq!(
            format_page(&LearnerJournalExportPage {
                title: "Field note".to_owned(),
                topic: "Nature".to_owned(),
                subtopic: "Birds".to_owned(),
                markdown: "\nA careful observation.\n".to_owned(),
            }),
            "# Field note\n\n_Category: Nature / Birds_\n\nA careful observation."
        );
    }

    #[test]
    fn omits_the_subtopic_separator_when_the_source_page_has_no_subtopic() {
        assert_eq!(
            format_page(&LearnerJournalExportPage {
                title: "Untitled category".to_owned(),
                topic: "Notes".to_owned(),
                subtopic: String::new(),
                markdown: String::new(),
            }),
            "# Untitled category\n\n_Category: Notes_\n\n"
        );
    }
}
