use std::future::Future;

use wicked_learning_domain::platform_presentation::PublicPage;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PublicPageSlug(String);

impl PublicPageSlug {
    pub fn parse(value: &str) -> Option<Self> {
        (!value.is_empty()
            && value.len() <= 80
            && value.bytes().all(|character| {
                character.is_ascii_lowercase() || character.is_ascii_digit() || character == b'-'
            }))
        .then(|| Self(value.to_owned()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PublicPageReadError;

/// The application boundary for a published informational page.
pub trait PublicPageRepository {
    fn load_published(
        &self,
        slug: &PublicPageSlug,
    ) -> impl Future<Output = Result<Option<PublicPage>, PublicPageReadError>> + Send;
}

pub struct PublicPageQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> PublicPageQuery<'repository, Repository>
where
    Repository: PublicPageRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        slug: &PublicPageSlug,
    ) -> Result<Option<PublicPage>, PublicPageReadError> {
        self.repository.load_published(slug).await
    }
}

#[cfg(test)]
mod tests {
    use super::PublicPageSlug;

    #[test]
    fn public_page_slugs_are_bounded_lowercase_identifiers() {
        assert!(PublicPageSlug::parse("about").is_some());
        assert!(PublicPageSlug::parse("data-protection").is_some());
        assert!(PublicPageSlug::parse("About").is_none());
        assert!(PublicPageSlug::parse("../about").is_none());
        assert!(PublicPageSlug::parse("").is_none());
    }
}
