-- A reflection remains tied to the authored entry point even after its route
-- is reset or another run becomes current. Future private-journal readers use
-- this immutable context instead of inferring it from mutable route progress.
ALTER TABLE learner_reflections
    ADD COLUMN activity_start_id UUID REFERENCES learning_activity_starts(id) ON DELETE SET NULL;

CREATE INDEX learner_reflections_activity_start_created_idx
    ON learner_reflections (activity_start_id, created_at DESC, id DESC);

COMMENT ON COLUMN learner_reflections.activity_start_id IS
    'Authored route entry point active when this private reflection was saved; retained for learner-only journal context.';
