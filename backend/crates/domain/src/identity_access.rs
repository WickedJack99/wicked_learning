use serde::Serialize;
use uuid::Uuid;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ApplicationCapability {
    ViewRoles,
    ViewUsers,
    ManageAccessLinks,
    ManageLearningGroups,
    ModerateLearnerMessages,
    ModerateOrganizationIcons,
    ManageJournalFeedbackPolicy,
    ReviewJournalFeedback,
    ReviewPlatformFeedback,
    ViewJournalFeedback,
    ViewPlatformFeedback,
}

impl ApplicationCapability {
    pub const fn key(self) -> &'static str {
        match self {
            Self::ViewRoles => "roles_view",
            Self::ViewUsers => "users_view",
            Self::ManageAccessLinks => "access_links_manage",
            Self::ManageLearningGroups => "learning_groups_manage",
            Self::ModerateLearnerMessages => "learner_messages_moderate",
            Self::ModerateOrganizationIcons => "organization_icons_moderate",
            Self::ManageJournalFeedbackPolicy => "journal_feedback_policy_manage",
            Self::ReviewJournalFeedback => "journal_feedback_review",
            Self::ReviewPlatformFeedback => "platform_feedback_review",
            Self::ViewJournalFeedback => "journal_feedback_view",
            Self::ViewPlatformFeedback => "platform_feedback_view",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AdminRole {
    pub capabilities: Vec<String>,
    pub description: Option<String>,
    pub is_system: bool,
    pub level: i32,
    pub name: String,
    pub role_key: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AdminRoles {
    pub roles: Vec<AdminRole>,
}

/// An administrator-only projection that combines the identity-owned profile
/// with application-owned role assignments. It intentionally excludes
/// password credentials, sessions, invitation plaintext and learner data.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AdminUser {
    pub created_at: String,
    pub email: String,
    pub identity_status: String,
    pub name: String,
    pub roles: Vec<String>,
    pub subject_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AdminUsers {
    pub registration_tokens: Vec<AdminRegistrationToken>,
    pub users: Vec<AdminUser>,
}

/// A bounded invitation audit summary. The token hash and its one-time
/// plaintext counterpart never leave the identity database.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AdminRegistrationToken {
    pub created_at: String,
    pub created_by: Option<AdminUserReference>,
    pub expires_at: Option<String>,
    pub id: String,
    pub is_expired: bool,
    pub is_used: bool,
    pub note: Option<String>,
    pub roles: Vec<String>,
    pub used_at: Option<String>,
    pub used_by: Option<AdminUserReference>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AdminUserReference {
    pub email: String,
    pub name: String,
    pub subject_id: String,
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
