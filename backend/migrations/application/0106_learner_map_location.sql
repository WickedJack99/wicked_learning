-- Private orientation preference, revalidated against current map visibility
-- on every read. It grants no access and is independent of learning evidence.
CREATE TABLE learner_map_locations (
    principal_id UUID PRIMARY KEY REFERENCES application_principals(id) ON DELETE CASCADE,
    map_id UUID NOT NULL REFERENCES learning_maps(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX learner_map_locations_map_id_idx ON learner_map_locations (map_id);
