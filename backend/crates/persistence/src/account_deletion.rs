use sqlx::PgPool;
use uuid::Uuid;
use wicked_learning_application::account_deletion::{
    AccountDeletion, AccountDeletionError, AccountDeletionRepository as Port,
};

use crate::identity_deletion::{self, IdentityDeletion};

pub struct PostgresAccountDeletionRepository<'pool> {
    application_pool: &'pool PgPool,
    identity_pool: &'pool PgPool,
}

impl<'pool> PostgresAccountDeletionRepository<'pool> {
    pub fn new(application_pool: &'pool PgPool, identity_pool: &'pool PgPool) -> Self {
        Self {
            application_pool,
            identity_pool,
        }
    }
}

impl Port for PostgresAccountDeletionRepository<'_> {
    fn delete_account(
        &self,
        subject_id: Uuid,
    ) -> impl std::future::Future<Output = Result<AccountDeletion, AccountDeletionError>> + Send
    {
        async move {
            identity_deletion::deprovision(
                self.application_pool,
                self.identity_pool,
                subject_id,
                subject_id,
            )
            .await
            .map(|result| match result {
                IdentityDeletion::Deleted => AccountDeletion::Deleted,
                IdentityDeletion::Missing => AccountDeletion::Missing,
            })
            .map_err(|error| {
                tracing::error!(%error, "could not delete the current account");
                AccountDeletionError
            })
        }
    }
}
