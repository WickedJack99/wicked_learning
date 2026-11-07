CREATE TABLE identity_passkeys (
    id UUID PRIMARY KEY,
    subject_id UUID NOT NULL REFERENCES identity_subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 255),
    credential_id BYTEA NOT NULL UNIQUE CHECK (octet_length(credential_id) BETWEEN 16 AND 1024),
    credential JSONB NOT NULL CHECK (jsonb_typeof(credential) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX identity_passkeys_subject_created_idx
    ON identity_passkeys (subject_id, created_at DESC, id DESC);

COMMENT ON TABLE identity_passkeys IS
    'Identity-owned WebAuthn passkey public credentials and source-shaped labels. No application data or browser-held ceremony state is stored here.';
