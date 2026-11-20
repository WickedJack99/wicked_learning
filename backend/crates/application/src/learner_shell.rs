use std::future::Future;
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learner_shell::{LearnerMenuTheme, LearnerShell},
};

#[derive(Clone, Copy, Debug)]
pub struct LearnerShellError;

pub trait LearnerShellRepository {
    fn load(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> impl Future<Output = Result<Option<LearnerShell>, LearnerShellError>> + Send;
    fn remember_map(
        &self,
        principal: &AuthorizedPrincipal,
        reference: &str,
    ) -> impl Future<Output = Result<Option<LearnerMenuTheme>, LearnerShellError>> + Send;
}

pub struct LearnerShellQuery<'a, R> {
    repository: &'a R,
}
impl<'a, R: LearnerShellRepository> LearnerShellQuery<'a, R> {
    pub fn new(repository: &'a R) -> Self {
        Self { repository }
    }
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<LearnerShell>, LearnerShellError> {
        self.repository.load(principal).await
    }
}

pub struct RememberLearnerMap<'a, R> {
    repository: &'a R,
}
impl<'a, R: LearnerShellRepository> RememberLearnerMap<'a, R> {
    pub fn new(repository: &'a R) -> Self {
        Self { repository }
    }
    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
        reference: &str,
    ) -> Result<Option<LearnerMenuTheme>, LearnerShellError> {
        if !valid_map_reference(reference) {
            return Ok(None);
        }
        self.repository.remember_map(principal, reference).await
    }
}

pub fn valid_map_reference(reference: &str) -> bool {
    !reference.is_empty()
        && reference.len() <= 140
        && reference
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

#[cfg(test)]
mod tests {
    use super::valid_map_reference;
    #[test]
    fn location_reference_is_bounded_and_not_a_url_or_arbitrary_query() {
        for valid in ["orientation-map", "018f1f8c-4c2f-7b8a-9d0e-000000000001"] {
            assert!(valid_map_reference(valid));
        }
        for invalid in [
            "",
            "../private",
            "map?role=admin",
            "https://other.test",
            &"a".repeat(141),
        ] {
            assert!(!valid_map_reference(invalid));
        }
    }
}
