use std::future::Future;

use wicked_learning_domain::{identity_access::AuthorizedPrincipal, learner_state::LearnerPaths};

pub const LEARNING_INTENTS: [&str; 7] = [
    "apply",
    "explain",
    "participate",
    "reflect",
    "retrieve",
    "review",
    "transfer",
];

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearnerPathsRequest {
    pub page: i64,
    pub purpose: Option<String>,
    pub time_budget: Option<i16>,
    pub topic_slug: Option<String>,
}

impl LearnerPathsRequest {
    pub fn source_normalized(
        page: Option<i64>,
        purpose: Option<&str>,
        time_budget: Option<i16>,
        topic_slug: Option<&str>,
    ) -> Self {
        Self {
            page: page.unwrap_or(1).max(1),
            purpose: purpose
                .map(str::trim)
                .filter(|value| LEARNING_INTENTS.contains(value))
                .map(str::to_owned),
            time_budget: time_budget.filter(|value| matches!(value, 15 | 30)),
            topic_slug: topic_slug.and_then(normalized_slug),
        }
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
pub struct LearnerPathsReadError;

pub trait LearnerPathsRepository {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerPathsRequest,
    ) -> impl Future<Output = Result<LearnerPaths, LearnerPathsReadError>> + Send;
}

pub struct LearnerPathsQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerPathsQuery<'repository, Repository>
where
    Repository: LearnerPathsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerPathsRequest,
    ) -> Result<LearnerPaths, LearnerPathsReadError> {
        self.repository.load(principal, request).await
    }
}

#[cfg(test)]
mod tests {
    use super::LearnerPathsRequest;

    #[test]
    fn normalizes_the_source_paths_filters_without_turning_unknown_filters_into_errors() {
        assert_eq!(
            LearnerPathsRequest::source_normalized(
                Some(0),
                Some(" retrieve "),
                Some(15),
                Some(" map-orientation "),
            ),
            LearnerPathsRequest {
                page: 1,
                purpose: Some("retrieve".to_owned()),
                time_budget: Some(15),
                topic_slug: Some("map-orientation".to_owned()),
            },
        );
        let request = LearnerPathsRequest::source_normalized(
            Some(2),
            Some("unknown"),
            Some(20),
            Some("Not-a-slug"),
        );
        assert_eq!(request.page, 2);
        assert_eq!(request.purpose, None);
        assert_eq!(request.time_budget, None);
        assert_eq!(request.topic_slug, None);
    }
}
