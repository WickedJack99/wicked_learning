use std::future::Future;
use wicked_learning_domain::world_content::PublicWorld;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PublicWorldReadError;

/// The application boundary for a bounded anonymous World read.
///
/// Persistence owns SQL and maps database failures into this stable
/// application-level outcome. HTTP does not know which store is used.
pub trait PublicWorldRepository {
    fn load_first_published(
        &self,
    ) -> impl Future<Output = Result<Option<PublicWorld>, PublicWorldReadError>> + Send;
}

pub struct PublicWorldQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> PublicWorldQuery<'repository, Repository>
where
    Repository: PublicWorldRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(&self) -> Result<Option<PublicWorld>, PublicWorldReadError> {
        self.repository.load_first_published().await
    }
}

#[cfg(test)]
mod tests {
    use super::{PublicWorldQuery, PublicWorldReadError, PublicWorldRepository};

    struct EmptyRepository;

    impl PublicWorldRepository for EmptyRepository {
        fn load_first_published(
            &self,
        ) -> impl std::future::Future<
            Output = Result<
                Option<wicked_learning_domain::world_content::PublicWorld>,
                PublicWorldReadError,
            >,
        > + Send {
            async { Ok(None) }
        }
    }

    #[tokio::test]
    async fn returns_the_repository_result_without_http_or_sql_concerns() {
        let result = PublicWorldQuery::new(&EmptyRepository).execute().await;

        assert!(matches!(result, Ok(None)));
    }
}
