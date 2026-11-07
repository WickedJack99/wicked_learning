use std::future::Future;

use uuid::Uuid;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AccountDeletionError;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AccountDeletion {
    Deleted,
    Missing,
}

/// The account owner has already proved their current password at the HTTP
/// boundary. This use case owns only the cross-database deprovisioning policy.
pub trait AccountDeletionRepository {
    fn delete_account(
        &self,
        subject_id: Uuid,
    ) -> impl Future<Output = Result<AccountDeletion, AccountDeletionError>> + Send;
}

pub struct DeleteAccountCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> DeleteAccountCommand<'repository, Repository>
where
    Repository: AccountDeletionRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(&self, subject_id: Uuid) -> Result<AccountDeletion, AccountDeletionError> {
        self.repository.delete_account(subject_id).await
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::{
        AccountDeletion, AccountDeletionError, AccountDeletionRepository, DeleteAccountCommand,
    };

    struct Repository;

    impl AccountDeletionRepository for Repository {
        fn delete_account(
            &self,
            _subject_id: Uuid,
        ) -> impl std::future::Future<Output = Result<AccountDeletion, AccountDeletionError>> + Send
        {
            async { Ok(AccountDeletion::Deleted) }
        }
    }

    #[tokio::test]
    async fn delegates_the_confirmed_subject_to_the_deprovisioning_repository() {
        assert_eq!(
            DeleteAccountCommand::new(&Repository)
                .execute(Uuid::nil())
                .await,
            Ok(AccountDeletion::Deleted)
        );
    }
}
