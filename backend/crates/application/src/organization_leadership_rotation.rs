use std::future::Future;

use crate::organization::OrganizationError;

/// Runs the source's monthly random-organization leadership transition outside
/// a browser read.
pub trait OrganizationLeadershipRotationRepository {
    fn rotate_due_random_leaders(
        &self,
    ) -> impl Future<Output = Result<u64, OrganizationError>> + Send;
}

pub struct RotateDueRandomOrganizationLeaders<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> RotateDueRandomOrganizationLeaders<'repository, Repository>
where
    Repository: OrganizationLeadershipRotationRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(&self) -> Result<u64, OrganizationError> {
        self.repository.rotate_due_random_leaders().await
    }
}

#[cfg(test)]
mod tests {
    use super::{OrganizationLeadershipRotationRepository, RotateDueRandomOrganizationLeaders};
    use crate::organization::OrganizationError;

    struct RecordingRepository;

    impl OrganizationLeadershipRotationRepository for RecordingRepository {
        async fn rotate_due_random_leaders(&self) -> Result<u64, OrganizationError> {
            Ok(3)
        }
    }

    #[tokio::test]
    async fn delegates_the_explicit_rotation_to_the_repository() {
        let repository = RecordingRepository;

        assert_eq!(
            RotateDueRandomOrganizationLeaders::new(&repository)
                .execute()
                .await,
            Ok(3)
        );
    }
}
