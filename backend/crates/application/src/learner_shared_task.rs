use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_state::{LearnerSharedTaskChecklist, LearnerSharedTaskState},
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerSharedTaskError;

/// Source-defined response labels orient peer feedback without judging its
/// quality. The browser may choose one only from this bounded vocabulary.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SharedTaskResponseType {
    Explanation,
    Example,
    Question,
    Counterexample,
}

impl SharedTaskResponseType {
    pub fn parse(value: Option<&str>) -> Option<Option<Self>> {
        match value {
            None => Some(None),
            Some("explanation") => Some(Some(Self::Explanation)),
            Some("example") => Some(Some(Self::Example)),
            Some("question") => Some(Some(Self::Question)),
            Some("counterexample") => Some(Some(Self::Counterexample)),
            Some(_) => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Explanation => "explanation",
            Self::Example => "example",
            Self::Question => "question",
            Self::Counterexample => "counterexample",
        }
    }
}

pub trait LearnerSharedTaskRepository {
    fn submit_contribution(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        body: &str,
        share_with_peers: bool,
        project_step_index: Option<i16>,
    ) -> impl Future<Output = Result<Option<LearnerSharedTaskState>, LearnerSharedTaskError>> + Send;

    fn revise_contribution(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        submission_id: Uuid,
        body: &str,
    ) -> impl Future<Output = Result<Option<LearnerSharedTaskState>, LearnerSharedTaskError>> + Send;

    fn submit_review(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        submission_id: Uuid,
        body: &str,
        response_type: Option<SharedTaskResponseType>,
        project_step_index: Option<i16>,
    ) -> impl Future<Output = Result<Option<LearnerSharedTaskState>, LearnerSharedTaskError>> + Send;

    fn mark_review_helpful(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        review_id: Uuid,
        helpful: bool,
    ) -> impl Future<Output = Result<Option<LearnerSharedTaskState>, LearnerSharedTaskError>> + Send;

    fn save_review_follow_up(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        review_id: Uuid,
        body: Option<&str>,
    ) -> impl Future<Output = Result<Option<LearnerSharedTaskState>, LearnerSharedTaskError>> + Send;

    fn save_checklist(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        completed_step_indexes: &[i16],
    ) -> impl Future<Output = Result<Option<LearnerSharedTaskChecklist>, LearnerSharedTaskError>> + Send;
}

pub struct LearnerSharedTaskCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerSharedTaskCommand<'repository, Repository>
where
    Repository: LearnerSharedTaskRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn submit_contribution(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        body: &str,
        share_with_peers: bool,
        project_step_index: Option<i16>,
    ) -> Result<Option<LearnerSharedTaskState>, LearnerSharedTaskError> {
        let (Some(body), Some(project_step_index)) = (
            valid_contribution(body),
            valid_project_step(project_step_index),
        ) else {
            return Ok(None);
        };
        self.repository
            .submit_contribution(
                principal,
                play_run_id,
                activity_slug,
                body,
                share_with_peers,
                project_step_index,
            )
            .await
    }

    pub async fn revise_contribution(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        submission_id: Uuid,
        body: &str,
    ) -> Result<Option<LearnerSharedTaskState>, LearnerSharedTaskError> {
        let Some(body) = valid_contribution(body) else {
            return Ok(None);
        };
        self.repository
            .revise_contribution(principal, play_run_id, activity_slug, submission_id, body)
            .await
    }

    pub async fn submit_review(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        submission_id: Uuid,
        body: &str,
        response_type: Option<&str>,
        project_step_index: Option<i16>,
    ) -> Result<Option<LearnerSharedTaskState>, LearnerSharedTaskError> {
        let (Some(body), Some(response_type), Some(project_step_index)) = (
            valid_review(body),
            SharedTaskResponseType::parse(response_type),
            valid_project_step(project_step_index),
        ) else {
            return Ok(None);
        };
        self.repository
            .submit_review(
                principal,
                play_run_id,
                activity_slug,
                submission_id,
                body,
                response_type,
                project_step_index,
            )
            .await
    }

    pub async fn mark_review_helpful(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        review_id: Uuid,
        helpful: bool,
    ) -> Result<Option<LearnerSharedTaskState>, LearnerSharedTaskError> {
        self.repository
            .mark_review_helpful(principal, play_run_id, activity_slug, review_id, helpful)
            .await
    }

    pub async fn save_review_follow_up(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        review_id: Uuid,
        body: Option<&str>,
    ) -> Result<Option<LearnerSharedTaskState>, LearnerSharedTaskError> {
        let Some(body) = valid_follow_up(body) else {
            return Ok(None);
        };
        self.repository
            .save_review_follow_up(principal, play_run_id, activity_slug, review_id, body)
            .await
    }

    pub async fn save_checklist(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        completed_step_indexes: &[i16],
    ) -> Result<Option<LearnerSharedTaskChecklist>, LearnerSharedTaskError> {
        if !valid_checklist(completed_step_indexes) {
            return Ok(None);
        }
        self.repository
            .save_checklist(
                principal,
                play_run_id,
                activity_slug,
                completed_step_indexes,
            )
            .await
    }
}

pub fn valid_contribution(body: &str) -> Option<&str> {
    let body = body.trim();
    (!body.is_empty() && body.chars().count() <= 20_000).then_some(body)
}

pub fn valid_review(body: &str) -> Option<&str> {
    let body = body.trim();
    (body.chars().count() >= 10 && body.chars().count() <= 2_000).then_some(body)
}

pub fn valid_follow_up(body: Option<&str>) -> Option<Option<&str>> {
    match body {
        None => Some(None),
        Some(body) => {
            let body = body.trim();
            (body.chars().count() <= 2_000).then_some((!body.is_empty()).then_some(body))
        }
    }
}

pub fn valid_project_step(value: Option<i16>) -> Option<Option<i16>> {
    match value {
        None => Some(None),
        Some(index) if (0..=5).contains(&index) => Some(Some(index)),
        Some(_) => None,
    }
}

pub fn valid_checklist(indexes: &[i16]) -> bool {
    indexes.len() <= 6
        && indexes.iter().all(|index| (0..=5).contains(index))
        && indexes.windows(2).all(|pair| pair[0] < pair[1])
}

#[cfg(test)]
mod tests {
    use super::{
        SharedTaskResponseType, valid_checklist, valid_contribution, valid_follow_up,
        valid_project_step, valid_review,
    };

    #[test]
    fn keeps_shared_task_inputs_bounded_and_source_shaped() {
        assert_eq!(
            valid_contribution("  a useful contribution  "),
            Some("a useful contribution")
        );
        assert_eq!(valid_contribution(" "), None);
        assert_eq!(valid_contribution(&"x".repeat(20_001)), None);
        assert_eq!(valid_review("short"), None);
        assert_eq!(
            valid_review("a useful peer response"),
            Some("a useful peer response")
        );
        assert_eq!(
            valid_follow_up(Some("  private note  ")),
            Some(Some("private note"))
        );
        assert_eq!(valid_follow_up(Some(&"x".repeat(2_001))), None);
        assert_eq!(valid_project_step(Some(5)), Some(Some(5)));
        assert_eq!(valid_project_step(Some(6)), None);
        assert!(valid_checklist(&[0, 2, 5]));
        assert!(!valid_checklist(&[2, 2]));
        assert_eq!(
            SharedTaskResponseType::parse(Some("counterexample")),
            Some(Some(SharedTaskResponseType::Counterexample)),
        );
        assert_eq!(SharedTaskResponseType::parse(Some("reaction")), None);
    }
}
