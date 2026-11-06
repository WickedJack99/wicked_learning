use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerNpcDialogueState,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerNpcDialogueError;

/// All dialogue navigation is scoped to an active server-owned route or
/// historical-replay run. The sole input accepted for a question is the
/// public ID of an authored outgoing answer; neither a next node nor a tool
/// is browser authority.
pub trait LearnerNpcDialogueRepository {
    fn continue_current_dialogue(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl Future<Output = Result<Option<LearnerNpcDialogueState>, LearnerNpcDialogueError>> + Send;

    fn answer_current_dialogue(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        answer_node_id: Uuid,
    ) -> impl Future<Output = Result<Option<LearnerNpcDialogueState>, LearnerNpcDialogueError>> + Send;

    fn go_back_in_current_dialogue(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> impl Future<Output = Result<Option<LearnerNpcDialogueState>, LearnerNpcDialogueError>> + Send;

    fn save_current_dialogue_reflection(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        reflection: &str,
    ) -> impl Future<Output = Result<Option<LearnerNpcDialogueState>, LearnerNpcDialogueError>> + Send;
}

pub struct LearnerNpcDialogueCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerNpcDialogueCommand<'repository, Repository>
where
    Repository: LearnerNpcDialogueRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn continue_dialogue(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> Result<Option<LearnerNpcDialogueState>, LearnerNpcDialogueError> {
        self.repository
            .continue_current_dialogue(principal, play_run_id, activity_slug)
            .await
    }

    pub async fn answer(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        answer_node_id: Uuid,
    ) -> Result<Option<LearnerNpcDialogueState>, LearnerNpcDialogueError> {
        self.repository
            .answer_current_dialogue(principal, play_run_id, activity_slug, answer_node_id)
            .await
    }

    pub async fn go_back(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
    ) -> Result<Option<LearnerNpcDialogueState>, LearnerNpcDialogueError> {
        self.repository
            .go_back_in_current_dialogue(principal, play_run_id, activity_slug)
            .await
    }

    pub async fn save_reflection(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        reflection: &str,
    ) -> Result<Option<LearnerNpcDialogueState>, LearnerNpcDialogueError> {
        self.repository
            .save_current_dialogue_reflection(principal, play_run_id, activity_slug, reflection)
            .await
    }
}
