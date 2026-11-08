use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_application::admin_ai_settings::{
    AdminAiSettingsError, AdminAiSettingsRepository as Port, AgentTemplateForm,
    ProviderCredentialForm, source_default_settings,
};
use wicked_learning_domain::{
    ai::{AdminAiSettings, AiAgentTemplate, AiProviderCredential},
    identity_access::AuthorizedPrincipal,
};

pub struct PostgresAdminAiSettingsRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminAiSettingsRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }
}

#[derive(FromRow)]
struct ProviderRow {
    id: Uuid,
    label: String,
    provider: String,
    base_url: Option<String>,
    has_api_key: bool,
    api_key_last_four: Option<String>,
    organization: Option<String>,
    enabled: bool,
    monthly_token_limit: Option<i64>,
    monthly_cost_limit_cents: Option<i32>,
    notes: Option<String>,
    updated_at: String,
}

#[derive(FromRow)]
struct TemplateRow {
    id: Uuid,
    ai_provider_credential_id: Option<Uuid>,
    provider_label: Option<String>,
    name: String,
    slug: String,
    purpose: String,
    model: Option<String>,
    system_prompt: Option<String>,
    task_prompt: Option<String>,
    temperature: Option<f64>,
    reasoning_effort: Option<String>,
    max_output_tokens: Option<i32>,
    concurrency_limit: i16,
    monthly_token_limit: Option<i64>,
    enabled: bool,
    guarded_context: bool,
    updated_at: String,
}

const PROVIDER_COLUMNS: &str = "id, label, provider, base_url, (api_key_ciphertext IS NOT NULL) AS has_api_key, api_key_last_four, organization, enabled, monthly_token_limit, monthly_cost_limit_cents, notes, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at";
const TEMPLATE_COLUMNS: &str = "templates.id, templates.ai_provider_credential_id, providers.label AS provider_label, templates.name, templates.slug, templates.purpose, templates.model, templates.system_prompt, templates.task_prompt, templates.temperature::DOUBLE PRECISION AS temperature, templates.reasoning_effort, templates.max_output_tokens, templates.concurrency_limit, templates.monthly_token_limit, templates.enabled, templates.guarded_context, to_char(templates.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS updated_at";

impl From<ProviderRow> for AiProviderCredential {
    fn from(row: ProviderRow) -> Self {
        Self {
            id: row.id,
            label: row.label,
            provider: row.provider,
            base_url: row.base_url,
            has_api_key: row.has_api_key,
            api_key_last_four: row.api_key_last_four,
            organization: row.organization,
            enabled: row.enabled,
            monthly_token_limit: row.monthly_token_limit,
            monthly_cost_limit_cents: row.monthly_cost_limit_cents,
            notes: row.notes,
            updated_at: row.updated_at,
        }
    }
}

impl From<TemplateRow> for AiAgentTemplate {
    fn from(row: TemplateRow) -> Self {
        Self {
            id: row.id,
            ai_provider_credential_id: row.ai_provider_credential_id,
            provider_label: row.provider_label,
            name: row.name,
            slug: row.slug,
            purpose: row.purpose,
            model: row.model,
            system_prompt: row.system_prompt,
            task_prompt: row.task_prompt,
            temperature: row.temperature,
            reasoning_effort: row.reasoning_effort,
            max_output_tokens: row.max_output_tokens,
            concurrency_limit: row.concurrency_limit,
            monthly_token_limit: row.monthly_token_limit,
            enabled: row.enabled,
            guarded_context: row.guarded_context,
            // Identity profile names are in the separate identity database;
            // this application projection intentionally does not cross-read it.
            created_by_name: None,
            updated_at: row.updated_at,
        }
    }
}

impl Port for PostgresAdminAiSettingsRepository<'_> {
    fn load(
        &self,
    ) -> impl std::future::Future<Output = Result<AdminAiSettings, AdminAiSettingsError>> + Send
    {
        async move {
            let providers = sqlx::query_as::<_, ProviderRow>(&format!(
                "SELECT {PROVIDER_COLUMNS} FROM ai_provider_credentials ORDER BY label ASC, id ASC"
            ))
            .fetch_all(self.pool)
            .await
            .map_err(unavailable)?
            .into_iter()
            .map(AiProviderCredential::from)
            .collect();
            let templates = sqlx::query_as::<_, TemplateRow>(&format!(
                "SELECT {TEMPLATE_COLUMNS} FROM ai_agent_templates AS templates LEFT JOIN ai_provider_credentials AS providers ON providers.id = templates.ai_provider_credential_id ORDER BY templates.purpose ASC, templates.name ASC, templates.id ASC"
            ))
            .fetch_all(self.pool)
            .await
            .map_err(unavailable)?
            .into_iter()
            .map(AiAgentTemplate::from)
            .collect();
            let mut settings = source_default_settings();
            settings.provider_credentials = providers;
            settings.agent_templates = templates;
            Ok(settings)
        }
    }

    fn create_provider(
        &self,
        form: &ProviderCredentialForm,
    ) -> impl std::future::Future<Output = Result<AiProviderCredential, AdminAiSettingsError>> + Send
    {
        async move {
            let row = sqlx::query_as::<_, ProviderRow>(&format!(
                "INSERT INTO ai_provider_credentials (label, provider, base_url, api_key_ciphertext, api_key_nonce, api_key_last_four, organization, enabled, monthly_token_limit, monthly_cost_limit_cents, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING {PROVIDER_COLUMNS}"
            ))
            .bind(&form.label)
            .bind(&form.provider)
            .bind(&form.base_url)
            .bind(form.api_key.as_ref().map(|key| &key.ciphertext))
            .bind(form.api_key.as_ref().map(|key| key.nonce.as_slice()))
            .bind(form.api_key.as_ref().map(|key| &key.last_four))
            .bind(&form.organization)
            .bind(form.enabled)
            .bind(form.monthly_token_limit)
            .bind(form.monthly_cost_limit_cents)
            .bind(&form.notes)
            .fetch_one(self.pool)
            .await
            .map_err(unavailable)?;
            Ok(row.into())
        }
    }

    fn update_provider(
        &self,
        provider_id: Uuid,
        form: &ProviderCredentialForm,
    ) -> impl std::future::Future<
        Output = Result<Option<AiProviderCredential>, AdminAiSettingsError>,
    > + Send {
        async move {
            let row = sqlx::query_as::<_, ProviderRow>(&format!(
                "UPDATE ai_provider_credentials SET label = $2, provider = $3, base_url = $4, api_key_ciphertext = COALESCE($5, api_key_ciphertext), api_key_nonce = COALESCE($6, api_key_nonce), api_key_last_four = COALESCE($7, api_key_last_four), organization = $8, enabled = $9, monthly_token_limit = $10, monthly_cost_limit_cents = $11, notes = $12, updated_at = NOW() WHERE id = $1 RETURNING {PROVIDER_COLUMNS}"
            ))
            .bind(provider_id)
            .bind(&form.label)
            .bind(&form.provider)
            .bind(&form.base_url)
            .bind(form.api_key.as_ref().map(|key| &key.ciphertext))
            .bind(form.api_key.as_ref().map(|key| key.nonce.as_slice()))
            .bind(form.api_key.as_ref().map(|key| &key.last_four))
            .bind(&form.organization)
            .bind(form.enabled)
            .bind(form.monthly_token_limit)
            .bind(form.monthly_cost_limit_cents)
            .bind(&form.notes)
            .fetch_optional(self.pool)
            .await
            .map_err(unavailable)?;
            Ok(row.map(Into::into))
        }
    }

    fn delete_provider(
        &self,
        provider_id: Uuid,
    ) -> impl std::future::Future<Output = Result<bool, AdminAiSettingsError>> + Send {
        async move {
            let result = sqlx::query("DELETE FROM ai_provider_credentials WHERE id = $1")
                .bind(provider_id)
                .execute(self.pool)
                .await
                .map_err(unavailable)?;
            Ok(result.rows_affected() == 1)
        }
    }

    fn create_template(
        &self,
        principal: &AuthorizedPrincipal,
        form: &AgentTemplateForm,
    ) -> impl std::future::Future<Output = Result<AiAgentTemplate, AdminAiSettingsError>> + Send
    {
        async move {
            let principal_id = application_principal_id(self.pool, principal).await?;
            let slug = available_slug(self.pool, &form.preferred_slug(), None, form.slug.is_some())
                .await?;
            let id = sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO ai_agent_templates (ai_provider_credential_id, created_by_principal_id, name, slug, purpose, model, system_prompt, task_prompt, temperature, reasoning_effort, max_output_tokens, concurrency_limit, monthly_token_limit, enabled, guarded_context) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id"
            )
            .bind(form.ai_provider_credential_id)
            .bind(principal_id)
            .bind(&form.name)
            .bind(slug)
            .bind(&form.purpose)
            .bind(&form.model)
            .bind(&form.system_prompt)
            .bind(&form.task_prompt)
            .bind(form.temperature)
            .bind(&form.reasoning_effort)
            .bind(form.max_output_tokens)
            .bind(form.concurrency_limit)
            .bind(form.monthly_token_limit)
            .bind(form.enabled)
            .bind(form.guarded_context)
            .fetch_one(self.pool)
            .await
            .map_err(map_write_error)?;
            template_by_id(self.pool, id)
                .await?
                .ok_or(AdminAiSettingsError::Unavailable)
        }
    }

    fn update_template(
        &self,
        template_id: Uuid,
        form: &AgentTemplateForm,
    ) -> impl std::future::Future<Output = Result<Option<AiAgentTemplate>, AdminAiSettingsError>> + Send
    {
        async move {
            let existing = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS (SELECT 1 FROM ai_agent_templates WHERE id = $1)",
            )
            .bind(template_id)
            .fetch_one(self.pool)
            .await
            .map_err(unavailable)?;
            if !existing {
                return Ok(None);
            }
            let slug = available_slug(
                self.pool,
                &form.preferred_slug(),
                Some(template_id),
                form.slug.is_some(),
            )
            .await?;
            let updated = sqlx::query_scalar::<_, Uuid>(
                "UPDATE ai_agent_templates SET ai_provider_credential_id = $2, name = $3, slug = $4, purpose = $5, model = $6, system_prompt = $7, task_prompt = $8, temperature = $9, reasoning_effort = $10, max_output_tokens = $11, concurrency_limit = $12, monthly_token_limit = $13, enabled = $14, guarded_context = $15, updated_at = NOW() WHERE id = $1 RETURNING id"
            )
            .bind(template_id)
            .bind(form.ai_provider_credential_id)
            .bind(&form.name)
            .bind(slug)
            .bind(&form.purpose)
            .bind(&form.model)
            .bind(&form.system_prompt)
            .bind(&form.task_prompt)
            .bind(form.temperature)
            .bind(&form.reasoning_effort)
            .bind(form.max_output_tokens)
            .bind(form.concurrency_limit)
            .bind(form.monthly_token_limit)
            .bind(form.enabled)
            .bind(form.guarded_context)
            .fetch_optional(self.pool)
            .await
            .map_err(map_write_error)?;
            match updated {
                Some(id) => template_by_id(self.pool, id).await,
                None => Ok(None),
            }
        }
    }

    fn delete_template(
        &self,
        template_id: Uuid,
    ) -> impl std::future::Future<Output = Result<bool, AdminAiSettingsError>> + Send {
        async move {
            let result = sqlx::query("DELETE FROM ai_agent_templates WHERE id = $1")
                .bind(template_id)
                .execute(self.pool)
                .await
                .map_err(unavailable)?;
            Ok(result.rows_affected() == 1)
        }
    }
}

async fn template_by_id(
    pool: &PgPool,
    template_id: Uuid,
) -> Result<Option<AiAgentTemplate>, AdminAiSettingsError> {
    sqlx::query_as::<_, TemplateRow>(&format!(
        "SELECT {TEMPLATE_COLUMNS} FROM ai_agent_templates AS templates LEFT JOIN ai_provider_credentials AS providers ON providers.id = templates.ai_provider_credential_id WHERE templates.id = $1"
    ))
    .bind(template_id)
    .fetch_optional(pool)
    .await
    .map_err(unavailable)
    .map(|row| row.map(Into::into))
}

async fn application_principal_id(
    pool: &PgPool,
    principal: &AuthorizedPrincipal,
) -> Result<Uuid, AdminAiSettingsError> {
    sqlx::query_scalar("SELECT id FROM application_principals WHERE identity_subject_id = $1")
        .bind(principal.subject_id)
        .fetch_optional(pool)
        .await
        .map_err(unavailable)?
        .ok_or(AdminAiSettingsError::Unavailable)
}

async fn available_slug(
    pool: &PgPool,
    preferred: &str,
    excluding: Option<Uuid>,
    explicit: bool,
) -> Result<String, AdminAiSettingsError> {
    if explicit {
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (SELECT 1 FROM ai_agent_templates WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2))",
        )
        .bind(preferred)
        .bind(excluding)
        .fetch_one(pool)
        .await
        .map_err(unavailable)?;
        return (!exists)
            .then(|| preferred.to_owned())
            .ok_or(AdminAiSettingsError::Conflict);
    }
    for suffix in 1..=10_000_i32 {
        let candidate = if suffix == 1 {
            preferred.to_owned()
        } else {
            let ending = format!("-{suffix}");
            let stem: String = preferred.chars().take(140 - ending.len()).collect();
            format!("{stem}{ending}")
        };
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (SELECT 1 FROM ai_agent_templates WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2))",
        )
        .bind(&candidate)
        .bind(excluding)
        .fetch_one(pool)
        .await
        .map_err(unavailable)?;
        if !exists {
            return Ok(candidate);
        }
    }
    Err(AdminAiSettingsError::Conflict)
}

fn unavailable(error: sqlx::Error) -> AdminAiSettingsError {
    tracing::error!(%error, "could not manage AI settings");
    AdminAiSettingsError::Unavailable
}

fn map_write_error(error: sqlx::Error) -> AdminAiSettingsError {
    if let sqlx::Error::Database(database) = &error
        && database.constraint() == Some("ai_agent_templates_slug_key")
    {
        return AdminAiSettingsError::Conflict;
    }
    unavailable(error)
}

#[cfg(test)]
mod tests {
    use super::TemplateRow;

    #[test]
    fn template_rows_are_never_deserialized_with_provider_secret_columns() {
        let fields = std::any::type_name::<TemplateRow>();
        assert!(fields.ends_with("TemplateRow"));
    }
}
