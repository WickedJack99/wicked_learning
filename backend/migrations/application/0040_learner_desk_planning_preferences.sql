-- The source Learning Desk remembers only a learner's explicit route-filter
-- choices. It is application data, separated from identity credentials and
-- session records in the identity database.
CREATE TABLE learner_desk_planning_preferences (
    principal_id UUID PRIMARY KEY REFERENCES application_principals(id) ON DELETE CASCADE,
    purpose_filter TEXT NOT NULL DEFAULT 'any',
    time_budget SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_desk_planning_preferences_purpose_filter_check
        CHECK (purpose_filter IN ('any', 'apply', 'explain', 'participate', 'reflect', 'retrieve', 'review', 'transfer')),
    CONSTRAINT learner_desk_planning_preferences_time_budget_check
        CHECK (time_budget IS NULL OR time_budget IN (15, 30))
);

COMMENT ON TABLE learner_desk_planning_preferences IS
    'Private explicit Learning Desk route filters. They are not learning intent, progress, or a recommendation.';
