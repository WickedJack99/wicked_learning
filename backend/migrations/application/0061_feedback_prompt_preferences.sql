CREATE TABLE learner_feedback_prompt_preferences (
    principal_id UUID PRIMARY KEY REFERENCES application_principals(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'snoozed', 'declined')),
    snoozed_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_feedback_prompt_snooze_check CHECK ((status = 'snoozed' AND snoozed_until IS NOT NULL) OR (status <> 'snoozed' AND snoozed_until IS NULL))
);
