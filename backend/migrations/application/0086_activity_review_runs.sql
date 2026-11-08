CREATE TABLE learning_activity_review_runs (
    id UUID PRIMARY KEY,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    agent_template_id UUID NULL,
    reviewed_by_principal_id UUID NULL REFERENCES application_principals(id) ON DELETE SET NULL,
    contract_version VARCHAR(32) NOT NULL,
    provider VARCHAR(64) NOT NULL,
    model VARCHAR(120) NULL,
    review JSONB NOT NULL,
    input_tokens INTEGER NULL CHECK (input_tokens >= 0),
    output_tokens INTEGER NULL CHECK (output_tokens >= 0),
    total_tokens INTEGER NULL CHECK (total_tokens >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX learning_activity_review_runs_activity_created_at_index
    ON learning_activity_review_runs (activity_id, created_at DESC, id DESC);

COMMENT ON TABLE learning_activity_review_runs IS
    'Immutable, author-requested structured AI review runs. Reviews never change learning content or learner data.';
