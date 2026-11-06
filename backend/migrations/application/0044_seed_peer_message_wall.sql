-- A fresh, source-shaped peer wall makes the migrated learner flow reachable
-- after the private support prompt. It is demonstration content only; no
-- Laravel messages or identities are imported.
INSERT INTO learning_message_topics (id, map_asset_id, slug, title)
VALUES (
    '00000000-0000-4000-8000-000000000044',
    '00000000-0000-4000-8000-000000000003',
    'orientation-notes',
    'Orientation notes'
)
ON CONFLICT (map_asset_id, slug) DO NOTHING;

INSERT INTO learning_activities (
    id, route_id, slug, title, description, position, published_at, activity_type, activity_config
)
VALUES (
    '00000000-0000-4000-8000-000000000045',
    '00000000-0000-4000-8000-000000000005',
    'explore-peer-wall',
    'Explore peer notes',
    'Read a few anonymous observations from other learners and optionally respond.',
    3,
    NOW(),
    'message_wall',
    jsonb_build_object(
        'messageTopicId', '00000000-0000-4000-8000-000000000044',
        'messageAudience', 'peers',
        'messageAllowResponses', true,
        'messagePrompt', 'What did you notice while finding your place on this map?',
        'messageInputLabel', 'Your note',
        'messageResponsePrompt', 'Offer a small clue, example, question or counterexample.',
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

INSERT INTO learning_activity_transitions (
    from_activity_id, to_activity_id, from_connector, to_connector, trigger, label
)
VALUES (
    '00000000-0000-4000-8000-000000000043',
    '00000000-0000-4000-8000-000000000045',
    'completed',
    'in',
    'completed',
    'Explore peer notes'
)
ON CONFLICT (from_activity_id, from_connector, trigger, trigger_value) DO NOTHING;

COMMENT ON TABLE learner_message_responses IS
    'One visible peer response per learner and message; the original message author may mark one visible response helpful.';
