-- Platform feedback is deliberately shared with the platform team. It remains
-- application data, owned by an application principal rather than an identity
-- record or a learner's private journal.
CREATE TABLE application_platform_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('general', 'idea', 'problem', 'praise')),
    message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 4000),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX application_platform_feedback_review_queue_idx
    ON application_platform_feedback (reviewed_at, submitted_at DESC, id DESC);
