use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerTopicMaps, LearnerTopicOverview, LearnerTopicTrail},
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearnerTopicDetailRequest {
    pub page: i64,
    pub topic_slug: String,
}

impl LearnerTopicDetailRequest {
    pub fn parse(topic_slug: &str, page: Option<i64>) -> Option<Self> {
        let topic_slug = normalized_slug(topic_slug)?;
        let page = page.unwrap_or(1);

        (1..=10_000)
            .contains(&page)
            .then_some(Self { page, topic_slug })
    }
}

fn normalized_slug(value: &str) -> Option<String> {
    let value = value.trim();

    (!value.is_empty()
        && value.len() <= 80
        && value.bytes().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == b'-'
        }))
    .then(|| value.to_owned())
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerTopicDetailReadError;

pub trait LearnerTopicDetailRepository {
    fn load_trail(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerTopicDetailRequest,
    ) -> impl Future<Output = Result<Option<LearnerTopicTrail>, LearnerTopicDetailReadError>> + Send;

    fn load_maps(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerTopicDetailRequest,
    ) -> impl Future<Output = Result<Option<LearnerTopicMaps>, LearnerTopicDetailReadError>> + Send;

    fn load_overview(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerTopicDetailRequest,
    ) -> impl Future<Output = Result<Option<LearnerTopicOverview>, LearnerTopicDetailReadError>> + Send;
}

pub struct LearnerTopicDetailQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerTopicDetailQuery<'repository, Repository>
where
    Repository: LearnerTopicDetailRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn maps(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerTopicDetailRequest,
    ) -> Result<Option<LearnerTopicMaps>, LearnerTopicDetailReadError> {
        self.repository.load_maps(principal, request).await
    }

    pub async fn trail(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerTopicDetailRequest,
    ) -> Result<Option<LearnerTopicTrail>, LearnerTopicDetailReadError> {
        self.repository.load_trail(principal, request).await
    }

    pub async fn overview(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerTopicDetailRequest,
    ) -> Result<Option<LearnerTopicOverview>, LearnerTopicDetailReadError> {
        self.repository.load_overview(principal, request).await
    }
}

#[cfg(test)]
mod tests {
    use super::LearnerTopicDetailRequest;

    #[test]
    fn bounds_source_detail_slugs_and_pages_before_persistence() {
        assert_eq!(
            LearnerTopicDetailRequest::parse(" map-orientation ", Some(4)),
            Some(LearnerTopicDetailRequest {
                page: 4,
                topic_slug: "map-orientation".to_owned(),
            }),
        );
        assert!(LearnerTopicDetailRequest::parse("Map-orientation", Some(1)).is_none());
        assert!(LearnerTopicDetailRequest::parse("map-orientation", Some(0)).is_none());
    }
}
