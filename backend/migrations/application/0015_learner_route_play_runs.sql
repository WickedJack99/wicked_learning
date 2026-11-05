-- A learner route is entered through an authored activity start, not through a
-- generic route. The earlier read-only model used (principal_id, route_id),
-- which was safe only while each fresh route appeared in exactly one place.
-- Promote the real start boundary before it gains a writer.
ALTER TABLE learner_route_progress
    ADD COLUMN activity_start_id UUID REFERENCES learning_activity_starts(id) ON DELETE CASCADE,
    ADD COLUMN current_play_run_id UUID,
    ADD COLUMN started_at TIMESTAMPTZ,
    ADD COLUMN last_exited_at TIMESTAMPTZ,
    ADD COLUMN reset_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT learner_route_progress_reset_count_check CHECK (reset_count >= 0);

UPDATE learner_route_progress AS progress
SET activity_start_id = starts.id
FROM learning_activity_starts AS starts
INNER JOIN learning_activities AS activities ON activities.id = starts.activity_id
WHERE progress.activity_start_id IS NULL
    AND progress.node_id = starts.node_id
    AND progress.route_id = activities.route_id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM learner_route_progress
        WHERE activity_start_id IS NULL
    ) THEN
        RAISE EXCEPTION 'every learner route progress row must match an activity start before route starts are writable';
    END IF;
END $$;

ALTER TABLE learner_route_progress
    ALTER COLUMN activity_start_id SET NOT NULL,
    DROP CONSTRAINT learner_route_progress_pkey,
    ADD PRIMARY KEY (principal_id, activity_start_id);

CREATE INDEX learner_route_progress_active_run_idx
    ON learner_route_progress (principal_id, current_play_run_id)
    WHERE current_play_run_id IS NOT NULL;

COMMENT ON COLUMN learner_route_progress.activity_start_id IS
    'The authored start selected by the learner. This is the progress identity; route_id remains a query aid.';
COMMENT ON COLUMN learner_route_progress.current_play_run_id IS
    'Opaque server-owned UUID for the active or most recent run. It is never chosen by the browser.';
