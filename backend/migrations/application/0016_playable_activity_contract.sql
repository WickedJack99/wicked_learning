-- Activity starts need server-evaluated eligibility before their first writer.
-- These fields are intentionally generic data owned by the World-content
-- module; activity-specific validation and rendering arrive with each playback
-- capability rather than being guessed in the browser.
ALTER TABLE learning_activities
    ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'open_practice',
    ADD COLUMN activity_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT learning_activities_activity_type_check
        CHECK (activity_type ~ '^[a-z][a-z0-9_]{0,63}$'),
    ADD CONSTRAINT learning_activities_activity_config_object_check
        CHECK (jsonb_typeof(activity_config) = 'object');

COMMENT ON COLUMN learning_activities.activity_type IS
    'Server-validated activity kind. The browser only renders a type returned by an authorized playback contract.';
COMMENT ON COLUMN learning_activities.activity_config IS
    'Type-specific authored configuration. It is not exposed through World snapshots.';
