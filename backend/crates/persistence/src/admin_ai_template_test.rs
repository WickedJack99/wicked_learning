use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

/// Server-only material for one explicitly requested saved-template test. It
/// is never serialized; the API provider adapter decrypts the key only while
/// creating the outbound request.
pub struct AiTemplateTestExecution {
    pub provider: Option<String>,
    pub provider_enabled: bool,
    pub base_url: Option<String>,
    pub organization: Option<String>,
    pub encrypted_api_key: Option<Vec<u8>>,
    pub api_key_nonce: Option<Vec<u8>>,
    pub model: Option<String>,
    pub system_prompt: Option<String>,
    pub task_prompt: Option<String>,
    pub temperature: Option<f64>,
    pub reasoning_effort: Option<String>,
    pub max_output_tokens: Option<i32>,
    pub prompt: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AiTemplateTestPersistenceError;

pub struct PostgresAdminAiTemplateTestRepository<'pool> {
    pool: &'pool PgPool,
}

impl<'pool> PostgresAdminAiTemplateTestRepository<'pool> {
    pub fn new(pool: &'pool PgPool) -> Self {
        Self { pool }
    }

    pub async fn prepare(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        prompt: String,
    ) -> Result<Option<AiTemplateTestExecution>, AiTemplateTestPersistenceError> {
        if !principal.has_permission("ai", "ru") {
            return Ok(None);
        }

        let row = sqlx::query_as::<_, TemplateTestRow>(
            "SELECT providers.provider, COALESCE(providers.enabled, false) AS provider_enabled, providers.base_url, providers.organization, providers.api_key_ciphertext, providers.api_key_nonce, templates.model, templates.system_prompt, templates.task_prompt, templates.temperature::DOUBLE PRECISION AS temperature, templates.reasoning_effort, templates.max_output_tokens FROM ai_agent_templates AS templates LEFT JOIN ai_provider_credentials AS providers ON providers.id = templates.ai_provider_credential_id WHERE templates.id = $1",
        )
        .bind(template_id)
        .fetch_optional(self.pool)
        .await
        .map_err(unavailable)?;

        Ok(row.map(|row| AiTemplateTestExecution {
            provider: row.provider,
            provider_enabled: row.provider_enabled,
            base_url: row.base_url,
            organization: row.organization,
            encrypted_api_key: row.api_key_ciphertext,
            api_key_nonce: row.api_key_nonce,
            model: row.model,
            system_prompt: row.system_prompt,
            task_prompt: row.task_prompt,
            temperature: row.temperature,
            reasoning_effort: row.reasoning_effort,
            max_output_tokens: row.max_output_tokens,
            prompt,
        }))
    }
}

#[derive(FromRow)]
struct TemplateTestRow {
    provider: Option<String>,
    provider_enabled: bool,
    base_url: Option<String>,
    organization: Option<String>,
    api_key_ciphertext: Option<Vec<u8>>,
    api_key_nonce: Option<Vec<u8>>,
    model: Option<String>,
    system_prompt: Option<String>,
    task_prompt: Option<String>,
    temperature: Option<f64>,
    reasoning_effort: Option<String>,
    max_output_tokens: Option<i32>,
}

fn unavailable(error: sqlx::Error) -> AiTemplateTestPersistenceError {
    tracing::error!(%error, "could not prepare an AI template test");
    AiTemplateTestPersistenceError
}
