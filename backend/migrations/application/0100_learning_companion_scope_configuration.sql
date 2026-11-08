ALTER TABLE learning_worlds
    ADD COLUMN companion_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT learning_worlds_companion_config_object_check
        CHECK (jsonb_typeof(companion_config) = 'object');

ALTER TABLE learning_maps
    ADD COLUMN companion_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT learning_maps_companion_config_object_check
        CHECK (jsonb_typeof(companion_config) = 'object');

ALTER TABLE learning_nodes
    ADD COLUMN companion_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT learning_nodes_companion_config_object_check
        CHECK (jsonb_typeof(companion_config) = 'object');

ALTER TABLE learning_activities
    ADD COLUMN companion_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT learning_activities_companion_config_object_check
        CHECK (jsonb_typeof(companion_config) = 'object');

COMMENT ON COLUMN learning_worlds.companion_config IS
    'Source-shaped optional Learning Companion overrides inherited by maps, nodes and activities.';
COMMENT ON COLUMN learning_maps.companion_config IS
    'Source-shaped optional Learning Companion overrides inherited by nodes and activities.';
COMMENT ON COLUMN learning_nodes.companion_config IS
    'Source-shaped optional Learning Companion overrides inherited by activities.';
COMMENT ON COLUMN learning_activities.companion_config IS
    'Source-shaped optional Learning Companion overrides for this activity.';
