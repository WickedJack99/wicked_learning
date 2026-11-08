-- Fresh, Rust-owned reusable visual assets. Object bytes remain in MediaStore;
-- this table is the authorization, metadata and reference-integrity registry.
CREATE TABLE reusable_media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by_principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE RESTRICT,
    object_key TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL,
    byte_size INTEGER NOT NULL CHECK (byte_size > 0),
    display_name TEXT,
    category TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    has_transparency BOOLEAN,
    is_animated BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reusable_media_assets_content_type_check CHECK (content_type IN ('image/gif', 'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml')),
    CONSTRAINT reusable_media_assets_display_name_length CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 160),
    CONSTRAINT reusable_media_assets_category_length CHECK (category IS NULL OR char_length(category) BETWEEN 1 AND 80),
    CONSTRAINT reusable_media_assets_tags_count CHECK (cardinality(tags) <= 12)
);

CREATE INDEX reusable_media_assets_updated_index
    ON reusable_media_assets (updated_at DESC, id DESC);
CREATE INDEX reusable_media_assets_tags_index
    ON reusable_media_assets USING GIN (tags);

-- References are written by future media-aware authoring commands. Keeping
-- them normalized means replace preserves stable asset IDs and delete cannot
-- silently leave a saved configuration pointing to nothing.
CREATE TABLE reusable_media_asset_references (
    asset_id UUID NOT NULL REFERENCES reusable_media_assets(id) ON DELETE RESTRICT,
    owner_kind TEXT NOT NULL,
    owner_id UUID NOT NULL,
    field_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (asset_id, owner_kind, owner_id, field_key),
    CONSTRAINT reusable_media_asset_references_owner_kind_length CHECK (char_length(owner_kind) BETWEEN 1 AND 80),
    CONSTRAINT reusable_media_asset_references_field_key_length CHECK (char_length(field_key) BETWEEN 1 AND 160)
);

CREATE INDEX reusable_media_asset_references_owner_index
    ON reusable_media_asset_references (owner_kind, owner_id);

COMMENT ON TABLE reusable_media_assets IS
    'Fresh Rust-owned reusable visual registry; opaque bytes are held by MediaStore.';
COMMENT ON TABLE reusable_media_asset_references IS
    'Saved Rust-owned authoring references that protect reusable media from unsafe deletion.';
