-- Competence is derived from learner-owned evidence events, never from a
-- public score or a mutable accumulated total. The activity completion writer
-- arrives separately after its complete source policy is migrated.
CREATE TABLE competence_topic_definitions (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    growth_threshold NUMERIC(12, 2) NOT NULL DEFAULT 20,
    emittance_threshold NUMERIC(12, 2) NOT NULL DEFAULT 20,
    aura_threshold NUMERIC(12, 2) NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT competence_topic_definitions_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT competence_topic_definitions_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT competence_topic_definitions_growth_threshold_check CHECK (growth_threshold > 0),
    CONSTRAINT competence_topic_definitions_emittance_threshold_check CHECK (emittance_threshold > 0),
    CONSTRAINT competence_topic_definitions_aura_threshold_check CHECK (aura_threshold > 0)
);

CREATE TABLE learner_evidence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    play_run_id UUID NOT NULL,
    learner_reflection_id UUID REFERENCES learner_reflections(id) ON DELETE SET NULL,
    is_independent_check BOOLEAN NOT NULL DEFAULT FALSE,
    objective TEXT,
    concepts JSONB,
    topic_slug TEXT NOT NULL,
    topic_name TEXT NOT NULL,
    evidence_type TEXT NOT NULL,
    learning_purpose TEXT,
    evidence_criterion TEXT,
    evidence_rubric JSONB,
    observed_cues JSONB,
    source_references JSONB,
    contribution NUMERIC(12, 2) NOT NULL,
    outcome TEXT NOT NULL DEFAULT 'completed',
    confidence TEXT,
    confidence_after_feedback TEXT,
    calibration TEXT,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    assistance_level TEXT NOT NULL DEFAULT 'untracked',
    latency_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_evidence_events_topic_slug_check CHECK (topic_slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT learner_evidence_events_topic_name_not_blank CHECK (btrim(topic_name) <> ''),
    CONSTRAINT learner_evidence_events_evidence_type_check CHECK (evidence_type IN ('apply', 'explain', 'participate', 'reflect', 'retrieve', 'review', 'transfer')),
    CONSTRAINT learner_evidence_events_contribution_check CHECK (contribution > 0),
    CONSTRAINT learner_evidence_events_concepts_array_check CHECK (concepts IS NULL OR jsonb_typeof(concepts) = 'array'),
    CONSTRAINT learner_evidence_events_evidence_rubric_array_check CHECK (evidence_rubric IS NULL OR jsonb_typeof(evidence_rubric) = 'array'),
    CONSTRAINT learner_evidence_events_observed_cues_array_check CHECK (observed_cues IS NULL OR jsonb_typeof(observed_cues) = 'array'),
    CONSTRAINT learner_evidence_events_source_references_array_check CHECK (source_references IS NULL OR jsonb_typeof(source_references) = 'array'),
    CONSTRAINT learner_evidence_events_attempt_number_check CHECK (attempt_number > 0),
    CONSTRAINT learner_evidence_events_latency_seconds_check CHECK (latency_seconds IS NULL OR latency_seconds >= 0),
    CONSTRAINT learner_evidence_events_unique UNIQUE (principal_id, activity_id, play_run_id, topic_slug, evidence_type, attempt_number)
);

CREATE INDEX learner_evidence_events_principal_topic_index
    ON learner_evidence_events (principal_id, topic_slug, evidence_type);
CREATE INDEX learner_evidence_events_principal_created_index
    ON learner_evidence_events (principal_id, created_at DESC, id DESC);
CREATE INDEX learner_evidence_events_reflection_index
    ON learner_evidence_events (learner_reflection_id)
    WHERE learner_reflection_id IS NOT NULL;

-- Fresh local orientation content has an explicit qualitative threshold. It is
-- not a migrated Laravel record and does not create learner evidence.
INSERT INTO competence_topic_definitions (
    slug, name, description, growth_threshold, emittance_threshold, aura_threshold
) VALUES (
    'orientation', 'Orientation',
    'Noticing a learning map and choosing a useful next direction.',
    20, 20, 10
);
