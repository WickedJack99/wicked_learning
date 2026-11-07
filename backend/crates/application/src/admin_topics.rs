use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    world_content::{AdminTopic, AdminTopicAdministration, AdminTopicArea},
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminTopicsError;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TopicAreaForm {
    pub title: String,
    pub description: Option<String>,
}

impl TopicAreaForm {
    pub fn parse(title: &str, description: Option<&str>) -> Option<Self> {
        let title = title.trim();
        let description = optional_trimmed(description);
        if title.is_empty()
            || title.chars().count() > 160
            || description
                .as_ref()
                .is_some_and(|value| value.chars().count() > 1_200)
        {
            return None;
        }
        Some(Self {
            title: title.to_owned(),
            description,
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TopicForm {
    pub title: String,
    pub description: Option<String>,
    pub content: Option<String>,
    pub parent_id: Option<Uuid>,
    pub is_published: bool,
}

impl TopicForm {
    pub fn parse(
        title: &str,
        description: Option<&str>,
        content: Option<&str>,
        parent_id: Option<Uuid>,
        is_published: Option<bool>,
    ) -> Option<Self> {
        let title = title.trim();
        let description = optional_trimmed(description);
        let content = optional_trimmed(content);
        if title.is_empty()
            || title.chars().count() > 200
            || description
                .as_ref()
                .is_some_and(|value| value.chars().count() > 2_400)
            || content
                .as_ref()
                .is_some_and(|value| value.chars().count() > 50_000)
        {
            return None;
        }
        Some(Self {
            title: title.to_owned(),
            description,
            content,
            parent_id,
            is_published: is_published.unwrap_or(true),
        })
    }
}

fn optional_trimmed(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

pub fn generated_topic_slug(title: &str, fallback: &str) -> String {
    let mut slug = String::new();
    let mut separator = true;
    for character in deunicode::deunicode(title).chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
            separator = false;
        } else if !separator {
            slug.push('-');
            separator = true;
        }
    }
    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        fallback.to_owned()
    } else {
        slug.to_owned()
    }
}

pub trait AdminTopicsRepository {
    fn list(
        &self,
    ) -> impl Future<Output = Result<AdminTopicAdministration, AdminTopicsError>> + Send;

    fn create_area(
        &self,
        form: &TopicAreaForm,
        after_area_id: Option<Uuid>,
    ) -> impl Future<Output = Result<Option<AdminTopicArea>, AdminTopicsError>> + Send;

    fn update_area(
        &self,
        area_id: Uuid,
        form: &TopicAreaForm,
    ) -> impl Future<Output = Result<Option<AdminTopicArea>, AdminTopicsError>> + Send;

    fn reorder_areas(
        &self,
        area_ids: &[Uuid],
    ) -> impl Future<Output = Result<bool, AdminTopicsError>> + Send;

    fn create_topic(
        &self,
        area_id: Uuid,
        form: &TopicForm,
    ) -> impl Future<Output = Result<Option<AdminTopic>, AdminTopicsError>> + Send;

    fn update_topic(
        &self,
        area_id: Uuid,
        topic_id: Uuid,
        form: &TopicForm,
    ) -> impl Future<Output = Result<Option<AdminTopic>, AdminTopicsError>> + Send;
}

pub struct AdminTopicsQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct AdminTopicsCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminTopicsQuery<'repository, Repository>
where
    Repository: AdminTopicsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<AdminTopicAdministration>, AdminTopicsError> {
        if !principal.has_permission("content_topics", "ru") {
            return Ok(None);
        }
        self.repository.list().await.map(Some)
    }
}

impl<'repository, Repository> AdminTopicsCommand<'repository, Repository>
where
    Repository: AdminTopicsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    fn may_manage(principal: &AuthorizedPrincipal) -> bool {
        principal.has_permission("content_topics", "ru")
    }

    pub async fn create_area(
        &self,
        principal: &AuthorizedPrincipal,
        form: &TopicAreaForm,
        after_area_id: Option<Uuid>,
    ) -> Result<Option<AdminTopicArea>, AdminTopicsError> {
        if !Self::may_manage(principal) {
            return Ok(None);
        }
        self.repository.create_area(form, after_area_id).await
    }

    pub async fn update_area(
        &self,
        principal: &AuthorizedPrincipal,
        area_id: Uuid,
        form: &TopicAreaForm,
    ) -> Result<Option<AdminTopicArea>, AdminTopicsError> {
        if !Self::may_manage(principal) {
            return Ok(None);
        }
        self.repository.update_area(area_id, form).await
    }

    pub async fn reorder_areas(
        &self,
        principal: &AuthorizedPrincipal,
        area_ids: &[Uuid],
    ) -> Result<bool, AdminTopicsError> {
        if !Self::may_manage(principal) {
            return Ok(false);
        }
        self.repository.reorder_areas(area_ids).await
    }

    pub async fn create_topic(
        &self,
        principal: &AuthorizedPrincipal,
        area_id: Uuid,
        form: &TopicForm,
    ) -> Result<Option<AdminTopic>, AdminTopicsError> {
        if !Self::may_manage(principal) {
            return Ok(None);
        }
        self.repository.create_topic(area_id, form).await
    }

    pub async fn update_topic(
        &self,
        principal: &AuthorizedPrincipal,
        area_id: Uuid,
        topic_id: Uuid,
        form: &TopicForm,
    ) -> Result<Option<AdminTopic>, AdminTopicsError> {
        if !Self::may_manage(principal) {
            return Ok(None);
        }
        self.repository.update_topic(area_id, topic_id, form).await
    }
}

#[cfg(test)]
mod tests {
    use super::{TopicAreaForm, TopicForm, generated_topic_slug};

    #[test]
    fn preserves_the_source_topic_form_bounds_and_default_publication() {
        assert_eq!(
            TopicAreaForm::parse("  Science  ", Some("  ")),
            Some(TopicAreaForm {
                title: "Science".to_owned(),
                description: None,
            })
        );
        assert!(TopicAreaForm::parse("", None).is_none());
        assert!(TopicForm::parse("Topic", None, Some(&"x".repeat(50_001)), None, None).is_none());
        assert!(
            TopicForm::parse("Topic", None, None, None, None)
                .expect("valid source topic form")
                .is_published
        );
        assert_eq!(
            generated_topic_slug("Über science!", "topic"),
            "uber-science"
        );
    }
}
