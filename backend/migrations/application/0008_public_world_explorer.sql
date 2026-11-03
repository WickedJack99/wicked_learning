CREATE TABLE learning_worlds (
    id UUID PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_worlds_slug_check CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE TABLE learning_maps (
    id UUID PRIMARY KEY,
    world_id UUID NOT NULL REFERENCES learning_worlds(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    position SMALLINT NOT NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_maps_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT learning_maps_position_check CHECK (position >= 0),
    CONSTRAINT learning_maps_world_slug_unique UNIQUE (world_id, slug)
);

CREATE TABLE learning_map_assets (
    id UUID PRIMARY KEY,
    map_id UUID NOT NULL REFERENCES learning_maps(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    position_x DOUBLE PRECISION NOT NULL,
    position_y DOUBLE PRECISION NOT NULL,
    position_z INTEGER NOT NULL DEFAULT 0,
    interaction_mode TEXT NOT NULL DEFAULT 'focusable',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_map_assets_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT learning_map_assets_x_check CHECK (position_x >= 0 AND position_x <= 100),
    CONSTRAINT learning_map_assets_y_check CHECK (position_y >= 0 AND position_y <= 100),
    CONSTRAINT learning_map_assets_interaction_check CHECK (interaction_mode IN ('focusable', 'decorative')),
    CONSTRAINT learning_map_assets_map_slug_unique UNIQUE (map_id, slug)
);

INSERT INTO learning_worlds (id, slug, title, description, published_at)
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'orientation-garden',
    'Orientation Garden',
    'A small fresh world for noticing how maps, places and learner choice fit together.',
    NOW()
);

INSERT INTO learning_maps (id, world_id, slug, title, description, position, published_at)
VALUES (
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'first-path',
    'The First Path',
    'Two places introduce the map without assigning a compulsory order.',
    0,
    NOW()
);

INSERT INTO learning_map_assets (
    id, map_id, slug, title, description, position_x, position_y, position_z, interaction_mode, published_at
)
VALUES
    (
        '00000000-0000-4000-8000-000000000003',
        '00000000-0000-4000-8000-000000000002',
        'notice-the-map',
        'Notice the map',
        'Maps help learners orient themselves; they are not a linear course list.',
        30,
        46,
        0,
        'focusable',
        NOW()
    ),
    (
        '00000000-0000-4000-8000-000000000004',
        '00000000-0000-4000-8000-000000000002',
        'choose-a-direction',
        'Choose a direction',
        'A learner can choose a useful next direction without pressure or hidden ranking.',
        68,
        54,
        1,
        'focusable',
        NOW()
    );
