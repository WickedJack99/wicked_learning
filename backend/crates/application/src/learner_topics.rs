use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerTopicDirectory,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearnerTopicDirectoryRequest {
    pub area_slug: Option<String>,
    pub page: i64,
    pub search: String,
}

impl LearnerTopicDirectoryRequest {
    pub fn parse(area_slug: Option<&str>, page: Option<i64>, search: Option<&str>) -> Option<Self> {
        let area_slug = match area_slug {
            Some(value) => Some(normalized_slug(value)?),
            None => None,
        };
        let page = page.unwrap_or(1);
        let search = search.unwrap_or_default().trim();

        (1..=10_000).contains(&page).then(|| Self {
            area_slug,
            page,
            search: search.chars().take(120).collect(),
        })
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
pub struct LearnerTopicDirectoryReadError;

pub trait LearnerTopicDirectoryRepository {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerTopicDirectoryRequest,
    ) -> impl Future<Output = Result<LearnerTopicDirectory, LearnerTopicDirectoryReadError>> + Send;
}

pub struct LearnerTopicDirectoryQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerTopicDirectoryQuery<'repository, Repository>
where
    Repository: LearnerTopicDirectoryRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        request: &LearnerTopicDirectoryRequest,
    ) -> Result<LearnerTopicDirectory, LearnerTopicDirectoryReadError> {
        self.repository.load(principal, request).await
    }
}

#[cfg(test)]
mod tests {
    use super::LearnerTopicDirectoryRequest;

    #[test]
    fn bounds_directory_input_before_persistence() {
        assert_eq!(
            LearnerTopicDirectoryRequest::parse(Some(" orientation "), Some(2), Some(" map ")),
            Some(LearnerTopicDirectoryRequest {
                area_slug: Some("orientation".to_owned()),
                page: 2,
                search: "map".to_owned(),
            }),
        );
        assert!(LearnerTopicDirectoryRequest::parse(Some("Orientation"), Some(1), None).is_none());
        assert!(LearnerTopicDirectoryRequest::parse(None, Some(0), None).is_none());
    }
}
