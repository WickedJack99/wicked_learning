CREATE TABLE learning_map_asset_versions (
    id UUID PRIMARY KEY,
    map_asset_id UUID NOT NULL REFERENCES learning_map_assets(id) ON DELETE CASCADE,
    changed_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    image_url TEXT,
    text TEXT,
    position_x DOUBLE PRECISION NOT NULL,
    position_y DOUBLE PRECISION NOT NULL,
    position_z INTEGER NOT NULL,
    width DOUBLE PRECISION NOT NULL,
    opacity DOUBLE PRECISION NOT NULL,
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    interaction_mode TEXT NOT NULL,
    interaction_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    visual_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    sound_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX learning_map_asset_versions_asset_created_idx
    ON learning_map_asset_versions (map_asset_id, created_at DESC, id DESC);
