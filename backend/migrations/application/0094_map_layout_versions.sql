CREATE TABLE learning_map_layout_versions (
    id UUID PRIMARY KEY,
    map_id UUID NOT NULL REFERENCES learning_maps(id) ON DELETE CASCADE,
    changed_by_principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE RESTRICT,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX learning_map_layout_versions_map_created_idx
    ON learning_map_layout_versions (map_id, created_at DESC, id DESC);

COMMENT ON TABLE learning_map_layout_versions IS
    'Immutable source-shaped hex-grid node placement snapshots for one authored map.';
