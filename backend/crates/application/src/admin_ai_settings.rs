use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::{
    ai::{
        AdminAiSettings, AiAgentTemplate, AiProviderCredential, guardrail_notes,
        model_control_rules, provider_options, purpose_options,
    },
    identity_access::AuthorizedPrincipal,
};

const PROVIDERS: [&str; 8] = [
    "openai",
    "anthropic",
    "gemini",
    "xai",
    "bedrock",
    "ollama",
    "compatible",
    "local",
];
const PURPOSES: [&str; 7] = [
    "sdt_design",
    "asset_generation",
    "learner_feedback",
    "learner_companion",
    "general_assistant",
    "content_authoring",
    "activity_review",
];
const REASONING_EFFORTS: [&str; 6] = ["none", "low", "medium", "high", "xhigh", "max"];

#[derive(Clone, Debug)]
pub struct EncryptedApiKey {
    pub ciphertext: Vec<u8>,
    pub nonce: [u8; 12],
    pub last_four: String,
}

#[derive(Clone, Debug)]
pub struct ProviderCredentialForm {
    pub label: String,
    pub provider: String,
    pub base_url: Option<String>,
    pub api_key: Option<EncryptedApiKey>,
    pub organization: Option<String>,
    pub enabled: bool,
    pub monthly_token_limit: Option<i64>,
    pub monthly_cost_limit_cents: Option<i32>,
    pub notes: Option<String>,
}

impl ProviderCredentialForm {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        label: &str,
        provider: &str,
        base_url: Option<&str>,
        api_key: Option<EncryptedApiKey>,
        organization: Option<&str>,
        enabled: bool,
        monthly_token_limit: Option<i64>,
        monthly_cost_limit_cents: Option<i32>,
        notes: Option<&str>,
    ) -> Option<Self> {
        let label = bounded_required(label, 120)?;
        let provider = provider.trim().to_lowercase();
        if !PROVIDERS.contains(&provider.as_str())
            || monthly_token_limit.is_some_and(|value| value < 1)
            || monthly_cost_limit_cents.is_some_and(|value| value < 1)
            || api_key.as_ref().is_some_and(|key| {
                key.ciphertext.is_empty()
                    || key.last_four.is_empty()
                    || key.last_four.chars().count() > 8
            })
        {
            return None;
        }

        Some(Self {
            label,
            provider,
            base_url: optional_bounded(base_url, 255)?,
            api_key,
            organization: optional_bounded(organization, 255)?,
            enabled,
            monthly_token_limit,
            monthly_cost_limit_cents,
            notes: optional_bounded(notes, 5_000)?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct AgentTemplateForm {
    pub ai_provider_credential_id: Option<Uuid>,
    pub name: String,
    pub slug: Option<String>,
    pub purpose: String,
    pub model: Option<String>,
    pub system_prompt: Option<String>,
    pub task_prompt: Option<String>,
    pub temperature: Option<f64>,
    pub reasoning_effort: Option<String>,
    pub max_output_tokens: Option<i32>,
    pub concurrency_limit: i16,
    pub monthly_token_limit: Option<i64>,
    pub enabled: bool,
    pub guarded_context: bool,
}

impl AgentTemplateForm {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        ai_provider_credential_id: Option<Uuid>,
        name: &str,
        slug: Option<&str>,
        purpose: &str,
        model: Option<&str>,
        system_prompt: Option<&str>,
        task_prompt: Option<&str>,
        temperature: Option<f64>,
        reasoning_effort: Option<&str>,
        max_output_tokens: Option<i32>,
        concurrency_limit: i16,
        monthly_token_limit: Option<i64>,
        enabled: bool,
        guarded_context: bool,
    ) -> Option<Self> {
        let name = bounded_required(name, 120)?;
        let purpose = purpose.trim().to_owned();
        let reasoning_effort = optional_bounded(reasoning_effort, 16)?;
        let slug = optional_bounded(slug, 140)?;
        if !PURPOSES.contains(&purpose.as_str())
            || slug.as_ref().is_some_and(|value| !valid_slug(value))
            || reasoning_effort
                .as_deref()
                .is_some_and(|value| !REASONING_EFFORTS.contains(&value))
            || temperature.is_some_and(|value| !(0.0..=2.0).contains(&value))
            || (temperature.is_some() && reasoning_effort.is_some())
            || max_output_tokens.is_some_and(|value| !(1..=128_000).contains(&value))
            || !(1..=20).contains(&concurrency_limit)
            || monthly_token_limit.is_some_and(|value| value < 1)
        {
            return None;
        }

        Some(Self {
            ai_provider_credential_id,
            name,
            slug,
            purpose,
            model: optional_bounded(model, 120)?,
            system_prompt: optional_bounded(system_prompt, 12_000)?,
            task_prompt: optional_bounded(task_prompt, 12_000)?,
            temperature,
            reasoning_effort,
            max_output_tokens,
            concurrency_limit,
            monthly_token_limit,
            enabled,
            guarded_context,
        })
    }

    pub fn preferred_slug(&self) -> String {
        self.slug.clone().unwrap_or_else(|| slugify(&self.name))
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminAiSettingsError {
    Conflict,
    Unavailable,
}

pub trait AdminAiSettingsRepository {
    fn load(&self) -> impl Future<Output = Result<AdminAiSettings, AdminAiSettingsError>> + Send;
    fn create_provider(
        &self,
        form: &ProviderCredentialForm,
    ) -> impl Future<Output = Result<AiProviderCredential, AdminAiSettingsError>> + Send;
    fn update_provider(
        &self,
        provider_id: Uuid,
        form: &ProviderCredentialForm,
    ) -> impl Future<Output = Result<Option<AiProviderCredential>, AdminAiSettingsError>> + Send;
    fn delete_provider(
        &self,
        provider_id: Uuid,
    ) -> impl Future<Output = Result<bool, AdminAiSettingsError>> + Send;
    fn create_template(
        &self,
        principal: &AuthorizedPrincipal,
        form: &AgentTemplateForm,
    ) -> impl Future<Output = Result<AiAgentTemplate, AdminAiSettingsError>> + Send;
    fn update_template(
        &self,
        template_id: Uuid,
        form: &AgentTemplateForm,
    ) -> impl Future<Output = Result<Option<AiAgentTemplate>, AdminAiSettingsError>> + Send;
    fn delete_template(
        &self,
        template_id: Uuid,
    ) -> impl Future<Output = Result<bool, AdminAiSettingsError>> + Send;
}

pub struct AdminAiSettingsQuery<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminAiSettingsQuery<'repository, Repository>
where
    Repository: AdminAiSettingsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn execute(
        &self,
        principal: &AuthorizedPrincipal,
    ) -> Result<Option<AdminAiSettings>, AdminAiSettingsError> {
        if !principal.has_permission("ai", "ro") {
            return Ok(None);
        }

        self.repository.load().await.map(Some)
    }
}

pub struct AdminAiSettingsCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository> AdminAiSettingsCommand<'repository, Repository>
where
    Repository: AdminAiSettingsRepository,
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create_provider(
        &self,
        principal: &AuthorizedPrincipal,
        form: &ProviderCredentialForm,
    ) -> Result<Option<AiProviderCredential>, AdminAiSettingsError> {
        if !principal.has_permission("ai", "ru") {
            return Ok(None);
        }
        self.repository.create_provider(form).await.map(Some)
    }

    pub async fn update_provider(
        &self,
        principal: &AuthorizedPrincipal,
        provider_id: Uuid,
        form: &ProviderCredentialForm,
    ) -> Result<Option<AiProviderCredential>, AdminAiSettingsError> {
        if !principal.has_permission("ai", "ru") {
            return Ok(None);
        }
        self.repository.update_provider(provider_id, form).await
    }

    pub async fn delete_provider(
        &self,
        principal: &AuthorizedPrincipal,
        provider_id: Uuid,
    ) -> Result<bool, AdminAiSettingsError> {
        if !principal.has_permission("ai", "rud") {
            return Ok(false);
        }
        self.repository.delete_provider(provider_id).await
    }

    pub async fn create_template(
        &self,
        principal: &AuthorizedPrincipal,
        form: &AgentTemplateForm,
    ) -> Result<Option<AiAgentTemplate>, AdminAiSettingsError> {
        if !principal.has_permission("ai", "ru") {
            return Ok(None);
        }
        self.repository
            .create_template(principal, form)
            .await
            .map(Some)
    }

    pub async fn update_template(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
        form: &AgentTemplateForm,
    ) -> Result<Option<AiAgentTemplate>, AdminAiSettingsError> {
        if !principal.has_permission("ai", "ru") {
            return Ok(None);
        }
        self.repository.update_template(template_id, form).await
    }

    pub async fn delete_template(
        &self,
        principal: &AuthorizedPrincipal,
        template_id: Uuid,
    ) -> Result<bool, AdminAiSettingsError> {
        if !principal.has_permission("ai", "rud") {
            return Ok(false);
        }
        self.repository.delete_template(template_id).await
    }
}

pub fn source_default_settings() -> AdminAiSettings {
    AdminAiSettings {
        provider_credentials: vec![],
        agent_templates: vec![],
        provider_options: provider_options(),
        purpose_options: purpose_options(),
        model_control_rules: model_control_rules(),
        guardrail_notes: guardrail_notes(),
    }
}

fn bounded_required(value: &str, maximum: usize) -> Option<String> {
    let value = value.trim();
    (!value.is_empty() && value.chars().count() <= maximum).then(|| value.to_owned())
}

fn optional_bounded(value: Option<&str>, maximum: usize) -> Option<Option<String>> {
    let value = value.map(str::trim).filter(|value| !value.is_empty());
    match value {
        None => Some(None),
        Some(value) if value.chars().count() <= maximum => Some(Some(value.to_owned())),
        Some(_) => None,
    }
}

fn valid_slug(value: &str) -> bool {
    !value.is_empty()
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
}

fn slugify(value: &str) -> String {
    let mut result = String::new();
    let mut separator_pending = false;
    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            if separator_pending && !result.is_empty() {
                result.push('-');
            }
            result.push(character.to_ascii_lowercase());
            separator_pending = false;
        } else {
            separator_pending = true;
        }
    }
    if result.is_empty() {
        "agent-template".to_owned()
    } else {
        result.chars().take(140).collect()
    }
}

#[cfg(test)]
mod tests {
    use std::{
        future::Future,
        sync::atomic::{AtomicBool, Ordering},
    };

    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{
        AdminAiSettingsCommand, AdminAiSettingsError, AdminAiSettingsQuery,
        AdminAiSettingsRepository, AgentTemplateForm, ProviderCredentialForm,
        source_default_settings,
    };

    struct Repository(AtomicBool);
    impl AdminAiSettingsRepository for Repository {
        fn load(
            &self,
        ) -> impl Future<
            Output = Result<wicked_learning_domain::ai::AdminAiSettings, AdminAiSettingsError>,
        > + Send {
            self.0.store(true, Ordering::SeqCst);
            async { Ok(source_default_settings()) }
        }
        fn create_provider(
            &self,
            _: &ProviderCredentialForm,
        ) -> impl Future<
            Output = Result<wicked_learning_domain::ai::AiProviderCredential, AdminAiSettingsError>,
        > + Send {
            async { unreachable!() }
        }
        fn update_provider(
            &self,
            _: Uuid,
            _: &ProviderCredentialForm,
        ) -> impl Future<
            Output = Result<
                Option<wicked_learning_domain::ai::AiProviderCredential>,
                AdminAiSettingsError,
            >,
        > + Send {
            async { unreachable!() }
        }
        fn delete_provider(
            &self,
            _: Uuid,
        ) -> impl Future<Output = Result<bool, AdminAiSettingsError>> + Send {
            async { unreachable!() }
        }
        fn create_template(
            &self,
            _: &AuthorizedPrincipal,
            _: &AgentTemplateForm,
        ) -> impl Future<
            Output = Result<wicked_learning_domain::ai::AiAgentTemplate, AdminAiSettingsError>,
        > + Send {
            async { unreachable!() }
        }
        fn update_template(
            &self,
            _: Uuid,
            _: &AgentTemplateForm,
        ) -> impl Future<
            Output = Result<
                Option<wicked_learning_domain::ai::AiAgentTemplate>,
                AdminAiSettingsError,
            >,
        > + Send {
            async { unreachable!() }
        }
        fn delete_template(
            &self,
            _: Uuid,
        ) -> impl Future<Output = Result<bool, AdminAiSettingsError>> + Send {
            async { unreachable!() }
        }
    }

    #[test]
    fn source_forms_keep_provider_and_generation_control_boundaries() {
        assert!(
            ProviderCredentialForm::parse(
                "OpenAI main",
                "openai",
                None,
                None,
                None,
                true,
                Some(1),
                Some(1),
                None
            )
            .is_some()
        );
        assert!(
            ProviderCredentialForm::parse(
                "OpenAI main",
                "unknown",
                None,
                None,
                None,
                true,
                None,
                None,
                None
            )
            .is_none()
        );
        assert!(
            AgentTemplateForm::parse(
                None,
                "Review helper",
                None,
                "activity_review",
                Some("gpt-5.6-terra"),
                None,
                None,
                Some(0.3),
                Some("medium"),
                None,
                1,
                None,
                true,
                true
            )
            .is_none()
        );
        let form = AgentTemplateForm::parse(
            None,
            "SDT Design Reviewer",
            None,
            "sdt_design",
            None,
            None,
            None,
            None,
            None,
            None,
            1,
            None,
            false,
            true,
        )
        .expect("valid");
        assert_eq!(form.preferred_slug(), "sdt-design-reviewer");
    }

    #[tokio::test]
    async fn reads_stop_before_persistence_without_ai_read_permission() {
        let repository = Repository(AtomicBool::new(false));
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec!["role_permission:world_activities:rud:all".to_owned()],
        };
        assert!(
            AdminAiSettingsQuery::new(&repository)
                .execute(&principal)
                .await
                .unwrap()
                .is_none()
        );
        assert!(!repository.0.load(Ordering::SeqCst));
        assert!(
            !AdminAiSettingsCommand::new(&repository)
                .delete_provider(&principal, Uuid::new_v4())
                .await
                .unwrap()
        );
    }
}
