use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::learner_state::LearnerAppearance;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IdentityRegistrationDraft {
    pub appearance: LearnerAppearance,
    pub display_name: String,
    pub normalized_email: String,
    pub password_hash: String,
    pub registration_token_hash: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct IdentityRegistration {
    pub subject_id: Uuid,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum IdentityRegistrationError {
    EmailUnavailable,
    InvalidRegistrationToken,
    Unavailable,
}

/// The persistence adapter owns the deliberately compensating two-database
/// provisioning workflow. The application boundary carries no plaintext
/// password or registration token.
pub trait IdentityRegistrationRepository {
    fn register(
        &self,
        draft: IdentityRegistrationDraft,
    ) -> impl Future<Output = Result<IdentityRegistration, IdentityRegistrationError>> + Send;
}

pub struct IdentityRegistrationCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: IdentityRegistrationRepository>
    IdentityRegistrationCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        draft: IdentityRegistrationDraft,
    ) -> Result<IdentityRegistration, IdentityRegistrationError> {
        self.repository.register(draft).await
    }
}
