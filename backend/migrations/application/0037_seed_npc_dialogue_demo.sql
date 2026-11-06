-- A small fresh dialogue demonstrates the complete Rust player contract. It
-- is deliberately new greenfield orientation content, not Laravel data.
INSERT INTO learning_tools (
    id, slug, title, description, image_dark, image_light, published_at
)
VALUES (
    '10000000-0000-4000-8000-000000000001',
    'dialogue-lens',
    'Dialogue lens',
    'A small lens for noticing the useful part of an observation.',
    '/images/tools/pattern-lens-dark.svg',
    '/images/tools/pattern-lens-light.svg',
    NOW()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO learning_routes (
    id, map_asset_id, slug, title, description, position, published_at
)
VALUES (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
    'notice-with-mira',
    'Notice with Mira',
    'A short conversation that separates a useful observation from a quick assumption.',
    10,
    NOW()
)
ON CONFLICT (map_asset_id, slug) DO NOTHING;

INSERT INTO learning_activities (
    id, route_id, slug, title, description, position, published_at, activity_type, activity_config
)
VALUES (
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    'miras-observation',
    'Mira''s observation',
    'Follow a short conversation, choose an answer, and keep a private reflection.',
    0,
    NOW(),
    'npc_dialogue',
    '{}'::jsonb
)
ON CONFLICT (route_id, slug) DO NOTHING;

INSERT INTO learning_activity_starts (
    id, node_id, activity_id, label, description, image_dark, image_light,
    button_color_dark, button_border_color_dark, button_color_light, button_border_color_light, sort_order
)
VALUES (
    '10000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000010',
    '10000000-0000-4000-8000-000000000003',
    'Talk with Mira',
    'A short guided dialogue with one private note.',
    '/images/tools/pattern-lens-dark.svg',
    '/images/tools/pattern-lens-light.svg',
    '#0f172a', '#2dd4bf', '#ecfeff', '#0891b2', 10
)
ON CONFLICT (node_id, activity_id) DO NOTHING;

INSERT INTO learning_npc_dialogue_nodes (
    id, activity_id, node_type, title, body, node_config, sort_order
)
VALUES
    (
        '10000000-0000-4000-8000-000000000011',
        '10000000-0000-4000-8000-000000000003',
        'npc_monologue', 'Mira opens the observation',
        'Let us pause with a small observation. We are looking for what changes the next useful step.',
        '{"backgroundDark":"/images/themes/npc-dialogue-background-dark.svg","backgroundLight":"/images/themes/npc-dialogue-background-light.svg","bubbleColorDark":"rgba(15, 23, 42, 0.92)","bubbleColorLight":"rgba(255, 255, 255, 0.94)"}'::jsonb,
        10
    ),
    (
        '10000000-0000-4000-8000-000000000012',
        '10000000-0000-4000-8000-000000000003',
        'npc_question', 'Mira asks for the clue',
        'Several attempts began from different places. What is the useful clue?',
        '{"backgroundDark":"/images/themes/npc-dialogue-background-dark.svg","backgroundLight":"/images/themes/npc-dialogue-background-light.svg","toolId":"dialogue-lens"}'::jsonb,
        20
    ),
    (
        '10000000-0000-4000-8000-000000000013',
        '10000000-0000-4000-8000-000000000003',
        'answer', 'Pattern spread',
        'The attempts came from more than one starting point.',
        '{"answerLabel":"A","isCorrect":true}'::jsonb,
        30
    ),
    (
        '10000000-0000-4000-8000-000000000014',
        '10000000-0000-4000-8000-000000000003',
        'answer', 'One local mistake',
        'Only one place was affected, so this must be one local mistake.',
        '{"answerLabel":"B","isCorrect":false}'::jsonb,
        31
    ),
    (
        '10000000-0000-4000-8000-000000000015',
        '10000000-0000-4000-8000-000000000003',
        'reflection', 'Keep the useful clue',
        'What would you look for next after noticing the pattern?',
        '{"journalTopic":"Orientation","journalSubtopic":"Noticing patterns"}'::jsonb,
        40
    ),
    (
        '10000000-0000-4000-8000-000000000016',
        '10000000-0000-4000-8000-000000000003',
        'end', 'Observation complete',
        'You kept a clue for your next step.',
        '{}'::jsonb,
        50
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO learning_npc_dialogue_transitions (
    id, activity_id, from_node_id, to_node_id, from_connector
)
VALUES
    ('10000000-0000-4000-8000-000000000021', '10000000-0000-4000-8000-000000000003', NULL, '10000000-0000-4000-8000-000000000011', 'out'),
    ('10000000-0000-4000-8000-000000000022', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000012', 'out'),
    ('10000000-0000-4000-8000-000000000023', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000013', 'answer-1'),
    ('10000000-0000-4000-8000-000000000024', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000014', 'answer-2'),
    ('10000000-0000-4000-8000-000000000025', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000015', 'out'),
    ('10000000-0000-4000-8000-000000000026', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000015', 'out'),
    ('10000000-0000-4000-8000-000000000027', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000016', 'out')
ON CONFLICT (id) DO NOTHING;
