use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerAppearance,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerAppearancePreferenceError;

pub trait LearnerAppearancePreferenceRepository {
    fn save(
        &self,
        principal: &AuthorizedPrincipal,
        appearance: LearnerAppearance,
    ) -> impl Future<Output = Result<LearnerAppearance, LearnerAppearancePreferenceError>> + Send;
}

pub struct LearnerAppearancePreferenceCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: LearnerAppearancePreferenceRepository>
    LearnerAppearancePreferenceCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        appearance: LearnerAppearance,
    ) -> Result<LearnerAppearance, LearnerAppearancePreferenceError> {
        self.repository.save(principal, appearance).await
    }
}

#[cfg(test)]
mod tests {
    use wicked_learning_domain::learner_state::LearnerAppearance;

    #[test]
    fn retains_only_the_two_source_resolved_appearance_values() {
        assert_eq!(
            LearnerAppearance::parse("light"),
            Some(LearnerAppearance::Light)
        );
        assert_eq!(
            LearnerAppearance::parse("dark"),
            Some(LearnerAppearance::Dark)
        );
        assert_eq!(LearnerAppearance::parse("system"), None);
    }
}
