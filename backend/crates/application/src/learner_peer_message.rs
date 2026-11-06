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
