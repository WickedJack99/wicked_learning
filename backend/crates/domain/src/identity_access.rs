use uuid::Uuid;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ApplicationCapability {
    ManageLearningGroups,
    ModerateLearnerMessages,
    ManageJournalFeedbackPolicy,
    ReviewJournalFeedback,
    ReviewPlatformFeedback,
    ViewJournalFeedback,
    ViewPlatformFeedback,
}

impl ApplicationCapability {
    pub const fn key(self) -> &'static str {
        match self {
            Self::ManageLearningGroups => "learning_groups_manage",
            Self::ModerateLearnerMessages => "learner_messages_moderate",
            Self::ManageJournalFeedbackPolicy => "journal_feedback_policy_manage",
            Self::ReviewJournalFeedback => "journal_feedback_review",
            Self::ReviewPlatformFeedback => "platform_feedback_review",
            Self::ViewJournalFeedback => "journal_feedback_view",
            Self::ViewPlatformFeedback => "platform_feedback_view",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuthorizedPrincipal {
    pub subject_id: Uuid,
    pub roles: Vec<String>,
    pub capabilities: Vec<String>,
}

impl AuthorizedPrincipal {
    pub fn has_capability(&self, capability: ApplicationCapability) -> bool {
        self.capabilities
            .iter()
            .any(|assigned| assigned == capability.key())
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::{ApplicationCapability, AuthorizedPrincipal};

    #[test]
    fn capabilities_are_checked_by_the_server_owned_key() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learning_support".to_owned()],
            capabilities: vec!["learner_messages_moderate".to_owned()],
        };

        assert!(principal.has_capability(ApplicationCapability::ModerateLearnerMessages));
    }

    #[test]
    fn an_unrelated_role_does_not_imply_a_capability() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["learner".to_owned()],
            capabilities: vec![],
        };

        assert!(!principal.has_capability(ApplicationCapability::ModerateLearnerMessages));
    }
}
