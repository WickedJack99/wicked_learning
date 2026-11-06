-- A recall choice is learner-owned state, separate from route progression.
-- The queue may be removed at any time without changing activity progress,
-- evidence, or a previously opened recall run.
CREATE TABLE learner_recall_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_confidence TEXT,
    last_confidence_after_feedback TEXT,
    last_outcome TEXT,
    last_reviewed_at TIMESTAMPTZ,
    last_interval_days SMALLINT,
    review_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_recall_items_principal_activity_unique UNIQUE (principal_id, activity_id),
    CONSTRAINT learner_recall_items_review_count_check CHECK (review_count >= 0),
    CONSTRAINT learner_recall_items_last_confidence_check
        CHECK (last_confidence IS NULL OR last_confidence IN ('exploring', 'leaning', 'settled')),
    CONSTRAINT learner_recall_items_last_confidence_after_feedback_check
        CHECK (last_confidence_after_feedback IS NULL OR last_confidence_after_feedback IN ('exploring', 'leaning', 'settled')),
    CONSTRAINT learner_recall_items_last_outcome_check
        CHECK (last_outcome IS NULL OR last_outcome IN ('correct', 'incorrect')),
    CONSTRAINT learner_recall_items_last_interval_days_check
        CHECK (last_interval_days IS NULL OR last_interval_days IN (1, 3, 7, 14, 30))
);

CREATE INDEX learner_recall_items_due_index
    ON learner_recall_items (principal_id, next_review_at ASC, created_at DESC, id DESC);

-- A recall run authorizes exactly one queued question. It is intentionally not
-- a route run: answering it never advances a route, creates activity progress,
-- or creates a competence event. The item link stays nullable because a
-- learner may remove a question after opening it.
CREATE TABLE learner_recall_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    recall_item_id UUID REFERENCES learner_recall_items(id) ON DELETE SET NULL,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_recall_runs_status_check CHECK (status IN ('in_progress', 'completed')),
    CONSTRAINT learner_recall_runs_completed_at_check
        CHECK ((status = 'in_progress' AND completed_at IS NULL)
            OR (status = 'completed' AND completed_at IS NOT NULL))
);

CREATE UNIQUE INDEX learner_recall_runs_one_active_item
    ON learner_recall_runs (principal_id, activity_id)
    WHERE status = 'in_progress';

CREATE INDEX learner_recall_runs_principal_activity_index
    ON learner_recall_runs (principal_id, activity_id, started_at DESC);

COMMENT ON TABLE learner_recall_items IS
    'Private, learner-selected question recall queue. It is not route progress or a competence schedule.';
COMMENT ON TABLE learner_recall_runs IS
    'Private one-question recall attempts. A run cannot advance an authored route or create completion evidence.';
