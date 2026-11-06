CREATE TABLE application_locales (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    native_name TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT application_locales_code_format CHECK (code ~ '^[a-z]{2,3}(-[A-Z]{2})?$')
);

INSERT INTO application_locales (code, name, native_name)
VALUES ('en', 'English', 'English');

CREATE TABLE learner_language_preferences (
    principal_id UUID PRIMARY KEY REFERENCES application_principals(id) ON DELETE CASCADE,
    locale TEXT NOT NULL DEFAULT 'en' REFERENCES application_locales(code),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE learner_language_preferences IS
    'Private learner locale choice. Only enabled application locales may be selected by API policy.';
