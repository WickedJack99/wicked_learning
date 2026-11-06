use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerGroup, LearnerGroupPage},
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerGroupError;

/// The adapter may query identity display data only after its application
/// query has proved that the caller belongs to the requested group.
pub trait LearnerGroupRepository {
    fn list(
        &self,
        principal: &AuthorizedPrincipal,
        page: i64,
        per_page: i64,
    ) -> impl Future<Output = Result<LearnerGroupPage, LearnerGroupError>> + Send;

    fn send_message(
        &self,
        principal: &AuthorizedPrincipal,
        group_id: Uuid,
        body: &str,
        is_help_request: bool,
    ) -> impl Future<Output = Result<Option<LearnerGroup>, LearnerGroupError>> + Send;

    fn resolve_help_request(
        &self,
        principal: &AuthorizedPrincipal,
        group_id: Uuid,
        message_id: Uuid,
    ) -> impl Future<Output = Result<Option<LearnerGroup>, LearnerGroupError>> + Send;

    fn vote_for_admin_chat_access(
        &self,
        principal: &AuthorizedPrincipal,
        group_id: Uuid,
    ) -> impl Future<Output = Result<Option<LearnerGroup>, LearnerGroupError>> + Send;
}

pub struct LearnerGroupsQuery<'repository, Repository> {
    repository: &'repository Repository,
}

pub struct LearnerGroupCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerGroupsQuery<'repository, Repository>
where
    Repository: LearnerGroupRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        page: i64,
        per_page: i64,
    ) -> Result<LearnerGroupPage, LearnerGroupError> {
        self.repository
            .list(principal, page.clamp(1, 10_000), per_page.clamp(1, 12))
            .await
    }
}

impl<'repository, Repository> LearnerGroupCommand<'repository, Repository>
where
    Repository: LearnerGroupRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn send_message(
        &self,
        principal: &AuthorizedPrincipal,
        group_id: Uuid,
        body: &str,
        is_help_request: bool,
    ) -> Result<Option<LearnerGroup>, LearnerGroupError> {
        let Some(body) = valid_message_body(body) else {
            return Ok(None);
        };
        self.repository
            .send_message(principal, group_id, body, is_help_request)
            .await
    }

    pub async fn resolve_help_request(
        &self,
        principal: &AuthorizedPrincipal,
        group_id: Uuid,
        message_id: Uuid,
    ) -> Result<Option<LearnerGroup>, LearnerGroupError> {
        self.repository
            .resolve_help_request(principal, group_id, message_id)
            .await
    }

    pub async fn vote_for_admin_chat_access(
        &self,
        principal: &AuthorizedPrincipal,
        group_id: Uuid,
    ) -> Result<Option<LearnerGroup>, LearnerGroupError> {
        self.repository
            .vote_for_admin_chat_access(principal, group_id)
            .await
    }
}

pub fn valid_message_body(body: &str) -> Option<&str> {
    let body = body.trim();
    (!body.is_empty() && body.chars().count() <= 4_000).then_some(body)
}

#[cfg(test)]
mod tests {
    use super::valid_message_body;

    #[test]
    fn preserves_the_source_group_message_bounds() {
        assert_eq!(
            valid_message_body("  A question for the group.  "),
            Some("A question for the group.")
        );
        assert_eq!(valid_message_body(" \n\t "), None);
        assert_eq!(valid_message_body(&"x".repeat(4_001)), None);
    }
}
