-- A portal is an authored cross-place connection, not a browser-selected map
-- link.  The source activity and destination entry activity remain explicit
-- so the learner command can validate the complete travel boundary.
CREATE TABLE learning_portal_links (
    source_activity_id UUID PRIMARY KEY REFERENCES learning_activities(id) ON DELETE CASCADE,
    target_activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES learning_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES learning_nodes(id) ON DELETE CASCADE,
    label TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_portal_links_distinct_nodes CHECK (source_node_id <> target_node_id)
);

CREATE INDEX learning_portal_links_target_activity_idx
    ON learning_portal_links (target_activity_id);

-- An arrival is distinct from a target route start. It permits the source
-- portal's authored input scene to be displayed without resetting or joining
-- any in-progress route that happens to be offered at the destination.
CREATE TABLE learner_portal_arrival_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    source_play_run_id UUID NOT NULL,
    source_activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    target_activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_portal_arrival_runs_status_check
        CHECK (status IN ('in_progress', 'completed')),
    CONSTRAINT learner_portal_arrival_runs_completed_at_check
        CHECK ((status = 'in_progress' AND completed_at IS NULL)
            OR (status = 'completed' AND completed_at IS NOT NULL)),
    CONSTRAINT learner_portal_arrival_runs_source_unique
        UNIQUE (principal_id, source_play_run_id, source_activity_id)
);

CREATE INDEX learner_portal_arrival_runs_principal_target_idx
    ON learner_portal_arrival_runs (principal_id, target_activity_id, started_at DESC);

-- Fresh demonstration content for the source-derived Portal scene. It is
-- deliberately independent of the orientation route and legacy data.
INSERT INTO learning_maps (
    id, world_id, slug, title, description, position, published_at,
    background_config, grid_config
)
VALUES (
    '00000000-0000-4000-8000-000000000049',
    '00000000-0000-4000-8000-000000000001',
    'quiet-library',
    'Quiet Library',
    'A nearby place reached through a connected portal.',
    1,
    NOW(),
    '{"pageBackground":"#0b1117","panelBackground":"rgba(7, 17, 31, 0.82)","panelTextColor":"#e2e8f0","accentColor":"#5eead4"}'::jsonb,
    '{"tileWidth":96,"tileHeight":84,"gap":8}'::jsonb
)
ON CONFLICT (world_id, slug) DO NOTHING;

INSERT INTO learning_map_assets (
    id, map_id, slug, title, description, position_x, position_y, position_z,
    interaction_mode, published_at, width, opacity, visual_config
)
VALUES (
    '00000000-0000-4000-8000-000000000050',
    '00000000-0000-4000-8000-000000000049',
    'return-gate',
    'Return Gate',
    'An arrival gate in the Quiet Library.',
    50, 50, 0,
    'focusable', NOW(), 22, 1,
    '{"icon":"orbit","label":"Return Gate","tileColor":"#19312b","foregroundColor":"#bbf7d0"}'::jsonb
)
ON CONFLICT (map_id, slug) DO NOTHING;

INSERT INTO learning_nodes (
    id, map_id, map_asset_id, slug, title, description, position_q, position_r,
    state, visual_config, published_at
)
VALUES (
    '00000000-0000-4000-8000-000000000051',
    '00000000-0000-4000-8000-000000000049',
    '00000000-0000-4000-8000-000000000050',
    'return-gate',
    'Return Gate',
    'Arrive here from the First Path portal.',
    0, 0, 'available',
    '{"icon":"orbit","label":"Return Gate","tileColor":"#19312b","foregroundColor":"#bbf7d0"}'::jsonb,
    NOW()
)
ON CONFLICT (map_id, slug) DO NOTHING;

INSERT INTO learning_routes (
    id, map_asset_id, slug, title, description, position, published_at
)
VALUES
    (
        '00000000-0000-4000-8000-000000000052',
        '00000000-0000-4000-8000-000000000004',
        'step-through-the-gate',
        'Step through the gate',
        'Travel to a connected place, then return to the map.',
        20, NOW()
    ),
    (
        '00000000-0000-4000-8000-000000000053',
        '00000000-0000-4000-8000-000000000050',
        'arrive-at-the-gate',
        'Arrive at the gate',
        'A short arrival scene at the connected place.',
        0, NOW()
    )
ON CONFLICT (map_asset_id, slug) DO NOTHING;

INSERT INTO learning_activities (
    id, route_id, slug, title, description, position, published_at, activity_type, activity_config
)
VALUES
    (
        '00000000-0000-4000-8000-000000000054',
        '00000000-0000-4000-8000-000000000052',
        'prepare-for-travel',
        'Prepare for travel',
        'Use the gate to move to a connected learning place.',
        0, NOW(), 'portal',
        jsonb_build_object(
            'portalMode', 'output',
            'portalBackgroundDark', '/images/themes/npc-dialogue-background-dark.svg',
            'portalBackgroundLight', '/images/themes/npc-dialogue-background-light.svg',
            'portalForegroundDark', '/images/portals/portal-swirl.png',
            'portalForegroundLight', '/images/portals/portal-swirl.png',
            'portalForegroundX', 58,
            'portalForegroundY', 45,
            'portalForegroundWidth', 28,
            'portalSwirlEnabled', true,
            'portalBubbleText', 'A connected place is ready when you are. Travel is a choice, not a requirement.'
        )
    ),
    (
        '00000000-0000-4000-8000-000000000055',
        '00000000-0000-4000-8000-000000000053',
        'arrive-through-the-gate',
        'Arrive through the gate',
        'Take a moment to orient yourself at the arrival place.',
        0, NOW(), 'portal',
        jsonb_build_object(
            'portalMode', 'input',
            'portalBackgroundDark', '/images/themes/npc-dialogue-background-dark.svg',
            'portalBackgroundLight', '/images/themes/npc-dialogue-background-light.svg',
            'portalForegroundDark', '/images/portals/portal-swirl.png',
            'portalForegroundLight', '/images/portals/portal-swirl.png',
            'portalForegroundX', 42,
            'portalForegroundY', 48,
            'portalForegroundWidth', 28,
            'portalSwirlEnabled', true,
            'portalBubbleText', 'You have arrived. Take a look around before choosing what comes next.'
        )
    )
ON CONFLICT (route_id, slug) DO NOTHING;

INSERT INTO learning_activity_starts (
    id, node_id, activity_id, label, description, sort_order
)
VALUES
    (
        '00000000-0000-4000-8000-000000000056',
        '00000000-0000-4000-8000-000000000011',
        '00000000-0000-4000-8000-000000000054',
        'Step through the gate',
        'Travel through a connected portal to another place.',
        20
    ),
    (
        '00000000-0000-4000-8000-000000000057',
        '00000000-0000-4000-8000-000000000051',
        '00000000-0000-4000-8000-000000000055',
        'Arrive through the gate',
        'Open the arrival scene for this connected place.',
        0
    )
ON CONFLICT (node_id, activity_id) DO NOTHING;

INSERT INTO learning_portal_links (
    source_activity_id, target_activity_id, source_node_id, target_node_id, label, description
)
VALUES (
    '00000000-0000-4000-8000-000000000054',
    '00000000-0000-4000-8000-000000000055',
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000051',
    'First Path to Quiet Library',
    'A portal pair connecting the first path with the Quiet Library.'
)
ON CONFLICT (source_activity_id) DO NOTHING;
