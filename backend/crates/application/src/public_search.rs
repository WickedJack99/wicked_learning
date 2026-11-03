use std::future::Future;

use wicked_learning_domain::world_content::PublicSearchResponse;

pub const MAX_QUERY_CHARACTERS: usize = 80;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PublicSearchTerm(String);

impl PublicSearchTerm {
    pub fn parse(value: &str) -> Option<Self> {
        let value = value.trim();
        let length = value.chars().count();
        (2..=MAX_QUERY_CHARACTERS)
            .contains(&length)
            .then(|| Self(value.to_owned()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PublicSearchReadError;

/// The application boundary for bounded public place search.
pub trait PublicSearchRepository {
    fn search_published(
        &self,
        term: &PublicSearchTerm,
    ) -> impl Future<Output = Result<PublicSearchResponse, PublicSearchReadError>> + Send;
}

pub struct PublicSearchQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> PublicSearchQuery<'repository, Repository>
where
    Repository: PublicSearchRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        term: &PublicSearchTerm,
    ) -> Result<PublicSearchResponse, PublicSearchReadError> {
        self.repository.search_published(term).await
    }
}

#[cfg(test)]
mod tests {
    use super::PublicSearchTerm;

    #[test]
    fn terms_are_trimmed_and_bounded_before_the_repository_is_called() {
        assert_eq!(PublicSearchTerm::parse("  map  ").unwrap().as_str(), "map");
        assert!(PublicSearchTerm::parse("x").is_none());
        assert!(PublicSearchTerm::parse(&"x".repeat(81)).is_none());
    }
}
