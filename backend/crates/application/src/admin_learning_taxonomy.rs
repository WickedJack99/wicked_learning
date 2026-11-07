use std::future::Future;

use wicked_learning_domain::{
    authoring::AdminLearningTaxonomy, identity_access::AuthorizedPrincipal,
};

const MAX_ENTRIES: usize = 200;
const MAX_NAME_LENGTH: usize = 120;
const MAX_DESCRIPTION_LENGTH: usize = 2_000;
const MAX_THRESHOLD: f64 = 100_000.0;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminLearningTaxonomyError;

#[derive(Clone, Debug, PartialEq)]
pub struct CompetenceTopicForm {
    pub name: String,
    pub description: Option<String>,
    pub growth_threshold: f64,
    pub emittance_threshold: f64,
    pub aura_threshold: f64,
    pub is_active: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearningConceptForm {
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
}

impl CompetenceTopicForm {
    pub fn parse_all(entries: Vec<Self>) -> Option<Vec<Self>> {
        if entries.len() > MAX_ENTRIES
            || entries.iter().any(|entry| {
                !valid_text(&entry.name, MAX_NAME_LENGTH)
                    || !valid_optional_text(entry.description.as_deref(), MAX_DESCRIPTION_LENGTH)
                    || !valid_threshold(entry.growth_threshold)
                    || !valid_threshold(entry.emittance_threshold)
                    || !valid_threshold(entry.aura_threshold)
            })
        {
            return None;
        }
        Some(
            entries
                .into_iter()
                .filter_map(normalize_competence_topic)
                .collect(),
        )
    }
}

impl LearningConceptForm {
    pub fn parse_all(entries: Vec<Self>) -> Option<Vec<Self>> {
        if entries.len() > MAX_ENTRIES
            || entries.iter().any(|entry| {
                !valid_text(&entry.name, MAX_NAME_LENGTH)
                    || !valid_optional_text(entry.description.as_deref(), MAX_DESCRIPTION_LENGTH)
            })
        {
            return None;
        }
        Some(
            entries
                .into_iter()
                .filter_map(normalize_learning_concept)
                .collect(),
        )
    }
}

fn normalize_competence_topic(mut entry: CompetenceTopicForm) -> Option<CompetenceTopicForm> {
    entry.name = entry.name.trim().to_owned();
    entry.description = optional_trimmed(entry.description.as_deref());
    (!entry.name.is_empty() && !generated_slug(&entry.name).is_empty()).then_some(entry)
}

fn normalize_learning_concept(mut entry: LearningConceptForm) -> Option<LearningConceptForm> {
    entry.name = entry.name.trim().to_owned();
    entry.description = optional_trimmed(entry.description.as_deref());
    (!entry.name.is_empty() && !generated_slug(&entry.name).is_empty()).then_some(entry)
}

fn valid_text(value: &str, maximum_length: usize) -> bool {
    !value.trim().is_empty() && value.chars().count() <= maximum_length
}

fn valid_optional_text(value: Option<&str>, maximum_length: usize) -> bool {
    value.is_none_or(|value| value.chars().count() <= maximum_length)
}

fn valid_threshold(value: f64) -> bool {
    value.is_finite() && (0.01..=MAX_THRESHOLD).contains(&value)
}

fn optional_trimmed(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

/// Mirrors Laravel's bounded `Str::slug` identifier behavior. An empty
/// transliteration is deliberately ignored, just as the source sync action.
pub fn generated_slug(name: &str) -> String {
    let mut slug = String::new();
    let mut separator = true;
    for character in deunicode::deunicode(name).chars() {
        if character.is_ascii_alphanumeric() {
            if slug.chars().count() == 140 {
                break;
            }
            slug.push(character.to_ascii_lowercase());
            separator = false;
        } else if !separator && slug.chars().count() < 140 {
            slug.push('-');
            separator = true;
        }
    }
    slug.trim_matches('-').to_owned()
}

pub trait AdminLearningTaxonomyRepository {
    fn list(
        &self,
        include_competence_topics: bool,
        include_learning_concepts: bool,
    ) -> impl Future<Output = Result<AdminLearningTaxonomy, AdminLearningTaxonomyError>> + Send;

    fn sync_competence_topics(
        &self,
        entries: &[CompetenceTopicForm],
    ) -> impl Future<Output = Result<(), AdminLearningTaxonomyError>> + Send;

    fn sync_learning_concepts(
        &self,
        entries: &[LearningConceptForm],
    ) -> impl Future<Output = Result<(), AdminLearningTaxonomyError>> + Send;
}

pub struct AdminLearningTaxonomyQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct AdminLearningTaxonomyCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminLearningTaxonomyQuery<'repository, Repository>
where
    Repository: AdminLearningTaxonomyRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<AdminLearningTaxonomy>, AdminLearningTaxonomyError> {
        let can_manage_competence_topics = principal.has_permission("competence_topics", "ru");
        let can_manage_learning_concepts = principal.has_permission("learning_concepts", "ru");
        if !can_manage_competence_topics && !can_manage_learning_concepts {
            return Ok(None);
        }
        self.repository
            .list(can_manage_competence_topics, can_manage_learning_concepts)
            .await
            .map(Some)
    }
}

impl<'repository, Repository> AdminLearningTaxonomyCommand<'repository, Repository>
where
    Repository: AdminLearningTaxonomyRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn sync_competence_topics(
        &self,
        principal: &AuthorizedPrincipal,
        entries: &[CompetenceTopicForm],
    ) -> Result<bool, AdminLearningTaxonomyError> {
        if !principal.has_permission("competence_topics", "ru") {
            return Ok(false);
        }
        self.repository.sync_competence_topics(entries).await?;
        Ok(true)
    }

    pub async fn sync_learning_concepts(
        &self,
        principal: &AuthorizedPrincipal,
        entries: &[LearningConceptForm],
    ) -> Result<bool, AdminLearningTaxonomyError> {
        if !principal.has_permission("learning_concepts", "ru") {
            return Ok(false);
        }
        self.repository.sync_learning_concepts(entries).await?;
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::{CompetenceTopicForm, LearningConceptForm, generated_slug};

    #[test]
    fn retains_the_source_catalog_bounds_and_slug_behavior() {
        assert_eq!(generated_slug("Über learning!"), "uber-learning");
        assert!(generated_slug(&"a".repeat(200)).len() <= 140);
        assert!(
            CompetenceTopicForm::parse_all(vec![CompetenceTopicForm {
                name: "Orientation".to_owned(),
                description: Some("A qualitative reading.".to_owned()),
                growth_threshold: 20.0,
                emittance_threshold: 20.0,
                aura_threshold: 10.0,
                is_active: true,
            }])
            .is_some()
        );
        assert!(
            CompetenceTopicForm::parse_all(vec![CompetenceTopicForm {
                name: "Orientation".to_owned(),
                description: None,
                growth_threshold: 0.0,
                emittance_threshold: 20.0,
                aura_threshold: 10.0,
                is_active: true,
            }])
            .is_none()
        );
        assert_eq!(LearningConceptForm::parse_all(vec![]), Some(vec![]));
        assert!(
            LearningConceptForm::parse_all(vec![LearningConceptForm {
                name: "  ".to_owned(),
                description: None,
                is_active: true,
            }])
            .is_none()
        );
    }
}
