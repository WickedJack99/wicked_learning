-- Topic transitions are private learner navigation history for the competence
-- map. They are not a global topic graph and never make one learner's route
-- history visible to another learner.
ALTER TABLE application_principals
    ADD COLUMN last_competence_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD CONSTRAINT application_principals_last_competence_topics_array_check
        CHECK (jsonb_typeof(last_competence_topics) = 'array');

CREATE TABLE learner_competence_topic_transitions (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    from_topic_slug TEXT NOT NULL,
    from_topic_name TEXT NOT NULL,
    to_topic_slug TEXT NOT NULL,
    to_topic_name TEXT NOT NULL,
    transition_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, from_topic_slug, to_topic_slug),
    CONSTRAINT learner_competence_topic_transitions_from_slug_check
        CHECK (from_topic_slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT learner_competence_topic_transitions_to_slug_check
        CHECK (to_topic_slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT learner_competence_topic_transitions_from_name_not_blank
        CHECK (btrim(from_topic_name) <> ''),
    CONSTRAINT learner_competence_topic_transitions_to_name_not_blank
        CHECK (btrim(to_topic_name) <> ''),
    CONSTRAINT learner_competence_topic_transitions_count_check
        CHECK (transition_count > 0)
);

CREATE INDEX learner_competence_topic_transitions_principal_count_index
    ON learner_competence_topic_transitions (principal_id, transition_count DESC);
