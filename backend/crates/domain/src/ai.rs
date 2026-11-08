use serde::Serialize;
use uuid::Uuid;

/// Safe administration projection. It deliberately excludes ciphertext,
/// encryption nonces and provider-key plaintext.
#[derive(Clone, Debug, Serialize)]
pub struct AiProviderCredential {
    pub id: Uuid,
    pub label: String,
    pub provider: String,
    pub base_url: Option<String>,
    pub has_api_key: bool,
    pub api_key_last_four: Option<String>,
    pub organization: Option<String>,
    pub enabled: bool,
    pub monthly_token_limit: Option<i64>,
    pub monthly_cost_limit_cents: Option<i32>,
    pub notes: Option<String>,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AiAgentTemplate {
    pub id: Uuid,
    pub ai_provider_credential_id: Option<Uuid>,
    pub provider_label: Option<String>,
    pub name: String,
    pub slug: String,
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
    pub created_by_name: Option<String>,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AiOption {
    pub value: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AiModelControlRule {
    pub provider: String,
    pub model_prefix: String,
    pub mode: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct AdminAiSettings {
    pub provider_credentials: Vec<AiProviderCredential>,
    pub agent_templates: Vec<AiAgentTemplate>,
    pub provider_options: Vec<AiOption>,
    pub purpose_options: Vec<AiOption>,
    pub model_control_rules: Vec<AiModelControlRule>,
    pub guardrail_notes: Vec<String>,
}

pub fn provider_options() -> Vec<AiOption> {
    [
        ("openai", "OpenAI"),
        ("anthropic", "Anthropic"),
        ("gemini", "Google Gemini"),
        ("xai", "xAI"),
        ("bedrock", "Amazon Bedrock"),
        ("ollama", "Ollama"),
        ("compatible", "OpenAI-compatible"),
        ("local", "Local service"),
    ]
    .into_iter()
    .map(|(value, label)| AiOption {
        value: value.to_owned(),
        label: label.to_owned(),
        description: None,
    })
    .collect()
}

pub fn purpose_options() -> Vec<AiOption> {
    [
        (
            "sdt_design",
            "SDT design helper",
            "Helps admins review learning flows for autonomy, competence and relatedness.",
        ),
        (
            "asset_generation",
            "Asset generation helper",
            "Drafts prompts or asset ideas for worlds, tiles and activity scenes.",
        ),
        (
            "learner_feedback",
            "Learner feedback helper",
            "Prepares informational feedback for reflections without scores or pressure loops.",
        ),
        (
            "learner_companion",
            "Learning Companion",
            "Provides short, context-bounded responses to authored companion dialogue nodes.",
        ),
        (
            "general_assistant",
            "General assistant",
            "A broader helper for tasks that do not need sensitive learner context.",
        ),
        (
            "content_authoring",
            "Content authoring",
            "Drafts reviewable MapAssets and short Activity routes for administrators.",
        ),
        (
            "activity_review",
            "Activity review",
            "Reviews one activity in its scoped learning context for clarity and learning support.",
        ),
    ]
    .into_iter()
    .map(|(value, label, description)| AiOption {
        value: value.to_owned(),
        label: label.to_owned(),
        description: Some(description.to_owned()),
    })
    .collect()
}

pub fn model_control_rules() -> Vec<AiModelControlRule> {
    vec![AiModelControlRule {
        provider: "openai".to_owned(),
        model_prefix: "gpt-5.6".to_owned(),
        mode: "reasoning".to_owned(),
    }]
}

pub fn guardrail_notes() -> Vec<String> {
    vec![
        "API keys are encrypted at rest and are never serialized back to the browser after saving.".to_owned(),
        "Guarded-context templates should receive learner data only through explicit activity or route loaders.".to_owned(),
        "Concurrency and monthly limits describe queued runtime guardrails for future AI jobs.".to_owned(),
    ]
}
