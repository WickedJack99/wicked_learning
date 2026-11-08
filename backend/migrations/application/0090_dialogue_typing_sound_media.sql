-- Preserve the original A–Z typing-set workflow while moving new WAV files
-- into the same managed object/reference lifecycle as reusable sounds. The
-- seeded bundled URLs remain valid until an author explicitly replaces them.
ALTER TABLE learning_dialogue_typing_sound_sets
    ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE learning_dialogue_typing_sounds
    ADD COLUMN audio_asset_id UUID REFERENCES reusable_media_assets(id) ON DELETE RESTRICT;

CREATE INDEX learning_dialogue_typing_sounds_audio_asset_index
    ON learning_dialogue_typing_sounds (audio_asset_id)
    WHERE audio_asset_id IS NOT NULL;

COMMENT ON COLUMN learning_dialogue_typing_sound_sets.tags IS
    'Source-compatible author tags for filtering and recognizing dialogue typing sound sets.';
COMMENT ON COLUMN learning_dialogue_typing_sounds.audio_asset_id IS
    'Optional managed WAV object. Legacy bundled URLs continue to serve until replaced.';
