CREATE TABLE learning_map_versions (
    id UUID PRIMARY KEY,
    map_id UUID NOT NULL REFERENCES learning_maps(id) ON DELETE CASCADE,
    changed_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    topic_id UUID REFERENCES learning_topics(id) ON DELETE SET NULL,
    map_assets_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX learning_map_versions_map_created_idx
    ON learning_map_versions (map_id, created_at DESC, id DESC);
