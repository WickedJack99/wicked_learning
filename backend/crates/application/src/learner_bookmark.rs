use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerBookmarkResult,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearnerBookmarkTarget {
    pub map_slug: String,
    pub node_slug: String,
}

impl LearnerBookmarkTarget {
    pub fn parse(map_slug: &str, node_slug: &str) -> Option<Self> {
        let map_slug = normalized_slug(map_slug)?;
        let node_slug = normalized_slug(node_slug)?;

        Some(Self {
            map_slug,
            node_slug,
        })
    }
}

fn normalized_slug(value: &str) -> Option<String> {
    let value = value.trim();
    let is_valid = !value.is_empty()
        && value.len() <= 80
        && value.bytes().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == b'-'
        });
    is_valid.then(|| value.to_owned())
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerBookmarkError;

/// Persistence owns the visibility predicate as well as the ownership-scoped
/// insert/delete. An absent result intentionally conflates an unknown node and
/// a node the principal must not discover.
pub trait LearnerBookmarkRepository {
    fn bookmark(
        &self,
        principal: &AuthorizedPrincipal,
        target: &LearnerBookmarkTarget,
    ) -> impl Future<Output = Result<Option<LearnerBookmarkResult>, LearnerBookmarkError>> + Send;

    fn unbookmark(
        &self,
        principal: &AuthorizedPrincipal,
        target: &LearnerBookmarkTarget,
    ) -> impl Future<Output = Result<Option<LearnerBookmarkResult>, LearnerBookmarkError>> + Send;
}

pub struct LearnerBookmarkCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerBookmarkCommand<'repository, Repository>
where
    Repository: LearnerBookmarkRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn bookmark(
        &self,
        principal: &AuthorizedPrincipal,
        target: &LearnerBookmarkTarget,
    ) -> Result<Option<LearnerBookmarkResult>, LearnerBookmarkError> {
        self.repository.bookmark(principal, target).await
    }

    pub async fn unbookmark(
        &self,
        principal: &AuthorizedPrincipal,
        target: &LearnerBookmarkTarget,
    ) -> Result<Option<LearnerBookmarkResult>, LearnerBookmarkError> {
        self.repository.unbookmark(principal, target).await
    }
}

#[cfg(test)]
mod tests {
    use super::LearnerBookmarkTarget;

    #[test]
    fn accepts_only_bounded_lowercase_map_and_node_slugs() {
        assert_eq!(
            LearnerBookmarkTarget::parse(" first-path ", "private-place"),
            Some(LearnerBookmarkTarget {
                map_slug: "first-path".to_owned(),
                node_slug: "private-place".to_owned(),
            }),
        );
        assert!(LearnerBookmarkTarget::parse("First-path", "private-place").is_none());
        assert!(LearnerBookmarkTarget::parse("first-path", &"a".repeat(81)).is_none());
    }
}
