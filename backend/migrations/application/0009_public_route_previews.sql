CREATE TABLE learning_routes (
    id UUID PRIMARY KEY,
    map_asset_id UUID NOT NULL REFERENCES learning_map_assets(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    position SMALLINT NOT NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_routes_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT learning_routes_position_check CHECK (position >= 0),
    CONSTRAINT learning_routes_asset_slug_unique UNIQUE (map_asset_id, slug)
);

CREATE TABLE learning_activities (
    id UUID PRIMARY KEY,
    route_id UUID NOT NULL REFERENCES learning_routes(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    position SMALLINT NOT NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_activities_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT learning_activities_position_check CHECK (position >= 0),
    CONSTRAINT learning_activities_route_slug_unique UNIQUE (route_id, slug)
);

INSERT INTO learning_routes (id, map_asset_id, slug, title, description, position, published_at)
VALUES
    (
        '00000000-0000-4000-8000-000000000005',
        '00000000-0000-4000-8000-000000000003',
        'map-orientation',
        'Map orientation',
        'A short route for noticing what a map can make easier to understand.',
        0,
        NOW()
    ),
    (
        '00000000-0000-4000-8000-000000000006',
        '00000000-0000-4000-8000-000000000004',
        'choose-your-next-step',
        'Choose your next step',
        'A short route for considering a useful direction without a prescribed order.',
        0,
        NOW()
    );

INSERT INTO learning_activities (id, route_id, slug, title, description, position, published_at)
VALUES
    (
        '00000000-0000-4000-8000-000000000007',
        '00000000-0000-4000-8000-000000000005',
        'find-your-place',
        'Find your place',
        'Notice the map context before deciding where to explore.',
        0,
        NOW()
    ),
    (
        '00000000-0000-4000-8000-000000000008',
        '00000000-0000-4000-8000-000000000005',
        'name-a-landmark',
        'Name a landmark',
        'Choose one place that could help you orient yourself later.',
        1,
        NOW()
    ),
    (
        '00000000-0000-4000-8000-000000000009',
        '00000000-0000-4000-8000-000000000006',
        'consider-a-direction',
        'Consider a direction',
        'Compare available directions without ranking them or creating urgency.',
        0,
        NOW()
    );
