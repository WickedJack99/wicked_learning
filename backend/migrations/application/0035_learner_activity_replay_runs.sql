-- A historical activity replay is neither authored route progression, a due
-- revisit, nor a recall attempt.  Its own run record keeps those meanings
-- isolated while allowing the server to authorize a source-history entry.
CREATE TABLE learner_activity_replay_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_activity_replay_runs_status_check
        CHECK (status IN ('in_progress', 'completed')),
    CONSTRAINT learner_activity_replay_runs_completed_at_check
        CHECK ((status = 'in_progress' AND completed_at IS NULL)
            OR (status = 'completed' AND completed_at IS NOT NULL))
);

CREATE UNIQUE INDEX learner_activity_replay_runs_one_active_activity
    ON learner_activity_replay_runs (principal_id, activity_id)
    WHERE status = 'in_progress';

CREATE INDEX learner_activity_replay_runs_principal_activity_index
    ON learner_activity_replay_runs (principal_id, activity_id, started_at DESC);

COMMENT ON TABLE learner_activity_replay_runs IS
    'Private opaque runs for reopening a currently accessible historical activity without changing route, recall, or due-revisit state.';
