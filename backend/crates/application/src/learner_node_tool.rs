use std::future::Future;

use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerNodeToolResult,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearnerNodeToolTarget {
    pub map_slug: String,
    pub node_slug: String,
    pub tool_slug: String,
}

impl LearnerNodeToolTarget {
    pub fn parse(map_slug: &str, node_slug: &str, tool_slug: &str) -> Option<Self> {
        Some(Self {
            map_slug: normalized_slug(map_slug)?,
            node_slug: normalized_slug(node_slug)?,
            tool_slug: normalized_slug(tool_slug)?,
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
pub struct LearnerNodeToolError;

/// A repository must authorize both the map node and ownership of the tool in
/// one server-owned operation. An absent result intentionally conflates an
/// inaccessible node with a tool that is not in the caller's belt.
pub trait LearnerNodeToolRepository {
    fn use_tool(
        &self,
        principal: &AuthorizedPrincipal,
        target: &LearnerNodeToolTarget,
    ) -> impl Future<Output = Result<Option<LearnerNodeToolResult>, LearnerNodeToolError>> + Send;
}

pub struct LearnerNodeToolCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerNodeToolCommand<'repository, Repository>
where
    Repository: LearnerNodeToolRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn use_tool(
        &self,
        principal: &AuthorizedPrincipal,
        target: &LearnerNodeToolTarget,
    ) -> Result<Option<LearnerNodeToolResult>, LearnerNodeToolError> {
        self.repository.use_tool(principal, target).await
    }
}

#[cfg(test)]
mod tests {
    use super::LearnerNodeToolTarget;

    #[test]
    fn accepts_only_bounded_public_tool_references() {
        assert_eq!(
            LearnerNodeToolTarget::parse(" first-map ", "hidden-place", "magnifier"),
            Some(LearnerNodeToolTarget {
                map_slug: "first-map".to_owned(),
                node_slug: "hidden-place".to_owned(),
                tool_slug: "magnifier".to_owned(),
            })
        );
        assert!(LearnerNodeToolTarget::parse("first-map", "hidden-place", "Magnifier").is_none());
        assert!(
            LearnerNodeToolTarget::parse("first-map", "hidden-place", &"a".repeat(81)).is_none()
        );
    }
}
