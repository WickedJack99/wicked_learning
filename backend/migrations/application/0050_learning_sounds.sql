CREATE TABLE learning_sounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    volume SMALLINT NOT NULL DEFAULT 70,
    play_seconds NUMERIC(6, 2),
    loop BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_sounds_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT learning_sounds_url_check CHECK (url ~ '^/[^/].*'),
    CONSTRAINT learning_sounds_volume_check CHECK (volume BETWEEN 0 AND 100)
);

INSERT INTO learning_sounds (
    id, slug, name, url, volume, play_seconds, loop, published_at
)
VALUES
    (
        '00000000-0000-4000-8000-000000000058',
        'quiet-pulse',
        'Quiet pulse',
        '/sounds/quiet-pulse.wav',
        55,
        NULL,
        TRUE,
        NOW()
    ),
    (
        '00000000-0000-4000-8000-000000000059',
        'soft-chime',
        'Soft chime',
        '/sounds/soft-chime.wav',
        70,
        2,
        FALSE,
        NOW()
    )
ON CONFLICT (slug) DO NOTHING;

UPDATE learning_activities
SET activity_config = activity_config || jsonb_build_object(
    'ambientSound',
    jsonb_build_object(
        'enabled', true,
        'soundId', '00000000-0000-4000-8000-000000000058'
    )
)
WHERE id = '00000000-0000-4000-8000-000000000054';
