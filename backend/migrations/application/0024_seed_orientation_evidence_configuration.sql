-- The greenfield Orientation activities were already the local playback
-- example. Give their server-owned authored configuration the same bounded
-- competence metadata that the source completion service reads. This does not
-- expose a competence screen or award a score; evidence is written only after
-- an authorized completion in a new or resumed play run.
UPDATE learning_activities
SET activity_config = activity_config || jsonb_build_object(
    'competenceTopics', jsonb_build_array(
        jsonb_build_object('topic', 'Orientation', 'slug', 'orientation', 'weight', 1)
    ),
    'learningIntent', CASE activity_type
        WHEN 'question' THEN 'retrieve'
        WHEN 'reflection' THEN 'reflect'
        ELSE 'participate'
    END,
    'evidenceObjective', CASE slug
        WHEN 'find-your-place' THEN 'Notice the map context before deciding where to explore.'
        WHEN 'name-a-landmark' THEN 'Choose one place that could support later orientation.'
        WHEN 'consider-a-direction' THEN 'Recognize the choice that keeps exploration learner-directed.'
        WHEN 'reflect-on-direction' THEN 'Describe what feels clearer about a useful direction.'
        ELSE 'Use the orientation activity to choose a useful next direction.'
    END
)
WHERE slug IN (
    'find-your-place',
    'name-a-landmark',
    'consider-a-direction',
    'reflect-on-direction'
);
