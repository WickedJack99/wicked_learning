use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerDeskPlanningPreference, LearnerDeskTimeBudget},
};

const PURPOSE_FILTERS: [&str; 8] = [
    "any",
    "apply",
    "explain",
    "participate",
    "reflect",
    "retrieve",
    "review",
    "transfer",
];

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearnerDeskPlanningPreferenceDraft {
    pub purpose_filter: String,
    /// `None` represents the source's explicit `"any"` choice.
    pub time_budget: Option<i16>,
}

impl LearnerDeskPlanningPreferenceDraft {
    pub fn parse(purpose_filter: &str, time_budget: Option<i16>) -> Option<Self> {
        (PURPOSE_FILTERS.contains(&purpose_filter) && matches!(time_budget, None | Some(15 | 30)))
            .then(|| Self {
                purpose_filter: purpose_filter.to_owned(),
                time_budget,
            })
    }

    pub fn into_preference(self) -> LearnerDeskPlanningPreference {
        LearnerDeskPlanningPreference {
            is_saved: true,
            purpose_filter: self.purpose_filter,
            time_budget: self
                .time_budget
                .map(LearnerDeskTimeBudget::Minutes)
                .unwrap_or_else(|| LearnerDeskTimeBudget::Any("any".to_owned())),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerDeskPlanningPreferenceError;

/// Both reads and writes are owner-scoped at the persistence boundary. The
/// preference has no cross-learner or identity-database representation.
pub trait LearnerDeskPlanningPreferenceRepository {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl Future<
        Output = Result<LearnerDeskPlanningPreference, LearnerDeskPlanningPreferenceError>,
    > + Send;

    fn save(
        &self,
        principal: &AuthorizedPrincipal,
        draft: &LearnerDeskPlanningPreferenceDraft,
    ) -> impl Future<
        Output = Result<LearnerDeskPlanningPreference, LearnerDeskPlanningPreferenceError>,
    > + Send;
}

pub struct LearnerDeskPlanningPreferenceQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct LearnerDeskPlanningPreferenceCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerDeskPlanningPreferenceQuery<'repository, Repository>
where
    Repository: LearnerDeskPlanningPreferenceRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<LearnerDeskPlanningPreference, LearnerDeskPlanningPreferenceError> {
        self.repository.load(principal).await
    }
}

impl<'repository, Repository> LearnerDeskPlanningPreferenceCommand<'repository, Repository>
where
    Repository: LearnerDeskPlanningPreferenceRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        draft: &LearnerDeskPlanningPreferenceDraft,
    ) -> Result<LearnerDeskPlanningPreference, LearnerDeskPlanningPreferenceError> {
        self.repository.save(principal, draft).await
    }
}

#[cfg(test)]
mod tests {
    use wicked_learning_domain::learner_state::LearnerDeskTimeBudget;

    use super::LearnerDeskPlanningPreferenceDraft;

    #[test]
    fn accepts_only_the_source_defined_explicit_planning_choices() {
        let draft = LearnerDeskPlanningPreferenceDraft::parse("retrieve", Some(15))
            .expect("the source choice is valid");
        assert_eq!(draft.purpose_filter, "retrieve");
        assert!(matches!(
            draft.into_preference().time_budget,
            LearnerDeskTimeBudget::Minutes(15)
        ));

        assert!(LearnerDeskPlanningPreferenceDraft::parse("retrieve ", Some(15)).is_none());
        assert!(LearnerDeskPlanningPreferenceDraft::parse("recommend", Some(15)).is_none());
        assert!(LearnerDeskPlanningPreferenceDraft::parse("any", Some(20)).is_none());
        assert!(matches!(
            LearnerDeskPlanningPreferenceDraft::parse("any", None)
                .expect("any is an explicit source choice")
                .into_preference()
                .time_budget,
            LearnerDeskTimeBudget::Any(value) if value == "any"
        ));
    }
}
