-- Correct the initial peer-wall demonstration topology to match the source:
-- a learner contributes at a peer message prompt before the later wall shows
-- peer writing. Migration 0044 was already applied to local development data,
-- so this is an explicit forward-only correction rather than an edited history.
INSERT INTO learning_message_topics (id, map_asset_id, slug, title)
VALUES (
    '00000000-0000-4000-8000-000000000046',
    '00000000-0000-4000-8000-000000000003',
    'orientation-peer-contributions',
    'Orientation notes'
)
ON CONFLICT (map_asset_id, slug) DO NOTHING;

INSERT INTO learning_activities (
    id, route_id, slug, title, description, position, published_at, activity_type, activity_config
)
VALUES (
    '00000000-0000-4000-8000-000000000047',
    '00000000-0000-4000-8000-000000000005',
    'share-orientation-note',
    'Share an orientation note',
    'Optionally leave one anonymous observation for other learners.',
    3,
    NOW(),
    'message_prompt',
    jsonb_build_object(
        'messageTopicId', '00000000-0000-4000-8000-000000000046',
        'messageAudience', 'peers',
        'messagePrompt', 'What did you notice while finding your place on this map?',
        'messageInputLabel', 'Your note',
        'messageUi', jsonb_build_object(
            'surfaceColorDark', '#071018',
            'surfaceColorLight', '#e6f5f2',
            'cardColorDark', '#13262d',
            'cardColorLight', '#ffffff',
            'accentColorDark', '#5eead4',
            'accentColorLight', '#0f766e'
        )
    )
)
ON CONFLICT (route_id, slug) DO NOTHING;

UPDATE learning_activities
SET
    position = 4,
    activity_config = jsonb_set(
        activity_config,
        '{messageTopicId}',
        to_jsonb('00000000-0000-4000-8000-000000000046'::text)
    )
WHERE id = '00000000-0000-4000-8000-000000000045';

DELETE FROM learning_activity_transitions
WHERE from_activity_id = '00000000-0000-4000-8000-000000000043'
  AND from_connector = 'completed'
  AND trigger = 'completed'
  AND trigger_value IS NULL;

INSERT INTO learning_activity_transitions (
    from_activity_id, to_activity_id, from_connector, to_connector, trigger, label
)
VALUES
    (
        '00000000-0000-4000-8000-000000000043',
        '00000000-0000-4000-8000-000000000047',
        'completed', 'in', 'completed', 'Share an orientation note'
    ),
    (
        '00000000-0000-4000-8000-000000000047',
        '00000000-0000-4000-8000-000000000045',
        'completed', 'in', 'completed', 'Explore peer notes'
    )
ON CONFLICT (from_activity_id, from_connector, trigger, trigger_value) DO NOTHING;
