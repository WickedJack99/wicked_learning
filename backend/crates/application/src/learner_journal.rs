use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerJournalDocument,
};

pub const DEFAULT_PAGE_SIZE: i64 = 4;
pub const MAX_PAGE_SIZE: i64 = 24;
pub const MAX_SEARCH_CHARACTERS: usize = 160;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearnerJournalRequest {
    pub page: i64,
    pub per_page: i64,
    pub search: Option<String>,
}

impl LearnerJournalRequest {
    pub fn parse(page: Option<i64>, per_page: Option<i64>, search: Option<&str>) -> Option<Self> {
        let page = page.unwrap_or(1);
        let per_page = per_page.unwrap_or(DEFAULT_PAGE_SIZE);
        if page < 1 || !(1..=MAX_PAGE_SIZE).contains(&per_page) {
            return None;
        }
        let search = search
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned);
        if search
            .as_deref()
            .is_some_and(|value| value.chars().count() > MAX_SEARCH_CHARACTERS)
        {
            return None;
        }

        Some(Self {
            page,
            per_page,
            search,
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerJournalReadError;

/// The repository must scope every row to the principal's application record.
/// Search and pagination are part of that boundary so a browser never receives
/// another learner's private writing and filters it locally.
pub trait LearnerJournalRepository {
    fn load_page(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerJournalRequest,
    ) -> impl Future<Output = Result<Option<LearnerJournalDocument>, LearnerJournalReadError>> + Send;
}

pub struct LearnerJournalQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerJournalQuery<'repository, Repository>
where
    Repository: LearnerJournalRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerJournalRequest,
    ) -> Result<Option<LearnerJournalDocument>, LearnerJournalReadError> {
        self.repository.load_page(principal, request).await
    }
}

#[cfg(test)]
mod tests {
    use super::{DEFAULT_PAGE_SIZE, LearnerJournalRequest, MAX_PAGE_SIZE};

    #[test]
    fn bounds_private_journal_pagination_and_search_before_the_repository() {
        assert_eq!(
            LearnerJournalRequest::parse(None, None, Some("  pattern  ")),
            Some(LearnerJournalRequest {
                page: 1,
                per_page: DEFAULT_PAGE_SIZE,
                search: Some("pattern".to_owned()),
            }),
        );
        assert!(LearnerJournalRequest::parse(Some(0), None, None).is_none());
        assert!(LearnerJournalRequest::parse(None, Some(MAX_PAGE_SIZE + 1), None).is_none());
        assert!(LearnerJournalRequest::parse(None, None, Some(&"x".repeat(161))).is_none());
    }
}
