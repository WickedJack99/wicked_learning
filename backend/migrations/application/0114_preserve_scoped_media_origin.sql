-- A copied reference cannot remove the original map's media access boundary.
-- Keep an explicit tombstone after map deletion rather than making a scoped
-- upload indistinguishable from a generic reusable-library asset.
ALTER TABLE map_media_uploads
    ALTER COLUMN map_id DROP NOT NULL,
    DROP CONSTRAINT map_media_uploads_map_id_fkey,
    ADD CONSTRAINT map_media_uploads_map_id_fkey
        FOREIGN KEY (map_id) REFERENCES learning_maps(id) ON DELETE SET NULL;
