use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal, learner_state::LearnerJournalPage,
};

pub const MAX_DOMAIN_KEY_CHARACTERS: usize = 160;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LearnerJournalFeedbackError;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RequestJournalFeedbackResult {
    AlreadyResponded,
    Disabled,
    InvalidDomain,
    NotFound,
    Requested,
}

/// The adapter derives a group destination from the authenticated learner's
/// membership. The browser supplies only the source-style destination key.
pub trait LearnerJournalFeedbackRepository {
    fn request(
        &self,
        principal: &AuthorizedPrincipal,
        page_id: Uuid,
        domain_key: &str,
    ) -> impl Future<
        Output = Result<
            (RequestJournalFeedbackResult, Option<LearnerJournalPage>),
            LearnerJournalFeedbackError,
        >,
    > + Send;
}

pub struct RequestLearnerJournalFeedback<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> RequestLearnerJournalFeedback<'repository, Repository>
where
    Repository: LearnerJournalFeedbackRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        page_id: Uuid,
        domain_key: &str,
    ) -> Result<
        (RequestJournalFeedbackResult, Option<LearnerJournalPage>),
        LearnerJournalFeedbackError,
    > {
        let domain_key = domain_key.trim();
        if domain_key.is_empty() || domain_key.chars().count() > MAX_DOMAIN_KEY_CHARACTERS {
            return Ok((RequestJournalFeedbackResult::InvalidDomain, None));
        }
        self.repository
            .request(principal, page_id, domain_key)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::{
        MAX_DOMAIN_KEY_CHARACTERS, RequestJournalFeedbackResult, RequestLearnerJournalFeedback,
    };
    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    struct Repository;

    impl super::LearnerJournalFeedbackRepository for Repository {
        fn request(
            &self,
            _: &AuthorizedPrincipal,
            _: Uuid,
            _: &str,
        ) -> impl std::future::Future<
            Output = Result<
                (
                    RequestJournalFeedbackResult,
                    Option<wicked_learning_domain::learner_state::LearnerJournalPage>,
                ),
                super::LearnerJournalFeedbackError,
            >,
        > + Send {
            async { panic!("invalid request must not reach the repository") }
        }
    }

    #[tokio::test]
    async fn bounds_the_untrusted_source_style_domain_key_before_sql() {
        let repository = Repository;
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec![],
        };
        assert_eq!(
            RequestLearnerJournalFeedback::new(&repository)
                .execute(
                    &principal,
                    Uuid::new_v4(),
                    &"x".repeat(MAX_DOMAIN_KEY_CHARACTERS + 1)
                )
                .await
                .unwrap()
                .0,
            RequestJournalFeedbackResult::InvalidDomain,
        );
    }
}
