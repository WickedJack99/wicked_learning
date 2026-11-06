use std::future::Future;

use wicked_learning_domain::identity_access::AuthorizedPrincipal;

const CATEGORIES: [&str; 4] = ["general", "idea", "problem", "praise"];
const MIN_MESSAGE_CHARACTERS: usize = 10;
const MAX_MESSAGE_CHARACTERS: usize = 4_000;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlatformFeedbackDraft {
    pub category: String,
    pub message: String,
}

impl PlatformFeedbackDraft {
    pub fn parse(category: String, message: String) -> Option<Self> {
        let category = category.trim().to_owned();
        let message = message.trim().to_owned();
        (CATEGORIES.contains(&category.as_str())
            && (MIN_MESSAGE_CHARACTERS..=MAX_MESSAGE_CHARACTERS).contains(&message.chars().count()))
        .then_some(Self { category, message })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PlatformFeedbackSubmissionError;

pub trait PlatformFeedbackRepository {
    fn submit(
        &self,
        principal: &AuthorizedPrincipal,
        draft: &PlatformFeedbackDraft,
    ) -> impl Future<Output = Result<(), PlatformFeedbackSubmissionError>> + Send;
}

pub struct SubmitPlatformFeedbackCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: PlatformFeedbackRepository>
    SubmitPlatformFeedbackCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        draft: &PlatformFeedbackDraft,
    ) -> Result<(), PlatformFeedbackSubmissionError> {
        self.repository.submit(principal, draft).await
    }
}

#[cfg(test)]
mod tests {
    use super::PlatformFeedbackDraft;

    #[test]
    fn accepts_only_bounded_source_categories_and_meaningful_messages() {
        let draft = PlatformFeedbackDraft::parse(
            " idea ".to_owned(),
            " The map made the next step easy to find. ".to_owned(),
        )
        .expect("source-defined feedback is valid");
        assert_eq!(draft.category, "idea");
        assert_eq!(draft.message, "The map made the next step easy to find.");

        assert!(
            PlatformFeedbackDraft::parse("rating".to_owned(), "Useful enough".to_owned()).is_none()
        );
        assert!(
            PlatformFeedbackDraft::parse("general".to_owned(), "Too short".to_owned()).is_none()
        );
        assert!(PlatformFeedbackDraft::parse("general".to_owned(), "a".repeat(4_001)).is_none());
    }
}
