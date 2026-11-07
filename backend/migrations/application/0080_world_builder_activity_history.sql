-- Activity history is authoring-only state. Each immutable snapshot captures
-- the editable activity fields and its outgoing graph edges before a change.
CREATE TABLE learning_activity_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    changed_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_activity_versions_snapshot_object_check
        CHECK (jsonb_typeof(snapshot) = 'object')
);

CREATE INDEX learning_activity_versions_activity_created_index
    ON learning_activity_versions (activity_id, created_at DESC, id DESC);

COMMENT ON TABLE learning_activity_versions IS
    'Immutable authoring snapshots used by the scoped Activity History restore workflow.';
