CREATE TABLE identity_password_reset_tokens (
    subject_id UUID PRIMARY KEY REFERENCES identity_subjects(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT identity_password_reset_tokens_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX identity_password_reset_tokens_expiry_idx
    ON identity_password_reset_tokens (expires_at);

COMMENT ON TABLE identity_password_reset_tokens IS
    'One active Argon2id-verified password-recovery token per identity subject. Plaintext tokens exist only while composing the source-compatible reset email.';
