-- These durable authoring facts are introduced before the selected-node read
-- contract. They are deliberately separate from learner playback data: future
-- World Builder mutations will validate and version them in their own slice.
ALTER TABLE learning_nodes
    ADD COLUMN activity_graph_layout JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD CONSTRAINT learning_nodes_activity_graph_layout_object_check
        CHECK (jsonb_typeof(activity_graph_layout) = 'object');

ALTER TABLE learning_activities
    ADD COLUMN introduction TEXT,
    ADD COLUMN graph_position_x DOUBLE PRECISION,
    ADD COLUMN graph_position_y DOUBLE PRECISION,
    ADD COLUMN ai_review_status TEXT NOT NULL DEFAULT 'needs_review',
    ADD COLUMN ai_reviewed_at TIMESTAMPTZ,
    ADD COLUMN ai_review JSONB,
    ADD CONSTRAINT learning_activities_ai_review_status_check
        CHECK (ai_review_status IN ('needs_review', 'reviewed')),
    ADD CONSTRAINT learning_activities_ai_review_object_check
        CHECK (ai_review IS NULL OR jsonb_typeof(ai_review) = 'object');

CREATE INDEX learning_activities_ai_review_status_index
    ON learning_activities (ai_review_status);

ALTER TABLE learning_sounds
    ADD COLUMN icon TEXT;

-- Source records and concepts are reusable authoring catalog data. They have
-- fresh UUID identities and no legacy-data import or browser write surface.
CREATE TABLE learning_source_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    publisher TEXT,
    published_at DATE,
    rights TEXT,
    anchor TEXT,
    excerpt TEXT,
    concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_source_records_title_length CHECK (char_length(title) BETWEEN 1 AND 160),
    CONSTRAINT learning_source_records_url_length CHECK (char_length(url) BETWEEN 1 AND 2048),
    CONSTRAINT learning_source_records_publisher_length CHECK (publisher IS NULL OR char_length(publisher) <= 160),
    CONSTRAINT learning_source_records_rights_length CHECK (rights IS NULL OR char_length(rights) <= 240),
    CONSTRAINT learning_source_records_anchor_length CHECK (anchor IS NULL OR char_length(anchor) <= 240),
    CONSTRAINT learning_source_records_excerpt_length CHECK (excerpt IS NULL OR char_length(excerpt) <= 800),
    CONSTRAINT learning_source_records_concepts_array_check CHECK (jsonb_typeof(concepts) = 'array')
);

CREATE INDEX learning_source_records_title_index
    ON learning_source_records (title, id);

CREATE TABLE learning_concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_concepts_slug_check CHECK (slug ~ '^[a-z0-9-]{1,140}$'),
    CONSTRAINT learning_concepts_name_length CHECK (char_length(name) BETWEEN 1 AND 120)
);

CREATE INDEX learning_concepts_active_name_index
    ON learning_concepts (is_active, name, id);

COMMENT ON COLUMN learning_nodes.activity_graph_layout IS
    'Authoring-only layout for the activity graph; never learner playback policy.';
COMMENT ON TABLE learning_source_records IS
    'Reusable source catalog for authoring. It contains no imported Laravel records.';
