use std::future::Future;

use wicked_learning_domain::platform_presentation::PublicSourceLinks;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PublicSourceLinksReadError;

/// The application boundary for source and attribution links safe for browsers.
pub trait PublicSourceLinksRepository {
    fn load_public(
        &self,
    ) -> impl Future<Output = Result<PublicSourceLinks, PublicSourceLinksReadError>> + Send;
}

pub struct PublicSourceLinksQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> PublicSourceLinksQuery<'repository, Repository>
where
    Repository: PublicSourceLinksRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(&self) -> Result<PublicSourceLinks, PublicSourceLinksReadError> {
        self.repository.load_public().await
    }
}
