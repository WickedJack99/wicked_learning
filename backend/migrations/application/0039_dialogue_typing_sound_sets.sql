-- Typing sounds are a deliberately narrow presentation contract for NPC
-- dialogue. They are not the general uploaded-media system: the initial set
-- references versioned, bundled source assets that the frontend image serves.
CREATE TABLE learning_dialogue_typing_sound_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_dialogue_typing_sound_sets_slug_not_blank CHECK (btrim(slug) <> ''),
    CONSTRAINT learning_dialogue_typing_sound_sets_name_not_blank CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX learning_dialogue_typing_sound_sets_one_default
    ON learning_dialogue_typing_sound_sets (is_default)
    WHERE is_default;

CREATE TABLE learning_dialogue_typing_sounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sound_set_id UUID NOT NULL REFERENCES learning_dialogue_typing_sound_sets(id) ON DELETE CASCADE,
    letter CHAR(1) NOT NULL,
    url TEXT NOT NULL,
    volume SMALLINT NOT NULL DEFAULT 70,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_dialogue_typing_sounds_letter_check CHECK (letter ~ '^[a-z]$'),
    CONSTRAINT learning_dialogue_typing_sounds_url_not_blank CHECK (btrim(url) <> ''),
    CONSTRAINT learning_dialogue_typing_sounds_volume_check CHECK (volume BETWEEN 0 AND 100),
    CONSTRAINT learning_dialogue_typing_sounds_set_letter_unique UNIQUE (sound_set_id, letter)
);

CREATE INDEX learning_dialogue_typing_sounds_set_index
    ON learning_dialogue_typing_sounds (sound_set_id, letter);

-- This uses new identifiers and a fresh schema, but preserves the source
-- set's semantic contract and its already-versioned public WAV assets.
INSERT INTO learning_dialogue_typing_sound_sets (id, slug, name, is_default)
VALUES (
    '10000000-0000-4000-8000-000000000031',
    'curious-double-blip',
    'Curious double blip',
    TRUE
);

INSERT INTO learning_dialogue_typing_sounds (sound_set_id, letter, url, volume)
SELECT
    '10000000-0000-4000-8000-000000000031'::uuid,
    letter,
    '/sounds/dialogue-typing/letter-keyed/curious-double-blip-keyed-' || letter || '.wav',
    70
FROM unnest(ARRAY[
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
]::char(1)[]) AS letter;

-- The greenfield demonstration makes the previously deferred source feature
-- observable without adding a new user-facing control or general sound UI.
UPDATE learning_npc_dialogue_nodes
SET node_config = node_config || jsonb_build_object(
    'typingSoundEnabled', TRUE,
    'typingSoundSetId', '10000000-0000-4000-8000-000000000031'
)
WHERE id IN (
    '10000000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000012',
    '10000000-0000-4000-8000-000000000015',
    '10000000-0000-4000-8000-000000000016'
);

COMMENT ON TABLE learning_dialogue_typing_sound_sets IS
    'Bounded NPC dialogue typing-audio sets. Dynamic audio upload and general sound presentation remain separate media work.';
COMMENT ON TABLE learning_dialogue_typing_sounds IS
    'One lowercase-letter WAV reference per dialogue typing sound set.';
