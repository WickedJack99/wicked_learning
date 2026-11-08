-- Reusable audio uses the same opaque MediaStore/object-reference lifecycle as
-- reusable visuals. Existing bundled `/sounds/...` rows remain valid while new
-- sound-library uploads attach an owned registry asset.
ALTER TABLE reusable_media_assets
    DROP CONSTRAINT reusable_media_assets_content_type_check,
    ADD CONSTRAINT reusable_media_assets_content_type_check CHECK (
        content_type IN (
            'image/gif', 'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml',
            'audio/aac', 'audio/flac', 'audio/mp4', 'audio/mpeg', 'audio/ogg',
            'audio/wav', 'audio/webm'
        )
    );

ALTER TABLE learning_sounds
    ADD COLUMN audio_asset_id UUID REFERENCES reusable_media_assets(id) ON DELETE RESTRICT;

CREATE INDEX learning_sounds_audio_asset_index
    ON learning_sounds (audio_asset_id)
    WHERE audio_asset_id IS NOT NULL;

COMMENT ON COLUMN learning_sounds.audio_asset_id IS
    'Optional managed audio object for source-shaped reusable-sound uploads; bundled URLs remain supported.';
