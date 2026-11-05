-- Reflection is private learner-owned writing, not public activity metadata or
-- a generic completion note. Keep its structured record and the editable
-- journal representation in the application database, scoped to one principal.
CREATE TABLE learner_journal_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    subtopic TEXT NOT NULL DEFAULT '',
    markdown TEXT NOT NULL DEFAULT '',
    preferred_mode TEXT NOT NULL DEFAULT 'view',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_journal_pages_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT learner_journal_pages_topic_not_blank CHECK (btrim(topic) <> ''),
    CONSTRAINT learner_journal_pages_preferred_mode_check CHECK (preferred_mode IN ('view', 'edit')),
    CONSTRAINT learner_journal_pages_principal_topic_subtopic_unique UNIQUE (principal_id, topic, subtopic)
);

CREATE TABLE learner_reflections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    learner_journal_page_id UUID NOT NULL REFERENCES learner_journal_pages(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    play_run_id UUID NOT NULL,
    title TEXT NOT NULL,
    question TEXT NOT NULL,
    reflection TEXT NOT NULL,
    response_type TEXT NOT NULL DEFAULT 'reflection',
    response_context TEXT,
    is_independent_check BOOLEAN NOT NULL DEFAULT FALSE,
    observed_cues JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_reflections_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT learner_reflections_question_not_blank CHECK (btrim(question) <> ''),
    CONSTRAINT learner_reflections_reflection_not_blank CHECK (btrim(reflection) <> ''),
    CONSTRAINT learner_reflections_response_type_check CHECK (response_type IN ('reflection', 'explain', 'transfer')),
    CONSTRAINT learner_reflections_observed_cues_array_check CHECK (observed_cues IS NULL OR jsonb_typeof(observed_cues) = 'array')
);

CREATE INDEX learner_reflections_principal_activity_created_idx
    ON learner_reflections (principal_id, activity_id, created_at DESC, id DESC);

CREATE INDEX learner_reflections_journal_page_created_idx
    ON learner_reflections (learner_journal_page_id, created_at DESC, id DESC);

-- Fresh orientation content demonstrates only the base reflection flow. More
-- demanding original variants (review comparison, transfer and independent
-- checks) require their own contracts; this seed must not imply support for
-- them before that work exists.
INSERT INTO learning_activities (
    id,
    route_id,
    slug,
    title,
    description,
    position,
    published_at,
    activity_type,
    activity_config
)
SELECT
    gen_random_uuid(),
    route_id,
    'reflect-on-direction',
    'Connect the direction',
    'Keep a private note about what feels useful to explore next.',
    position + 1,
    published_at,
    'reflection',
    jsonb_build_object(
        'prompt', 'What feels clearer about the direction you want to explore?',
        'note', 'This response stays in your private journal.',
        'topic', 'Orientation',
        'subtopic', 'Choosing a direction'
    )
FROM learning_activities
WHERE slug = 'consider-a-direction'
ON CONFLICT (route_id, slug) DO NOTHING;

INSERT INTO learning_activity_transitions (
    from_activity_id,
    to_activity_id,
    from_connector,
    to_connector,
    trigger,
    trigger_value,
    label
)
SELECT
    question.id,
    reflection.id,
    'choice',
    'in',
    'outcome',
    outcome.key,
    'Keep a private note'
FROM learning_activities AS question
INNER JOIN learning_activities AS reflection
    ON reflection.route_id = question.route_id
    AND reflection.slug = 'reflect-on-direction'
CROSS JOIN (VALUES ('choice'), ('sequence')) AS outcome(key)
WHERE question.slug = 'consider-a-direction'
ON CONFLICT (from_activity_id, from_connector, trigger, trigger_value) DO NOTHING;

COMMENT ON TABLE learner_journal_pages IS
    'Private learner-owned journal pages. They are never part of World snapshots or public activity data.';
COMMENT ON TABLE learner_reflections IS
    'Private structured reflection evidence tied to an authorized server-owned play run.';
