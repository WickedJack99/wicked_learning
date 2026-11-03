ALTER TABLE learning_maps
    ADD COLUMN background_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN grid_config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE learning_map_assets
    ADD COLUMN image_url TEXT,
    ADD COLUMN text TEXT,
    ADD COLUMN width DOUBLE PRECISION NOT NULL DEFAULT 1,
    ADD COLUMN opacity DOUBLE PRECISION NOT NULL DEFAULT 1,
    ADD COLUMN visual_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN interaction_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN sound_config JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE learning_nodes (
    id UUID PRIMARY KEY,
    map_id UUID NOT NULL REFERENCES learning_maps(id) ON DELETE CASCADE,
    map_asset_id UUID UNIQUE REFERENCES learning_map_assets(id) ON DELETE SET NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    position_q INTEGER NOT NULL,
    position_r INTEGER NOT NULL,
    state TEXT NOT NULL DEFAULT 'available',
    visual_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_nodes_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT learning_nodes_state_check CHECK (state IN ('available', 'locked', 'hidden')),
    CONSTRAINT learning_nodes_map_slug_unique UNIQUE (map_id, slug)
);

UPDATE learning_maps
SET
    background_config = '{"pageBackground":"#0b1117","panelBackground":"rgba(7, 17, 31, 0.82)","panelTextColor":"#e2e8f0","accentColor":"#5eead4"}'::jsonb,
    grid_config = '{"tileWidth":96,"tileHeight":84,"gap":8}'::jsonb;

UPDATE learning_map_assets
SET
    width = 1,
    opacity = 1,
    visual_config = '{"icon":"map-pin","labelOpacity":"1","tileColor":"#0e7490","foregroundColor":"#f8fafc"}'::jsonb;

INSERT INTO learning_nodes (
    id, map_id, map_asset_id, slug, title, description, position_q, position_r, state, visual_config, published_at
)
VALUES
    (
        '00000000-0000-4000-8000-000000000010',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
        'notice-the-map',
        'Notice the map',
        'Maps help learners orient themselves; they are not a linear course list.',
        0, 0, 'available',
        '{"icon":"map","label":"Notice the map","tileColor":"#0e7490","foregroundColor":"#f8fafc"}'::jsonb,
        NOW()
    ),
    (
        '00000000-0000-4000-8000-000000000011',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000004',
        'choose-a-direction',
        'Choose a direction',
        'A learner can choose a useful next direction without pressure or hidden ranking.',
        2, 1, 'available',
        '{"icon":"signpost","label":"Choose a direction","tileColor":"#6d28d9","foregroundColor":"#f8fafc"}'::jsonb,
        NOW()
    );
