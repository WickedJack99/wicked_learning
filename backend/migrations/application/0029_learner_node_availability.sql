-- Source-compatible learner availability state. Content and learner ownership
-- are deliberately normalized instead of reusing Laravel's JSON metadata
-- bucket: each fact can be authorized, revoked and queried independently.

CREATE TABLE learning_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    image_dark TEXT,
    image_light TEXT,
    animation_dark TEXT,
    animation_light TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_tools_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT learning_tools_config_object_check CHECK (jsonb_typeof(config) = 'object')
);

CREATE TABLE learner_tools (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES learning_tools(id) ON DELETE CASCADE,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, tool_id)
);

CREATE TABLE learning_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    image_dark TEXT,
    image_light TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_items_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT learning_items_config_object_check CHECK (jsonb_typeof(config) = 'object')
);

CREATE TABLE learner_item_holdings (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    acquired_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, item_id),
    CONSTRAINT learner_item_holdings_quantity_check CHECK (quantity >= 0)
);

CREATE TABLE learner_node_discoveries (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES learning_nodes(id) ON DELETE CASCADE,
    tool_id UUID REFERENCES learning_tools(id) ON DELETE SET NULL,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, node_id)
);

CREATE TABLE learner_node_tool_uses (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES learning_nodes(id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES learning_tools(id) ON DELETE CASCADE,
    used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, node_id, tool_id)
);

CREATE TABLE learner_node_manual_unlocks (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES learning_nodes(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    PRIMARY KEY (principal_id, node_id),
    CONSTRAINT learner_node_manual_unlocks_time_check CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE INDEX learner_node_discoveries_principal_id_idx
    ON learner_node_discoveries (principal_id, discovered_at DESC);
CREATE INDEX learner_node_tool_uses_principal_id_idx
    ON learner_node_tool_uses (principal_id, used_at DESC);
CREATE INDEX learner_node_manual_unlocks_active_principal_id_idx
    ON learner_node_manual_unlocks (principal_id, node_id)
    WHERE revoked_at IS NULL;
