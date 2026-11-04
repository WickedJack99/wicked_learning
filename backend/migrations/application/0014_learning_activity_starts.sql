-- A route groups activities; a start places one eligible activity on a
-- particular node with its own learner-facing presentation. Keep this separate
-- so one route can later be offered differently from more than one location.
CREATE TABLE learning_activity_starts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES learning_nodes(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    label TEXT,
    description TEXT,
    image_dark TEXT,
    image_light TEXT,
    button_color_dark TEXT,
    button_border_color_dark TEXT,
    button_color_light TEXT,
    button_border_color_light TEXT,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_activity_starts_sort_order_check CHECK (sort_order >= 0),
    CONSTRAINT learning_activity_starts_node_activity_unique UNIQUE (node_id, activity_id)
);

-- Seed the small fresh orientation world with a start for each route's first
-- published activity. This is a local greenfield content projection, not a
-- migration of any Laravel application data.
INSERT INTO learning_activity_starts (
    node_id,
    activity_id,
    description,
    sort_order
)
SELECT
    nodes.id,
    first_activity.id,
    routes.description,
    routes.position
FROM learning_nodes AS nodes
INNER JOIN learning_map_assets AS assets ON assets.id = nodes.map_asset_id
INNER JOIN learning_routes AS routes ON routes.map_asset_id = assets.id
INNER JOIN LATERAL (
    SELECT activities.id
    FROM learning_activities AS activities
    WHERE activities.route_id = routes.id AND activities.published_at IS NOT NULL
    ORDER BY activities.position ASC, activities.slug ASC
    LIMIT 1
) AS first_activity ON TRUE
WHERE nodes.published_at IS NOT NULL AND assets.published_at IS NOT NULL AND routes.published_at IS NOT NULL
ON CONFLICT (node_id, activity_id) DO NOTHING;
