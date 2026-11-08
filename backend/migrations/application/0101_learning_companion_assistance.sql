ALTER TABLE learner_activity_progress
    ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT learner_activity_progress_metadata_object_check
        CHECK (jsonb_typeof(metadata) = 'object');

COMMENT ON COLUMN learner_activity_progress.metadata IS
    'Bounded learner-private activity state, including transient Learning Companion assistance attribution for an active play run.';
