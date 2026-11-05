use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerQuestionAnswerResult,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerQuestionAnswerError;

/// The answer command deliberately identifies the active question by the
/// server-owned run and activity slug. A client never addresses an authored
/// option, activity, or transition outside that authorized run.
pub trait LearnerQuestionRepository {
    fn answer_current_question(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        option_keys: &[String],
        confidence: Option<&str>,
    ) -> impl Future<
        Output = Result<Option<LearnerQuestionAnswerResult>, LearnerQuestionAnswerError>,
    > + Send;
}

pub struct LearnerQuestionAnswerCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> LearnerQuestionAnswerCommand<'repository, Repository>
where
    Repository: LearnerQuestionRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        play_run_id: Uuid,
        activity_slug: &str,
        option_keys: &[String],
        confidence: Option<&str>,
    ) -> Result<Option<LearnerQuestionAnswerResult>, LearnerQuestionAnswerError> {
        self.repository
            .answer_current_question(
                principal,
                play_run_id,
                activity_slug,
                option_keys,
                confidence,
            )
            .await
    }
}
