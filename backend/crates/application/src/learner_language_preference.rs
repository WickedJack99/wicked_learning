use std::future::Future;

use wicked_learning_domain::identity_access::AuthorizedPrincipal;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AvailableLanguage {
    pub code: String,
    pub name: String,
    pub native_name: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearnerLanguagePreference {
    pub available_languages: Vec<AvailableLanguage>,
    pub locale: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LearnerLanguagePreferenceError {
    InvalidLocale,
    Unavailable,
}

pub trait LearnerLanguagePreferenceRepository {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl Future<Output = Result<LearnerLanguagePreference, LearnerLanguagePreferenceError>> + Send;

    fn save(
        &self,
        principal: &AuthorizedPrincipal,
        locale: String,
    ) -> impl Future<Output = Result<LearnerLanguagePreference, LearnerLanguagePreferenceError>> + Send;
}

pub struct LearnerLanguagePreferenceQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: LearnerLanguagePreferenceRepository>
    LearnerLanguagePreferenceQuery<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<LearnerLanguagePreference, LearnerLanguagePreferenceError> {
        self.repository.load(principal).await
    }
}

pub struct UpdateLearnerLanguagePreferenceCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: LearnerLanguagePreferenceRepository>
    UpdateLearnerLanguagePreferenceCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        locale: String,
    ) -> Result<LearnerLanguagePreference, LearnerLanguagePreferenceError> {
        self.repository.save(principal, locale).await
    }
}
