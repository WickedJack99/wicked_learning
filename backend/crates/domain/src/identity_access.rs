use std::collections::BTreeMap;

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
    pub permission_scopes: BTreeMap<String, String>,
    pub permissions: BTreeMap<String, String>,
    pub role_key: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AdminRoles {
    pub permission_resources: Vec<AdminPermissionResource>,
    pub roles: Vec<AdminRole>,
}

/// A source-defined administrative area. These definitions deliberately live
/// in the domain boundary rather than being browser-owned labels: a role can
/// only hold permissions for an explicitly known resource.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AdminPermissionResource {
    pub description: String,
    pub group: String,
    pub key: String,
    pub label: String,
}

pub fn permission_resources() -> Vec<AdminPermissionResource> {
    [
        ("users", "User management", "Registration tokens, user roles, bans and account deletion.", "Administration"),
        ("roles", "Role management", "Create roles and decide which administrative areas they can access.", "Administration"),
        ("groups", "Groups", "Create and edit learning groups.", "Groups"),
        ("group_members", "Group members", "Add users to groups and manage group membership.", "Groups"),
        ("group_topics", "Group topics", "Define the study topic or project focus for groups.", "Groups"),
        ("world_maps", "World maps", "Create, edit and delete maps.", "World builder"),
        ("world_nodes", "World nodes", "Create, edit and delete map tiles and node unlocks.", "World builder"),
        ("world_activities", "World activities", "Author activities, routes, dialogues and transitions.", "World builder"),
        ("world_map_access", "Map access", "Choose who can view or edit a map.", "World builder"),
        ("assets", "Assets", "Tools, media, reusable images, items and future currencies.", "Assets"),
        ("media_paths", "Media paths", "View raw image and media paths in upload controls.", "Assets"),
        ("sounds", "Sounds", "Reusable music, sound effects, ambience and voice clips.", "Assets"),
        ("presentation", "Presentation", "Welcome pages, public information pages, login visuals and cursors.", "Presentation"),
        ("languages", "Languages", "Available learner languages and the import/export of translated catalogs.", "Presentation"),
        ("journal_settings", "Journal settings", "Configure learner journals and whether learners may request expert feedback.", "Learning support"),
        ("journal_feedback", "Journal feedback", "Review learner feedback requests and send informational feedback.", "Learning support"),
        ("competence_topics", "Competence topics", "Define learner competence topics and star-map thresholds.", "Learning support"),
        ("learning_concepts", "Learning concepts", "Maintain reusable authoring vocabulary for learning evidence.", "Learning support"),
        ("learner_support_signals", "Support signals", "View scoped learner competence signals for timely support without rankings.", "Learning support"),
        ("learner_messages", "Learner messages", "Review, hide and delete messages shared through MapAsset activities.", "Learning support"),
        ("platform_feedback", "Platform feedback", "Review feedback deliberately shared about the platform experience.", "Learning support"),
        ("organization_moderation", "Organization moderation", "Review reported organization icons and platform organization limits.", "Learning support"),
        ("ai", "AI support", "Provider credentials, agent templates and usage guardrails.", "AI"),
        ("companion", "Learning companion", "Configure the scripted learner companion and its orientation message.", "Learning support"),
        ("content_api", "Content API", "Read the authoring contract and create learning content through the administration API.", "API"),
        ("content_topics", "Topics", "Create and arrange learner-facing topic areas, topics and subtopics.", "Content"),
    ]
    .into_iter()
    .map(|(key, label, description, group)| AdminPermissionResource {
        description: description.to_owned(),
        group: group.to_owned(),
        key: key.to_owned(),
        label: label.to_owned(),
    })
    .collect()
}

/// An administrator-only projection that combines the identity-owned profile
/// with application-owned role assignments. It intentionally excludes
/// password credentials, sessions, invitation plaintext and learner data.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AdminUser {
    pub access_history: Vec<AdminAccessChangeEvent>,
    pub banned_until: Option<String>,
    pub created_at: String,
    pub email: String,
    pub identity_status: String,
    pub is_currently_banned: bool,
    pub is_login_disabled: bool,
    pub login_disabled_at: Option<String>,
    pub name: String,
    pub roles: Vec<String>,
    pub subject_id: String,
}

/// A safe, administrator-facing projection of an access-related change. The
/// database records only immutable subject identifiers; the profile reference
/// is resolved when the administration view is read.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AdminAccessChangeEvent {
    pub action: String,
    pub actor: Option<AdminUserReference>,
    pub changes: Vec<AdminAccessChangeItem>,
    pub created_at: String,
    pub id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AdminAccessChangeItem {
    pub after: String,
    pub before: String,
    pub label: String,
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

    /// Evaluates the source's ordered role levels. Permission grants are
    /// internal principal facts rather than public browser capabilities; the
    /// persistence adapter encodes them alongside existing capabilities so the
    /// principal shape can evolve without widening the `/me` response.
    pub fn has_permission(&self, resource: &str, required_level: &str) -> bool {
        let required_weight = permission_level_weight(required_level);
        if required_weight == 0 {
            return true;
        }

        self.capabilities.iter().any(|grant| {
            let Some((granted_resource, granted_level, _scope)) = grant
                .strip_prefix("role_permission:")
                .and_then(|value| value.split_once(':'))
                .and_then(|(resource, value)| {
                    value
                        .split_once(':')
                        .map(|(level, scope)| (resource, level, scope))
                })
            else {
                return false;
            };
            granted_resource == resource
                && permission_level_weight(granted_level) >= required_weight
        })
    }
}

fn permission_level_weight(level: &str) -> u8 {
    match level {
        "ro" => 10,
        "ru" => 20,
        "rud" => 30,
        _ => 0,
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

    #[test]
    fn permission_levels_follow_the_source_order_without_becoming_public_capabilities() {
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec!["editor".to_owned()],
            capabilities: vec!["role_permission:roles:ru:all".to_owned()],
        };

        assert!(principal.has_permission("roles", "ro"));
        assert!(principal.has_permission("roles", "ru"));
        assert!(!principal.has_permission("roles", "rud"));
        assert!(!principal.has_permission("users", "ro"));
    }
}
