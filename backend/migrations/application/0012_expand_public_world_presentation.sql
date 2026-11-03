-- Presentation-only fields needed to lift the original map renderer without
-- exposing learner progress, authorization assignments, or private activity data.
ALTER TABLE learning_worlds
    ADD COLUMN theme_config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE learning_maps
    ADD COLUMN map_assets_locked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE learning_map_assets
    ADD COLUMN locked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE learning_map_assets
    DROP CONSTRAINT learning_map_assets_interaction_check,
    ADD CONSTRAINT learning_map_assets_interaction_check
        CHECK (interaction_mode IN ('focusable', 'decorative', 'hide_on_hover', 'toggle'));

COMMENT ON COLUMN learning_worlds.theme_config IS
    'Published presentation values for the World shell; this does not contain learner state.';

COMMENT ON COLUMN learning_maps.map_assets_locked IS
    'Author-controlled presentation lock for map assets, separate from learner node eligibility.';

COMMENT ON COLUMN learning_map_assets.locked IS
    'Author-controlled presentation lock for a map asset, separate from a learner-specific node state.';
