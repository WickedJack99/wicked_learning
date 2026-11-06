CREATE TABLE application_profile_images (
    id UUID PRIMARY KEY,
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    object_key TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL CHECK (content_type IN ('image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp')),
    byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 5242880),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE application_public_profiles
    ADD COLUMN profile_image_id UUID REFERENCES application_profile_images(id) ON DELETE SET NULL;

COMMENT ON TABLE application_profile_images IS
    'Profile-image metadata only. Bytes are held under an opaque key in the mounted Rust media volume.';
