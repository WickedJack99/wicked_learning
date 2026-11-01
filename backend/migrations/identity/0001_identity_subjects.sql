CREATE TABLE identity_subjects (
    id UUID PRIMARY KEY,
    normalized_email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    email_verified_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT identity_subjects_status_check CHECK (status IN ('active', 'suspended', 'disabled'))
);

COMMENT ON TABLE identity_subjects IS
    'Authentication identities only. Application profiles and content live in the separate application database.';
