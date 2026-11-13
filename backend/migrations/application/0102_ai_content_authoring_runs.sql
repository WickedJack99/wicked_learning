-- A ContentPlan is an auditable, reviewable authoring draft. It deliberately
-- has no direct learner-facing effect: a later scoped apply command is the
-- only operation allowed to create a MapAsset or Activities from this record.
CREATE TABLE ai_content_authoring_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learning_map_id UUID NOT NULL REFERENCES learning_maps(id) ON DELETE CASCADE,
    ai_agent_template_id UUID NULL REFERENCES ai_agent_templates(id) ON DELETE SET NULL,
    created_by_principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    applied_by_principal_id UUID NULL REFERENCES application_principals(id) ON DELETE SET NULL,
    learning_map_asset_id UUID NULL REFERENCES learning_map_assets(id) ON DELETE SET NULL,
    contract_version VARCHAR(80) NOT NULL,
    prompt TEXT NOT NULL,
    context JSONB NOT NULL,
    plan JSONB NOT NULL,
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    provider VARCHAR(40) NOT NULL,
    model VARCHAR(160) NOT NULL,
    provider_response_id VARCHAR(255) NULL,
    provider_request_id VARCHAR(255) NULL,
    input_tokens BIGINT NULL,
    output_tokens BIGINT NULL,
    total_tokens BIGINT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    applied_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ai_content_authoring_runs_contract_version_check CHECK (char_length(btrim(contract_version)) BETWEEN 1 AND 80),
    CONSTRAINT ai_content_authoring_runs_prompt_check CHECK (char_length(btrim(prompt)) >= 1),
    CONSTRAINT ai_content_authoring_runs_context_object_check CHECK (jsonb_typeof(context) = 'object'),
    CONSTRAINT ai_content_authoring_runs_plan_object_check CHECK (jsonb_typeof(plan) = 'object'),
    CONSTRAINT ai_content_authoring_runs_warnings_array_check CHECK (jsonb_typeof(warnings) = 'array'),
    CONSTRAINT ai_content_authoring_runs_provider_check CHECK (char_length(btrim(provider)) BETWEEN 1 AND 40),
    CONSTRAINT ai_content_authoring_runs_model_check CHECK (char_length(btrim(model)) BETWEEN 1 AND 160),
    CONSTRAINT ai_content_authoring_runs_token_counts_check CHECK (
        (input_tokens IS NULL OR input_tokens >= 0)
        AND (output_tokens IS NULL OR output_tokens >= 0)
        AND (total_tokens IS NULL OR total_tokens >= 0)
    ),
    CONSTRAINT ai_content_authoring_runs_status_check CHECK (status IN ('draft', 'applied')),
    CONSTRAINT ai_content_authoring_runs_application_check CHECK (
        (status = 'draft' AND applied_at IS NULL AND applied_by_principal_id IS NULL AND learning_map_asset_id IS NULL)
        OR (status = 'applied' AND applied_at IS NOT NULL AND applied_by_principal_id IS NOT NULL AND learning_map_asset_id IS NOT NULL)
    )
);

CREATE INDEX ai_content_authoring_runs_map_created_index
    ON ai_content_authoring_runs (learning_map_id, created_at DESC, id DESC);

CREATE INDEX ai_content_authoring_runs_creator_created_index
    ON ai_content_authoring_runs (created_by_principal_id, created_at DESC, id DESC);

COMMENT ON TABLE ai_content_authoring_runs IS
    'Reviewable ContentPlan drafts. Provider output is validated before persistence and cannot mutate content until a later explicit apply command.';
