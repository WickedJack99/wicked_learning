-- A due revisit is a review of one already-completed activity, not a reset of
-- an authored route. Keep this run separate so opening it cannot overwrite an
-- ordinary in-progress route selected elsewhere in the World.
ALTER TABLE learner_activity_progress
    ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 1,
    ADD CONSTRAINT learner_activity_progress_attempt_count_check
        CHECK (attempt_count >= 1);

ALTER TABLE learner_activity_check_ins
    ADD CONSTRAINT learner_activity_check_ins_id_activity_unique
        UNIQUE (id, activity_id);

CREATE TABLE learner_revisit_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    check_in_id UUID NOT NULL UNIQUE REFERENCES learner_activity_check_ins(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    revisit_reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_revisit_runs_reason_check
        CHECK (revisit_reason IN ('pause', 'later')),
    CONSTRAINT learner_revisit_runs_status_check
        CHECK (status IN ('in_progress', 'completed')),
    CONSTRAINT learner_revisit_runs_completed_at_check
        CHECK ((status = 'in_progress' AND completed_at IS NULL)
            OR (status = 'completed' AND completed_at IS NOT NULL)),
    CONSTRAINT learner_revisit_runs_check_in_activity_match
        FOREIGN KEY (check_in_id, activity_id)
        REFERENCES learner_activity_check_ins (id, activity_id)
);

CREATE INDEX learner_revisit_runs_active_principal_index
    ON learner_revisit_runs (principal_id, last_entered_at DESC)
    WHERE status = 'in_progress';

CREATE TABLE learner_review_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revisit_run_id UUID NOT NULL UNIQUE REFERENCES learner_revisit_runs(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL,
    activity_id UUID NOT NULL,
    learner_reflection_id UUID REFERENCES learner_reflections(id) ON DELETE SET NULL,
    attempt_number INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'revisit',
    outcome TEXT,
    confidence TEXT,
    confidence_after_feedback TEXT,
    assistance_level TEXT NOT NULL DEFAULT 'untracked',
    observed_cues JSONB,
    revisit_reason TEXT NOT NULL,
    latency_seconds INTEGER,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_review_attempts_progress_owner
        FOREIGN KEY (principal_id, activity_id)
        REFERENCES learner_activity_progress (principal_id, activity_id)
        ON DELETE CASCADE,
    CONSTRAINT learner_review_attempts_attempt_number_check
        CHECK (attempt_number >= 2),
    CONSTRAINT learner_review_attempts_source_check
        CHECK (source = 'revisit'),
    CONSTRAINT learner_review_attempts_outcome_check
        CHECK (outcome IS NULL OR outcome IN ('completed', 'correct', 'incorrect')),
    CONSTRAINT learner_review_attempts_confidence_check
        CHECK (confidence IS NULL OR confidence IN ('exploring', 'leaning', 'settled')),
    CONSTRAINT learner_review_attempts_confidence_after_feedback_check
        CHECK (confidence_after_feedback IS NULL OR confidence_after_feedback IN ('exploring', 'leaning', 'settled')),
    CONSTRAINT learner_review_attempts_assistance_level_check
        CHECK (assistance_level IN ('untracked', 'independent', 'hint', 'questions_only', 'post_attempt_support')),
    CONSTRAINT learner_review_attempts_observed_cues_array_check
        CHECK (observed_cues IS NULL OR jsonb_typeof(observed_cues) = 'array'),
    CONSTRAINT learner_review_attempts_reason_check
        CHECK (revisit_reason IN ('pause', 'later')),
    CONSTRAINT learner_review_attempts_latency_seconds_check
        CHECK (latency_seconds IS NULL OR latency_seconds >= 0)
);

CREATE INDEX learner_review_attempts_principal_activity_attempted_index
    ON learner_review_attempts (principal_id, activity_id, attempted_at DESC, id DESC);

COMMENT ON TABLE learner_revisit_runs IS
    'Private server-owned runs for due learner revisit invitations. They never replace authored route progress.';
COMMENT ON TABLE learner_review_attempts IS
    'One immutable source-defined review record for each completed revisit run.';
