-- Private sound controls belong with application preferences, never with
-- credentials or shared authored content. Values match the source UI's
-- explicit 0–100 sliders and default to an audible experience.
CREATE TABLE learner_sound_preferences (
    principal_id UUID PRIMARY KEY REFERENCES application_principals(id) ON DELETE CASCADE,
    muted BOOLEAN NOT NULL DEFAULT FALSE,
    effects_volume SMALLINT NOT NULL DEFAULT 100,
    ambience_volume SMALLINT NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_sound_preferences_effects_volume_check
        CHECK (effects_volume BETWEEN 0 AND 100),
    CONSTRAINT learner_sound_preferences_ambience_volume_check
        CHECK (ambience_volume BETWEEN 0 AND 100)
);

COMMENT ON TABLE learner_sound_preferences IS
    'Private learner audio preference values. They do not alter shared content or identity credentials.';
