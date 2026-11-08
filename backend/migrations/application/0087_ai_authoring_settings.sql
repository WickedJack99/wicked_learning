-- Provider credentials and reusable template settings are administration-only
-- configuration. API-key plaintext never enters these tables.
CREATE TABLE ai_provider_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label VARCHAR(120) NOT NULL,
    provider VARCHAR(40) NOT NULL,
    base_url VARCHAR(255) NULL,
    api_key_ciphertext BYTEA NULL,
    api_key_nonce BYTEA NULL,
    api_key_last_four VARCHAR(8) NULL,
    organization VARCHAR(255) NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    monthly_token_limit BIGINT NULL,
    monthly_cost_limit_cents INTEGER NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ai_provider_credentials_provider_check CHECK (provider IN (
        'openai', 'anthropic', 'gemini', 'xai', 'bedrock', 'ollama', 'compatible', 'local'
    )),
    CONSTRAINT ai_provider_credentials_label_check CHECK (char_length(btrim(label)) BETWEEN 1 AND 120),
    CONSTRAINT ai_provider_credentials_base_url_check CHECK (base_url IS NULL OR char_length(base_url) BETWEEN 1 AND 255),
    CONSTRAINT ai_provider_credentials_organization_check CHECK (organization IS NULL OR char_length(organization) BETWEEN 1 AND 255),
    CONSTRAINT ai_provider_credentials_api_key_parts_check CHECK (
        (api_key_ciphertext IS NULL AND api_key_nonce IS NULL AND api_key_last_four IS NULL)
        OR (api_key_ciphertext IS NOT NULL AND octet_length(api_key_nonce) = 12 AND char_length(api_key_last_four) BETWEEN 1 AND 8)
    ),
    CONSTRAINT ai_provider_credentials_monthly_token_limit_check CHECK (monthly_token_limit IS NULL OR monthly_token_limit >= 1),
    CONSTRAINT ai_provider_credentials_monthly_cost_limit_check CHECK (monthly_cost_limit_cents IS NULL OR monthly_cost_limit_cents >= 1),
    CONSTRAINT ai_provider_credentials_notes_check CHECK (notes IS NULL OR char_length(notes) <= 5000)
);

CREATE INDEX ai_provider_credentials_label_index ON ai_provider_credentials (label, id);

CREATE TABLE ai_agent_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_provider_credential_id UUID NULL REFERENCES ai_provider_credentials(id) ON DELETE SET NULL,
    created_by_principal_id UUID NULL REFERENCES application_principals(id) ON DELETE SET NULL,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(140) NOT NULL UNIQUE,
    purpose VARCHAR(40) NOT NULL,
    model VARCHAR(120) NULL,
    system_prompt TEXT NULL,
    task_prompt TEXT NULL,
    temperature NUMERIC(3, 2) NULL,
    reasoning_effort VARCHAR(16) NULL,
    max_output_tokens INTEGER NULL,
    concurrency_limit SMALLINT NOT NULL DEFAULT 1,
    monthly_token_limit BIGINT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    guarded_context BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ai_agent_templates_name_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
    CONSTRAINT ai_agent_templates_slug_check CHECK (slug ~ '^[A-Za-z0-9_-]{1,140}$'),
    CONSTRAINT ai_agent_templates_purpose_check CHECK (purpose IN (
        'sdt_design', 'asset_generation', 'learner_feedback', 'learner_companion',
        'general_assistant', 'content_authoring', 'activity_review'
    )),
    CONSTRAINT ai_agent_templates_model_check CHECK (model IS NULL OR char_length(model) BETWEEN 1 AND 120),
    CONSTRAINT ai_agent_templates_system_prompt_check CHECK (system_prompt IS NULL OR char_length(system_prompt) <= 12000),
    CONSTRAINT ai_agent_templates_task_prompt_check CHECK (task_prompt IS NULL OR char_length(task_prompt) <= 12000),
    CONSTRAINT ai_agent_templates_temperature_check CHECK (temperature IS NULL OR temperature BETWEEN 0 AND 2),
    CONSTRAINT ai_agent_templates_reasoning_effort_check CHECK (reasoning_effort IS NULL OR reasoning_effort IN ('none', 'low', 'medium', 'high', 'xhigh', 'max')),
    CONSTRAINT ai_agent_templates_generation_control_check CHECK (temperature IS NULL OR reasoning_effort IS NULL),
    CONSTRAINT ai_agent_templates_max_output_tokens_check CHECK (max_output_tokens IS NULL OR max_output_tokens BETWEEN 1 AND 128000),
    CONSTRAINT ai_agent_templates_concurrency_limit_check CHECK (concurrency_limit BETWEEN 1 AND 20),
    CONSTRAINT ai_agent_templates_monthly_token_limit_check CHECK (monthly_token_limit IS NULL OR monthly_token_limit >= 1)
);

CREATE INDEX ai_agent_templates_purpose_name_index ON ai_agent_templates (purpose, name, id);

COMMENT ON TABLE ai_provider_credentials IS
    'Encrypted provider credentials for server-only AI adapters. Plaintext API keys are never serialized or stored.';
COMMENT ON TABLE ai_agent_templates IS
    'Reusable, non-executing AI behavior configuration. Enabling a template grants no model or content-write authority.';
