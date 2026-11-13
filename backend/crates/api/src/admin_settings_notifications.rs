use axum::{Json, extract::State};
use axum_login::AuthSession;
use serde::Serialize;
use wicked_learning_application::admin_settings_notifications::AdminSettingsNotificationsQuery;
use wicked_learning_persistence::admin_settings_notifications::PostgresAdminSettingsNotificationsRepository;

use crate::{
    AppState, error::ApiError, identity::IdentityBackend,
    learner_route_run::authenticated_principal,
};

#[derive(Serialize)]
pub struct SettingsNotificationsResponse {
    pub pending_feedback_requests: i64,
    pub pending_organization_icon_reports: i64,
    pub reported_organizations: Vec<ReportedOrganizationResponse>,
}

#[derive(Serialize)]
pub struct ReportedOrganizationResponse {
    pub icon_url: Option<String>,
    pub name: String,
}

/// Returns the source Settings bell's bounded, permission-filtered summary.
/// The underlying queues remain their existing dedicated administration APIs.
pub async fn show(
    State(state): State<AppState>,
    auth_session: AuthSession<IdentityBackend>,
) -> Result<Json<SettingsNotificationsResponse>, ApiError> {
    let principal = authenticated_principal(&state, auth_session).await?;
    let repository = PostgresAdminSettingsNotificationsRepository::new(&state.application_database);
    let notifications = AdminSettingsNotificationsQuery::new(&repository)
        .execute(&principal)
        .await
        .map_err(|_| ApiError::service_unavailable())?;

    Ok(Json(SettingsNotificationsResponse {
        pending_feedback_requests: notifications.pending_feedback_requests,
        pending_organization_icon_reports: notifications.pending_organization_icon_reports,
        reported_organizations: notifications
            .reported_organizations
            .into_iter()
            .map(|organization| ReportedOrganizationResponse {
                icon_url: organization.has_icon.then(|| {
                    format!(
                        "/api/v1/admin/organization-icon-reports/{}/icon",
                        organization.icon_report_id
                    )
                }),
                name: organization.name,
            })
            .collect(),
    }))
}
