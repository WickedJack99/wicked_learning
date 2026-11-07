-- World Builder reads and writes must apply the source's map scope before
-- returning any authored graph data. A role's own/assigned/all permission is
-- evaluated against these fresh application facts; it must not be inferred
-- from learner-visible map access.
ALTER TABLE learning_maps
    ADD COLUMN created_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL;

CREATE INDEX learning_maps_created_by_principal_index
    ON learning_maps (created_by_principal_id);

CREATE TABLE learning_map_editing_groups (
    map_id UUID NOT NULL REFERENCES learning_maps(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES learning_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (map_id, group_id)
);

CREATE INDEX learning_map_editing_groups_group_map_index
    ON learning_map_editing_groups (group_id, map_id);

COMMENT ON TABLE learning_map_editing_groups IS
    'Explicit learning-group assignments allowed to edit a map. Membership is
     checked at the API boundary alongside the server-owned role scope.';
