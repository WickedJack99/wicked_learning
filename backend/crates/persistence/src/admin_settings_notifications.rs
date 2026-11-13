use sqlx::{FromRow, PgPool};
use wicked_learning_application::admin_settings_notifications::{
    AdminSettingsNotificationOrganization, AdminSettingsNotifications,
    AdminSettingsNotificationsReadError,
    AdminSettingsNotificationsRepository as AdminSettingsNotificationsRepositoryPort,
};

pub struct PostgresAdminSettingsNotificationsRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminSettingsNotificationsRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

impl AdminSettingsNotificationsRepositoryPort for PostgresAdminSettingsNotificationsRepository<'_> {
    fn load(
        &self,
        include_feedback_requests: bool,
        include_organization_icon_reports: bool,
    ) -> impl std::future::Future<
        Output = Result<AdminSettingsNotifications, AdminSettingsNotificationsReadError>,
    > + Send {
        async move {
            load(
                self.pool,
                include_feedback_requests,
                include_organization_icon_reports,
            )
            .await
            .map_err(|error| {
                tracing::error!(%error, "could not load Settings notifications");
                AdminSettingsNotificationsReadError
            })
        }
    }
}

#[derive(FromRow)]
struct OrganizationReportRow {
    has_icon: bool,
    icon_report_id: String,
    name: String,
}

async fn load(
    pool: &PgPool,
    include_feedback_requests: bool,
    include_organization_icon_reports: bool,
) -> Result<AdminSettingsNotifications, sqlx::Error> {
    let pending_feedback_requests = if include_feedback_requests {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*)::BIGINT FROM learner_journal_feedback_requests WHERE responded_at IS NULL",
        )
        .fetch_one(pool)
        .await?
    } else {
        0
    };

    let (pending_organization_icon_reports, reported_organizations) =
        if include_organization_icon_reports {
            let pending_organization_icon_reports = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*)::BIGINT FROM organization_icon_reports WHERE status = 'pending'",
            )
            .fetch_one(pool)
            .await?;
            let reported_organizations = sqlx::query_as::<_, OrganizationReportRow>(
                "SELECT reports.icon_content_type IS NOT NULL AS has_icon, reports.id::TEXT AS icon_report_id, organizations.name \
                 FROM organization_icon_reports AS reports \
                 INNER JOIN organizations ON organizations.id = reports.organization_id \
                 WHERE reports.status = 'pending' \
                 ORDER BY reports.created_at DESC, reports.id DESC LIMIT 4",
            )
            .fetch_all(pool)
            .await?
            .into_iter()
            .map(|row| AdminSettingsNotificationOrganization {
                has_icon: row.has_icon,
                icon_report_id: row.icon_report_id,
                name: row.name,
            })
            .collect();
            (pending_organization_icon_reports, reported_organizations)
        } else {
            (0, vec![])
        };

    Ok(AdminSettingsNotifications {
        pending_feedback_requests,
        pending_organization_icon_reports,
        reported_organizations,
    })
}
