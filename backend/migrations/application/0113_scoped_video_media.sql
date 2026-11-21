-- Source node/Markdown uploads accept video as well as images. Keep generic
-- image-library endpoints image-only; this registry also owns scoped video.
ALTER TABLE reusable_media_assets
    DROP CONSTRAINT reusable_media_assets_content_type_check,
    ADD CONSTRAINT reusable_media_assets_content_type_check CHECK (content_type IN (
        'image/gif', 'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml',
        'audio/aac', 'audio/flac', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
        'video/mp4', 'video/x-m4v', 'video/quicktime', 'video/webm', 'video/ogg'
    ));

CREATE TABLE map_media_uploads (
    asset_id UUID PRIMARY KEY REFERENCES reusable_media_assets(id) ON DELETE CASCADE,
    map_id UUID NOT NULL REFERENCES learning_maps(id) ON DELETE CASCADE
);
CREATE INDEX map_media_uploads_map_index ON map_media_uploads(map_id);
