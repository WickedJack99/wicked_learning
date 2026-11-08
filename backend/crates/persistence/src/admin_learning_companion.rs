use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_learning_companion::{
    AdminLearningCompanionError, AdminLearningCompanionRepository, LearningCompanionSettingsForm,
};
use wicked_learning_domain::{
    identity_access::AuthorizedPrincipal,
    learning_companion::{LearningCompanionAiTemplateOption, LearningCompanionSettings},
};

pub struct PostgresAdminLearningCompanionRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminLearningCompanionRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct SettingsRow {
    ai_capabilities: serde_json::Value,
    ai_enabled: bool,
    ai_template_id: Option<Uuid>,
    avatar_color: String,
    avatar_position_x: i16,
    avatar_position_y: i16,
    avatar_scale: i16,
    avatar_url: Option<String>,
    display_name: String,
    enabled: bool,
    mode: String,
    welcome_message: String,
}

#[derive(FromRow)]
struct TemplateRow {
    enabled: bool,
    id: Uuid,
    name: String,
}

impl AdminLearningCompanionRepository for PostgresAdminLearningCompanionRepository<'_> {
    fn load(
        &self,
    ) -> impl std::future::Future<
        Output = Result<LearningCompanionSettings, AdminLearningCompanionError>,
    > + Send {
        async move { load(self.pool).await }
    }

    fn save(
        &self,
        principal: &AuthorizedPrincipal,
        form: &LearningCompanionSettingsForm,
    ) -> impl std::future::Future<
        Output = Result<Option<LearningCompanionSettings>, AdminLearningCompanionError>,
    > + Send {
        async move {
            let Some(principal_id) = application_principal_id(self.pool, principal).await? else {
                return Ok(None);
            };
            if let Some(template_id) = form.ai_template_id {
                let valid_template = sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS (SELECT 1 FROM ai_agent_templates WHERE id = $1 AND purpose = 'learner_companion')",
                )
                .bind(template_id)
                .fetch_one(self.pool)
                .await
                .map_err(unavailable)?;
                if !valid_template {
                    return Err(AdminLearningCompanionError::Invalid);
                }
            }

            sqlx::query(
                "UPDATE learning_companion_settings SET enabled = $1, display_name = $2, avatar_url = $3, avatar_color = $4, avatar_position_x = $5, avatar_position_y = $6, avatar_scale = $7, welcome_message = $8, mode = $9, ai_enabled = $10, ai_template_id = $11, ai_capabilities = $12, updated_by_principal_id = $13, updated_at = NOW() WHERE singleton = TRUE",
            )
            .bind(form.enabled)
            .bind(&form.display_name)
            .bind(&form.avatar_url)
            .bind(&form.avatar_color)
            .bind(form.avatar_position_x)
            .bind(form.avatar_position_y)
            .bind(form.avatar_scale)
            .bind(&form.welcome_message)
            .bind(&form.mode)
            .bind(form.ai_enabled)
            .bind(form.ai_template_id)
            .bind(serde_json::json!(form.ai_capabilities))
            .bind(principal_id)
            .execute(self.pool)
            .await
            .map_err(unavailable)?;
            load(self.pool).await.map(Some)
        }
    }
}

async fn application_principal_id(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Option<Uuid>, AdminLearningCompanionError> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM application_principals WHERE identity_subject_id = $1",
    )
    .bind(principal.subject_id)
    .fetch_optional(pool)
    .await
    .map_err(unavailable)
}

async fn load(pool: &PgPool) -> Result<LearningCompanionSettings, AdminLearningCompanionError> {
    let settings = sqlx::query_as::<_, SettingsRow>(
        "SELECT enabled, display_name, avatar_url, avatar_color, avatar_position_x, avatar_position_y, avatar_scale, welcome_message, mode, ai_enabled, ai_template_id, ai_capabilities FROM learning_companion_settings WHERE singleton = TRUE",
    )
    .fetch_one(pool)
    .await
    .map_err(unavailable)?;
    let ai_template_options = sqlx::query_as::<_, TemplateRow>(
        "SELECT id, name, enabled FROM ai_agent_templates WHERE purpose = 'learner_companion' ORDER BY name ASC, id ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(unavailable)?
    .into_iter()
    .map(|template| LearningCompanionAiTemplateOption {
        enabled: template.enabled,
        id: template.id,
        name: template.name,
    })
    .collect();
    let ai_capabilities = serde_json::from_value::<Vec<String>>(settings.ai_capabilities)
        .map_err(|_| AdminLearningCompanionError::Unavailable)?;

    Ok(LearningCompanionSettings {
        ai_capabilities,
        ai_enabled: settings.ai_enabled,
        ai_template_id: settings.ai_template_id,
        ai_template_options,
        avatar_color: settings.avatar_color,
        avatar_position_x: settings.avatar_position_x,
        avatar_position_y: settings.avatar_position_y,
        avatar_scale: settings.avatar_scale,
        avatar_url: settings.avatar_url,
        display_name: settings.display_name,
        enabled: settings.enabled,
        mode: settings.mode,
        welcome_message: settings.welcome_message,
    })
}

fn unavailable(error: sqlx::Error) -> AdminLearningCompanionError {
    tracing::error!(%error, "could not load or save Learning Companion settings");
    AdminLearningCompanionError::Unavailable
}
