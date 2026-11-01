CREATE TABLE application_principals (
    id UUID PRIMARY KEY,
    identity_subject_id UUID NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE application_principals IS
    'Application-side mapping for an identity subject. A cross-database foreign key is deliberately impossible.';
