CREATE TABLE identity_password_credentials (
    subject_id UUID PRIMARY KEY REFERENCES identity_subjects(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO identity_password_credentials (subject_id, password_hash)
SELECT id, password_hash
FROM identity_subjects
WHERE password_hash IS NOT NULL;

ALTER TABLE identity_subjects DROP COLUMN password_hash;

COMMENT ON TABLE identity_password_credentials IS
    'Credential-verifier records only. Password hashes are not stored with identity profile records or application data.';
