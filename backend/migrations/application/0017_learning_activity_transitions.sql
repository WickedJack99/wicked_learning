-- Route progression is an authored graph. Do not infer a next activity from
-- position: the original application follows a completed transition and ends
-- only when that transition has no destination.
CREATE TABLE learning_activity_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    to_activity_id UUID REFERENCES learning_activities(id) ON DELETE SET NULL,
    from_connector TEXT NOT NULL DEFAULT 'completed',
    to_connector TEXT,
    trigger TEXT NOT NULL DEFAULT 'completed',
    trigger_value TEXT,
    label TEXT,
    rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_activity_transitions_connector_check
        CHECK (from_connector ~ '^[a-z][a-z0-9_-]{0,79}$'),
    CONSTRAINT learning_activity_transitions_trigger_check
        CHECK (trigger ~ '^[a-z][a-z0-9_-]{0,79}$'),
    CONSTRAINT learning_activity_transitions_rules_object_check
        CHECK (jsonb_typeof(rules) = 'object'),
    CONSTRAINT learning_activity_transitions_completed_unique
        UNIQUE NULLS NOT DISTINCT (from_activity_id, from_connector, trigger, trigger_value)
);

CREATE INDEX learning_activity_transitions_from_activity_idx
    ON learning_activity_transitions (from_activity_id);

-- The greenfield orientation content intentionally demonstrates one authored
-- edge and two terminal activities. It is not imported Laravel content.
UPDATE learning_activities
SET activity_config = CASE slug
    WHEN 'find-your-place' THEN jsonb_build_object(
        'nextStep',
        'Notice the map context before deciding where to explore.'
    )
    WHEN 'name-a-landmark' THEN jsonb_build_object(
        'nextStep',
        'Choose one place that could help you orient yourself later.'
    )
    WHEN 'consider-a-direction' THEN jsonb_build_object(
        'nextStep',
        'Compare available directions without ranking them or creating urgency.'
    )
    ELSE activity_config
END
WHERE activity_type = 'open_practice';

INSERT INTO learning_activity_transitions (
    from_activity_id,
    to_activity_id,
    from_connector,
    to_connector,
    trigger,
    label
)
SELECT
    from_activity.id,
    to_activity.id,
    'completed',
    'in',
    'completed',
    'Choose a landmark'
FROM learning_activities AS from_activity
INNER JOIN learning_activities AS to_activity
    ON to_activity.slug = 'name-a-landmark'
WHERE from_activity.slug = 'find-your-place'
ON CONFLICT (from_activity_id, from_connector, trigger, trigger_value) DO NOTHING;

COMMENT ON TABLE learning_activity_transitions IS
    'Authored within-route activity graph. Playback commands resolve these transitions server-side.';
