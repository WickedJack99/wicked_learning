-- Appearance is a private application preference, not credential or identity
-- profile data. It is initialized atomically with invitation registration.
CREATE TABLE learner_appearance_preferences (
    principal_id UUID PRIMARY KEY REFERENCES application_principals(id) ON DELETE CASCADE,
    appearance TEXT NOT NULL DEFAULT 'light',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_appearance_preferences_appearance_check
        CHECK (appearance IN ('dark', 'light'))
);

COMMENT ON TABLE learner_appearance_preferences IS
    'Private learner visual preference. It does not affect shared presentation or identity credentials.';
