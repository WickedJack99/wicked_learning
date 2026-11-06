use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerSoundPreferences,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerSoundPreferenceDraft {
    pub muted: bool,
    pub effects_volume: i16,
    pub ambience_volume: i16,
}

impl LearnerSoundPreferenceDraft {
    pub fn parse(muted: bool, effects_volume: i16, ambience_volume: i16) -> Option<Self> {
        ((0..=100).contains(&effects_volume) && (0..=100).contains(&ambience_volume)).then_some(
            Self {
                muted,
                effects_volume,
                ambience_volume,
            },
        )
    }

    pub fn into_preferences(self) -> LearnerSoundPreferences {
        LearnerSoundPreferences {
            muted: self.muted,
            effects_volume: self.effects_volume,
            ambience_volume: self.ambience_volume,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerSoundPreferenceError;

pub trait LearnerSoundPreferenceRepository {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl Future<Output = Result<LearnerSoundPreferences, LearnerSoundPreferenceError>> + Send;
    fn save(
        &self,
        principal: &AuthorizedPrincipal,
        draft: LearnerSoundPreferenceDraft,
    ) -> impl Future<Output = Result<LearnerSoundPreferences, LearnerSoundPreferenceError>> + Send;
}

pub struct LearnerSoundPreferenceQuery<'repository, Repository> {
    repository: &'repository Repository,
}
pub struct LearnerSoundPreferenceCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: LearnerSoundPreferenceRepository>
    LearnerSoundPreferenceQuery<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<LearnerSoundPreferences, LearnerSoundPreferenceError> {
        self.repository.load(principal).await
    }
}

impl<'repository, Repository: LearnerSoundPreferenceRepository>
    LearnerSoundPreferenceCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        draft: LearnerSoundPreferenceDraft,
    ) -> Result<LearnerSoundPreferences, LearnerSoundPreferenceError> {
        self.repository.save(principal, draft).await
    }
}

#[cfg(test)]
mod tests {
    use super::LearnerSoundPreferenceDraft;

    #[test]
    fn accepts_only_source_slider_values() {
        assert!(LearnerSoundPreferenceDraft::parse(false, 0, 100).is_some());
        assert!(LearnerSoundPreferenceDraft::parse(true, -1, 100).is_none());
        assert!(LearnerSoundPreferenceDraft::parse(true, 100, 101).is_none());
    }
}
