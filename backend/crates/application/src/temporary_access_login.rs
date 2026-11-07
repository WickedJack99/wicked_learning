use std::future::Future;

use uuid::Uuid;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TemporaryAccessLoginDraft {
    pub password_hash: String,
    pub token_hash: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TemporaryAccessLoginError {
    Unavailable,
}

pub trait TemporaryAccessLoginRepository {
    fn login(
        &self,
        draft: TemporaryAccessLoginDraft,
    ) -> impl Future<Output = Result<Option<Uuid>, TemporaryAccessLoginError>> + Send;
}

pub struct TemporaryAccessLoginCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: TemporaryAccessLoginRepository>
    TemporaryAccessLoginCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        draft: TemporaryAccessLoginDraft,
    ) -> Result<Option<Uuid>, TemporaryAccessLoginError> {
        self.repository.login(draft).await
    }
}
