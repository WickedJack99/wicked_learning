-- Locale definitions already own each learner's private preference.  Keep the
-- editable platform catalogue and authored learner-copy translations in the
-- application database as well; neither belongs to identity data.
ALTER TABLE application_locales
    ADD COLUMN translations JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN created_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    ADD COLUMN updated_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD CONSTRAINT application_locales_translations_object_check
        CHECK (jsonb_typeof(translations) = 'object');

CREATE TABLE learning_activity_translations (
    learning_activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    locale TEXT NOT NULL REFERENCES application_locales(code) ON DELETE CASCADE,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (learning_activity_id, locale),
    CONSTRAINT learning_activity_translations_content_object_check
        CHECK (jsonb_typeof(content) = 'object')
);

CREATE INDEX learning_activity_translations_locale_index
    ON learning_activity_translations (locale, learning_activity_id);

COMMENT ON TABLE learning_activity_translations IS
    'Locale-specific learner copy only. Translation imports may not change activity behavior, scoring, graph targets, media, or access policy.';
