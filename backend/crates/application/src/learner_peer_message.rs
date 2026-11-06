use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerPeerMessageWall,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerPeerMessageError;

pub trait LearnerPeerMessageRepository {
    fn load_wall(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        page: i64,
    ) -> impl Future<Output = Result<Option<LearnerPeerMessageWall>, LearnerPeerMessageError>> + Send;
    fn contribute(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        body: &str,
    ) -> impl Future<Output = Result<Option<LearnerPeerMessageWall>, LearnerPeerMessageError>> + Send;
    fn respond(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        message_id: Uuid,
        body: &str,
        response_type: Option<&str>,
    ) -> impl Future<Output = Result<Option<LearnerPeerMessageWall>, LearnerPeerMessageError>> + Send;
    fn mark_helpful(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        message_id: Uuid,
        response_id: Uuid,
        helpful: bool,
    ) -> impl Future<Output = Result<Option<bool>, LearnerPeerMessageError>> + Send;
}

pub fn valid_body(body: &str) -> Option<&str> {
    let body = body.trim();
    (2..=280).contains(&body.chars().count()).then_some(body)
}

pub fn valid_response_type(value: Option<&str>) -> Option<Option<&str>> {
    match value {
        None => Some(None),
        Some("explanation" | "example" | "question" | "counterexample") => Some(value),
        Some(_) => None,
    }
}

pub struct PeerWallCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> PeerWallCommand<'repository, Repository>
where
    Repository: LearnerPeerMessageRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn contribute(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        body: &str,
    ) -> Result<Option<LearnerPeerMessageWall>, LearnerPeerMessageError> {
        let Some(body) = valid_body(body) else {
            return Ok(None);
        };
        self.repository
            .contribute(principal, play_run_id, activity_slug, body)
            .await
    }

    pub async fn respond(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        message_id: Uuid,
        body: &str,
        response_type: Option<&str>,
    ) -> Result<Option<LearnerPeerMessageWall>, LearnerPeerMessageError> {
        let (Some(body), Some(response_type)) =
            (valid_body(body), valid_response_type(response_type))
        else {
            return Ok(None);
        };
        self.repository
            .respond(
                principal,
                play_run_id,
                activity_slug,
                message_id,
                body,
                response_type,
            )
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::{valid_body, valid_response_type};

    #[test]
    fn preserves_source_message_and_response_bounds() {
        assert_eq!(valid_body("  useful  "), Some("useful"));
        assert_eq!(valid_body(" "), None);
        assert_eq!(valid_body(&"x".repeat(281)), None);
        assert_eq!(valid_response_type(Some("example")), Some(Some("example")));
        assert_eq!(valid_response_type(Some("reaction")), None);
    }
}
