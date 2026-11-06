use std::future::Future;

use uuid::Uuid;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AccountProfile {
    pub display_name: String,
    pub email: String,
    pub public_username: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AccountProfileDraft {
    pub display_name: String,
    pub email: String,
    pub public_username: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AccountProfileError {
    Conflict,
    Missing,
    Unavailable,
}

pub trait AccountProfileRepository {
    fn load(
        &self,
        subject_id: Uuid,
    ) -> impl Future<Output = Result<Option<AccountProfile>, AccountProfileError>> + Send;

    fn update(
        &self,
        subject_id: Uuid,
        draft: AccountProfileDraft,
    ) -> impl Future<Output = Result<AccountProfile, AccountProfileError>> + Send;
}

pub struct AccountProfileQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: AccountProfileRepository>
    AccountProfileQuery<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        subject_id: Uuid,
    ) -> Result<Option<AccountProfile>, AccountProfileError> {
        self.repository.load(subject_id).await
    }
}

pub struct UpdateAccountProfileCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: AccountProfileRepository>
    UpdateAccountProfileCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        subject_id: Uuid,
        draft: AccountProfileDraft,
    ) -> Result<AccountProfile, AccountProfileError> {
        self.repository.update(subject_id, draft).await
    }
}
