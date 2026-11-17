use std::collections::BTreeMap;

use axum::{Json, extract::State};
use axum_login::AuthSession;
use serde::Serialize;
use wicked_learning_application::admin_settings_notifications::AdminSettingsNotificationsQuery;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;
use wicked_learning_persistence::admin_settings_notifications::PostgresAdminSettingsNotificationsRepository;

use crate::{
    AppState, admin_settings_notifications::ReportedOrganizationResponse, error::ApiError,
    identity::IdentityBackend, learner_route_run::authenticated_principal,
};

/// The complete, browser-visible permission levels that the copied Settings
/// navigation needs for display. They remain presentation hints: every read
/// and command route reauthorizes the authenticated principal independently.
pub(crate) const SETTINGS_PERMISSION_RESOURCES: [&str; 22] = [
    "ai",
    "assets",
    "companion",
    "competence_topics",
    "content_api",
    "group_members",
    "groups",
    "journal_feedback",
    "journal_settings",
    "languages",
    "learner_support_signals",
    "learning_concepts",
    "organization_moderation",
    "platform_feedback",
    "presentation",
    "roles",
    "sounds",
    "users",
    "world_activities",
    "world_map_access",
    "world_maps",
    "world_nodes",
];

#[derive(Serialize)]
pub struct SettingsBootstrapResponse {
    pub access_capabilities: BTreeMap<String, SettingsAccessCapability>,
    pub can_access_administration: bool,
    pub notifications: SettingsBootstrapNotifications,
}

#[derive(Serialize)]
pub struct SettingsAccessCapability {
    pub delete: bool,
    pub read: bool,
    pub update: bool,
}

#[derive(Serialize)]
pub struct SettingsBootstrapNotifications {
    pub pending_feedback_requests: i64,
    pub pending_organization_icon_reports: i64,
    pub reported_organizations: Vec<ReportedOrganizationResponse>,
}

/// Reads exactly the common root-Settings chrome contract. It deliberately
/// excludes every panel document: the copied root page may mount only a panel
/// whose own projection is present, and an unprojected panel stays unavailable.
pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<SettingsBootstrapResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminSettingsNotificationsRepository::new(&state.application_database);
    let notifications = AdminSettingsNotificationsQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?;
    let access_capabilities = settings_capabilities(&principal);

    Ok(Json(SettingsBootstrapResponse {
        can_access_administration: access_capabilities
            .values()
            .any(|capability| capability.read),
        access_capabilities,
        notifications: SettingsBootstrapNotifications {
            pending_feedback_requests: notifications.pending_feedback_requests,
            pending_organization_icon_reports: notifications.pending_organization_icon_reports,
            reported_organizations: notifications
                .reported_organizations
                .into_iter()
                .map(|organization| ReportedOrganizationResponse {
                    id: organization.icon_report_id.clone(),
                    icon_url: organization.has_icon.then(|| {
                        format!(
                            "/api/v1/admin/organization-icon-reports/{}/icon",
                            organization.icon_report_id
                        )
                    }),
                    name: organization.name,
                })
                .collect(),
        },
    }))
}

fn settings_capabilities(
    principal: &AuthorizedPrincipal,
) -> BTreeMap<String, SettingsAccessCapability> {
    SETTINGS_PERMISSION_RESOURCES
        .into_iter()
        .map(|resource| {
            (
                resource.to_owned(),
                SettingsAccessCapability {
                    delete: principal.has_permission(resource, "rud"),
                    read: principal.has_permission(resource, "ro"),
                    update: principal.has_permission(resource, "ru"),
                },
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::settings_capabilities;

    #[test]
    fn projects_source_navigation_levels_without_disclosing_scopes() {
        let capabilities = settings_capabilities(&AuthorizedPrincipal {
            subject_id: Uuid::nil(),
            roles: vec!["world_author".to_owned()],
            capabilities: vec![
                "role_permission:world_maps:ru:assigned".to_owned(),
                "role_permission:world_nodes:rud:own".to_owned(),
            ],
        });

        assert!(capabilities["world_maps"].read);
        assert!(capabilities["world_maps"].update);
        assert!(!capabilities["world_maps"].delete);
        assert!(capabilities["world_nodes"].delete);
        assert!(!capabilities["ai"].read);

        let json = serde_json::to_value(capabilities).expect("capabilities serialize");
        assert!(!json.to_string().contains("assigned"));
        assert!(!json.to_string().contains("own"));
    }
}
