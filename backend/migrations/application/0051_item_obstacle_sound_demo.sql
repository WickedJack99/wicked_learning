-- Fresh local content proving the source item-grant -> item-obstacle sequence
-- and its configured effect sounds. This is greenfield demonstration content,
-- not imported Laravel data.
INSERT INTO learning_items (
    id, slug, title, description, image_dark, image_light, published_at
)
VALUES (
    '20000000-0000-4000-8000-000000000001',
    'signal-stone',
    'Signal stone',
    'A small stone that belongs in the passage mechanism.',
    '/images/portals/portal-stone-blue.png',
    '/images/portals/portal-stone-blue.png',
    NOW()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO learning_routes (
    id, map_asset_id, slug, title, description, position, published_at
)
VALUES (
    '20000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
    'open-the-listening-passage',
    'Open the listening passage',
    'Collect one signal stone, then use it to open a small passage.',
    20,
    NOW()
)
ON CONFLICT (map_asset_id, slug) DO NOTHING;

INSERT INTO learning_activities (
    id, route_id, slug, title, description, position, published_at,
    activity_type, activity_config
)
VALUES
    (
        '20000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000002',
        'receive-the-signal-stone',
        'Receive the signal stone',
        'Take the one item needed for the nearby passage.',
        0,
        NOW(),
        'item_grant',
        jsonb_build_object(
            'items', jsonb_build_array(
                jsonb_build_object('itemId', 'signal-stone', 'quantity', 1)
            ),
            'probabilityPercent', 100
        )
    ),
    (
        '20000000-0000-4000-8000-000000000004',
        '20000000-0000-4000-8000-000000000002',
        'place-the-signal-stone',
        'Place the signal stone',
        'Fit the stone into the passage mechanism when it feels useful.',
        1,
        NOW(),
        'item_obstacle',
        jsonb_build_object(
            'slots', jsonb_build_array(
                jsonb_build_object(
                    'itemId', 'signal-stone',
                    'slotIndex', 0,
                    'width', 18,
                    'x', 50,
                    'y', 45
                )
            ),
            'sounds', jsonb_build_object(
                'notMet', jsonb_build_object(
                    'enabled', true,
                    'soundId', '00000000-0000-4000-8000-000000000059'
                ),
                'met', jsonb_build_object(
                    'enabled', true,
                    'soundId', '00000000-0000-4000-8000-000000000059'
                ),
                'transition', jsonb_build_object(
                    'enabled', true,
                    'soundId', '00000000-0000-4000-8000-000000000059'
                )
            )
        )
    )
ON CONFLICT (route_id, slug) DO NOTHING;

INSERT INTO learning_activity_starts (
    id, node_id, activity_id, label, description, image_dark, image_light,
    button_color_dark, button_border_color_dark, button_color_light,
    button_border_color_light, sort_order
)
VALUES (
    '20000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000010',
    '20000000-0000-4000-8000-000000000003',
    'Open the passage',
    'Collect a signal stone and use it at the passage mechanism.',
    '/images/portals/portal-stone-blue.png',
    '/images/portals/portal-stone-blue.png',
    '#0f172a', '#2dd4bf', '#ecfeff', '#0891b2', 20
)
ON CONFLICT (node_id, activity_id) DO NOTHING;

INSERT INTO learning_activity_transitions (
    from_activity_id, to_activity_id, from_connector, to_connector, trigger,
    label
)
VALUES (
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000004',
    'completed',
    'in',
    'completed',
    'Place the signal stone'
)
ON CONFLICT (from_activity_id, from_connector, trigger, trigger_value) DO NOTHING;
