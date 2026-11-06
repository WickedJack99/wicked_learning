CREATE TABLE application_public_profiles (
    principal_id UUID PRIMARY KEY REFERENCES application_principals(id) ON DELETE CASCADE,
    public_username TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT application_public_profiles_username_format CHECK (
        public_username IS NULL
        OR (char_length(public_username) BETWEEN 3 AND 32 AND public_username ~ '^[A-Za-z0-9_-]+$')
    )
);

CREATE UNIQUE INDEX application_public_profiles_username_unique_idx
    ON application_public_profiles (LOWER(public_username))
    WHERE public_username IS NOT NULL;

COMMENT ON TABLE application_public_profiles IS
    'Application-owned public learning-space profile data. Authentication email, display name and credential verifier remain in the identity database.';
