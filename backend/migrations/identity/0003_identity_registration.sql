CREATE TABLE identity_profiles (
    subject_id UUID PRIMARY KEY REFERENCES identity_subjects(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT identity_profiles_display_name_not_blank CHECK (btrim(display_name) <> ''),
    CONSTRAINT identity_profiles_display_name_length CHECK (char_length(display_name) <= 255)
);

CREATE TABLE identity_registration_tokens (
    id UUID PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    created_by_subject_id UUID REFERENCES identity_subjects(id) ON DELETE SET NULL,
    used_by_subject_id UUID REFERENCES identity_subjects(id) ON DELETE SET NULL,
    note TEXT,
    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT identity_registration_tokens_note_length CHECK (note IS NULL OR char_length(note) <= 500),
    CONSTRAINT identity_registration_tokens_expiry_after_creation CHECK (expires_at IS NULL OR expires_at > created_at)
);

CREATE INDEX identity_registration_tokens_available_idx
    ON identity_registration_tokens (expires_at, created_at)
    WHERE used_at IS NULL;

COMMENT ON TABLE identity_profiles IS
    'Identity-owned display data. It is separate from credential verifiers and application learner data.';
COMMENT ON TABLE identity_registration_tokens IS
    'One-use invitation token hashes. Plaintext tokens are never stored.';
