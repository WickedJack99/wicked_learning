CREATE TABLE identity_totp_factors (
    subject_id UUID PRIMARY KEY REFERENCES identity_subjects(id) ON DELETE CASCADE,
    encrypted_secret BYTEA,
    encryption_nonce BYTEA,
    pending_encrypted_secret BYTEA,
    pending_encryption_nonce BYTEA,
    pending_created_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT identity_totp_factors_confirmed_pair CHECK (
        (encrypted_secret IS NULL AND encryption_nonce IS NULL AND confirmed_at IS NULL)
        OR (encrypted_secret IS NOT NULL AND octet_length(encryption_nonce) = 12 AND confirmed_at IS NOT NULL)
    ),
    CONSTRAINT identity_totp_factors_pending_pair CHECK (
        (pending_encrypted_secret IS NULL AND pending_encryption_nonce IS NULL AND pending_created_at IS NULL)
        OR (pending_encrypted_secret IS NOT NULL AND octet_length(pending_encryption_nonce) = 12 AND pending_created_at IS NOT NULL)
    )
);

CREATE TABLE identity_totp_recovery_code_verifiers (
    id UUID PRIMARY KEY,
    subject_id UUID NOT NULL REFERENCES identity_subjects(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (subject_id, code_hash)
);

CREATE INDEX identity_totp_recovery_code_verifiers_unused_index
    ON identity_totp_recovery_code_verifiers (subject_id, id)
    WHERE used_at IS NULL;

COMMENT ON TABLE identity_totp_factors IS
    'Rust-owned TOTP material. Secret values are encrypted in the identity database and remain pending until a valid authenticator code confirms enrollment.';

COMMENT ON TABLE identity_totp_recovery_code_verifiers IS
    'One-way Argon2id recovery-code verifiers. Plaintext codes are returned once only and are never stored.';
