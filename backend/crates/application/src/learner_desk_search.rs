use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerDeskSearch,
};

pub const DEFAULT_PAGE_SIZE: i64 = 5;
pub const MAX_PAGE_SIZE: i64 = 24;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearnerDeskSearchRequest {
    pub page: i64,
    pub per_page: i64,
    pub term: String,
}

impl LearnerDeskSearchRequest {
    /// Mirrors the source endpoint's request bounds. The Desk itself waits for
    /// two characters before searching, but the API remains compatible with a
    /// one-character query for non-browser clients.
    pub fn parse(query: Option<&str>, page: Option<i64>, per_page: Option<i64>) -> Option<Self> {
        let term = query?.trim();
        let term_length = term.chars().count();
        let page = page.unwrap_or(1);
        let per_page = per_page.unwrap_or(DEFAULT_PAGE_SIZE);

        ((1..=80).contains(&term_length)
            && (1..=10_000).contains(&page)
            && (1..=MAX_PAGE_SIZE).contains(&per_page))
        .then(|| Self {
            page,
            per_page,
            term: term.to_owned(),
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerDeskSearchReadError;

pub trait LearnerDeskSearchRepository {
    fn search(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerDeskSearchRequest,
    ) -> impl Future<Output = Result<LearnerDeskSearch, LearnerDeskSearchReadError>> + Send;
}

pub struct LearnerDeskSearchQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerDeskSearchQuery<'repository, Repository>
where
    Repository: LearnerDeskSearchRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerDeskSearchRequest,
    ) -> Result<LearnerDeskSearch, LearnerDeskSearchReadError> {
        self.repository.search(principal, request).await
    }
}

#[cfg(test)]
mod tests {
    use super::{DEFAULT_PAGE_SIZE, LearnerDeskSearchRequest};

    #[test]
    fn preserves_the_source_search_bounds_and_normalization() {
        assert_eq!(
            LearnerDeskSearchRequest::parse(Some("  map  "), None, None),
            Some(LearnerDeskSearchRequest {
                page: 1,
                per_page: DEFAULT_PAGE_SIZE,
                term: "map".to_owned(),
            }),
        );
        assert!(LearnerDeskSearchRequest::parse(Some(""), None, None).is_none());
        assert!(LearnerDeskSearchRequest::parse(Some("map"), Some(0), None).is_none());
        assert!(LearnerDeskSearchRequest::parse(Some("map"), None, Some(25)).is_none());
        assert!(LearnerDeskSearchRequest::parse(Some(&"x".repeat(81)), None, None).is_none());
    }
}
