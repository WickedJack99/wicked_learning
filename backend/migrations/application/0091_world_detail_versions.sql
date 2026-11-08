CREATE TABLE learning_world_versions (
    id UUID PRIMARY KEY,
    world_id UUID NOT NULL REFERENCES learning_worlds(id) ON DELETE CASCADE,
    changed_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX learning_world_versions_world_created_idx
    ON learning_world_versions (world_id, created_at DESC, id DESC);
