use std::future::Future;

use wicked_learning_domain::identity_access::{ApplicationCapability, AuthorizedPrincipal};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminSettingsNotificationOrganization {
    pub has_icon: bool,
    pub icon_report_id: String,
    pub name: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminSettingsNotifications {
    pub pending_feedback_requests: i64,
    pub pending_organization_icon_reports: i64,
    pub reported_organizations: Vec<AdminSettingsNotificationOrganization>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AdminSettingsNotificationsReadError;

/// This intentionally small Settings-chrome projection preserves the source
/// bell without turning it into another journal or moderation read surface.
pub trait AdminSettingsNotificationsRepository {
    fn load(
        &self,
        include_feedback_requests: bool,
        include_organization_icon_reports: bool,
    ) -> impl Future<
        Output = Result<AdminSettingsNotifications, AdminSettingsNotificationsReadError>,
    > + Send;
}

pub struct AdminSettingsNotificationsQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminSettingsNotificationsQuery<'repository, Repository>
where
    Repository: AdminSettingsNotificationsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<AdminSettingsNotifications, AdminSettingsNotificationsReadError> {
        self.repository
            .load(
                principal.has_capability(ApplicationCapability::ViewJournalFeedback),
                principal.has_capability(ApplicationCapability::ModerateOrganizationIcons),
            )
            .await
    }
}

#[cfg(test)]
mod tests {
    use std::future::Future;

    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{
        AdminSettingsNotificationOrganization, AdminSettingsNotifications,
        AdminSettingsNotificationsQuery, AdminSettingsNotificationsReadError,
        AdminSettingsNotificationsRepository,
    };

    struct RecordingRepository;

    impl AdminSettingsNotificationsRepository for RecordingRepository {
        fn load(
            &self,
            include_feedback_requests: bool,
            include_organization_icon_reports: bool,
        ) -> impl Future<
            Output = Result<AdminSettingsNotifications, AdminSettingsNotificationsReadError>,
        > + Send {
            async move {
                Ok(AdminSettingsNotifications {
                    pending_feedback_requests: if include_feedback_requests { 1 } else { 0 },
                    pending_organization_icon_reports: if include_organization_icon_reports {
                        1
                    } else {
                        0
                    },
                    reported_organizations: include_organization_icon_reports
                        .then(|| AdminSettingsNotificationOrganization {
                            has_icon: true,
                            icon_report_id: "00000000-0000-4000-8000-000000000001".to_owned(),
                            name: "Learning Guild".to_owned(),
                        })
                        .into_iter()
                        .collect(),
                })
            }
        }
    }

    fn principal(capabilities: Vec<&str>) -> AuthorizedPrincipal {
        AuthorizedPrincipal {
            subject_id: Uuid::nil(),
            roles: vec![],
            capabilities: capabilities.into_iter().map(str::to_owned).collect(),
        }
    }

    #[tokio::test]
    async fn exposes_only_the_notification_categories_the_principal_can_read() {
        let notifications = AdminSettingsNotificationsQuery::new(&RecordingRepository)
            .execute(&principal(vec!["journal_feedback_view"]))
            .await
            .expect("summary loads");

        assert_eq!(notifications.pending_feedback_requests, 1);
        assert_eq!(notifications.pending_organization_icon_reports, 0);
        assert!(notifications.reported_organizations.is_empty());
    }

    #[tokio::test]
    async fn exposes_report_thumbnails_only_to_icon_moderators() {
        let notifications = AdminSettingsNotificationsQuery::new(&RecordingRepository)
            .execute(&principal(vec!["organization_icons_moderate"]))
            .await
            .expect("summary loads");

        assert_eq!(notifications.pending_feedback_requests, 0);
        assert_eq!(notifications.pending_organization_icon_reports, 1);
        assert_eq!(notifications.reported_organizations.len(), 1);
    }
}
