use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::{ApplicationCapability, AuthorizedPrincipal},
    learner_state::{AdminLearningGroup, AdminLearningGroups},
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminLearningGroupError;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearningGroupForm {
    pub description: Option<String>,
    pub name: String,
    pub slug: Option<String>,
    pub study_topic: Option<String>,
}

impl LearningGroupForm {
    pub fn parse(
        name: &str,
        slug: Option<&str>,
        description: Option<&str>,
        study_topic: Option<&str>,
    ) -> Option<Self> {
        let name = name.trim();
        let slug = optional_trimmed(slug);
        let description = optional_trimmed(description);
        let study_topic = optional_trimmed(study_topic);
        if name.is_empty()
            || name.chars().count() > 120
            || slug.as_ref().is_some_and(|value| {
                value.len() > 140
                    || !value.bytes().all(|character| {
                        character.is_ascii_alphanumeric() || character == b'-' || character == b'_'
                    })
            })
            || description
                .as_ref()
                .is_some_and(|value| value.chars().count() > 4_000)
            || study_topic
                .as_ref()
                .is_some_and(|value| value.chars().count() > 180)
        {
            return None;
        }

        Some(Self {
            description,
            name: name.to_owned(),
            slug,
            study_topic,
        })
    }
}

fn optional_trimmed(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

/// This port may project basic identity profiles only for an authorized
/// group administrator. It must not return that projection to a learner.
pub trait AdminLearningGroupRepository {
    fn list(
        &self,
    ) -> impl Future<Output = Result<AdminLearningGroups, AdminLearningGroupError>> + Send;

    fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &LearningGroupForm,
    ) -> impl Future<Output = Result<Option<AdminLearningGroup>, AdminLearningGroupError>> + Send;

    fn update(
        &self,
        group_id: Uuid,
        form: &LearningGroupForm,
    ) -> impl Future<Output = Result<Option<AdminLearningGroup>, AdminLearningGroupError>> + Send;

    fn sync_members(
        &self,
        group_id: Uuid,
        member_subject_ids: &[Uuid],
    ) -> impl Future<Output = Result<Option<AdminLearningGroup>, AdminLearningGroupError>> + Send;
}

pub struct AdminLearningGroupsQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct AdminLearningGroupsCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminLearningGroupsQuery<'repository, Repository>
where
    Repository: AdminLearningGroupRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<AdminLearningGroups>, AdminLearningGroupError> {
        if !principal.has_capability(ApplicationCapability::ManageLearningGroups) {
            return Ok(None);
        }

        self.repository.list().await.map(Some)
    }
}

impl<'repository, Repository> AdminLearningGroupsCommand<'repository, Repository>
where
    Repository: AdminLearningGroupRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        form: &LearningGroupForm,
    ) -> Result<Option<AdminLearningGroup>, AdminLearningGroupError> {
        if !principal.has_capability(ApplicationCapability::ManageLearningGroups) {
            return Ok(None);
        }

        self.repository.create(principal, form).await
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        group_id: Uuid,
        form: &LearningGroupForm,
    ) -> Result<Option<AdminLearningGroup>, AdminLearningGroupError> {
        if !principal.has_capability(ApplicationCapability::ManageLearningGroups) {
            return Ok(None);
        }

        self.repository.update(group_id, form).await
    }

    pub async fn sync_members(
        &self,
        principal: &AuthorizedPrincipal,
        group_id: Uuid,
        member_subject_ids: &[Uuid],
    ) -> Result<Option<AdminLearningGroup>, AdminLearningGroupError> {
        if !principal.has_capability(ApplicationCapability::ManageLearningGroups) {
            return Ok(None);
        }

        self.repository
            .sync_members(group_id, member_subject_ids)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::LearningGroupForm;

    #[test]
    fn preserves_the_source_group_form_bounds_and_optional_fields() {
        assert_eq!(
            LearningGroupForm::parse("  Study circle  ", Some(""), Some("  "), Some("  Memory  ")),
            Some(LearningGroupForm {
                name: "Study circle".to_owned(),
                slug: None,
                description: None,
                study_topic: Some("Memory".to_owned()),
            })
        );
        assert!(LearningGroupForm::parse("", None, None, None).is_none());
        assert!(LearningGroupForm::parse("Group", Some("not a slug"), None, None).is_none());
        assert!(LearningGroupForm::parse("Group", None, Some(&"x".repeat(4_001)), None).is_none());
    }
}
