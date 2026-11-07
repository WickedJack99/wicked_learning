-- The original node editor carries a legacy preferred start in addition to
-- its ordered start-route list. Keep that authoring convenience distinct from
-- learner route selection and clear it if the referenced activity is removed.
ALTER TABLE learning_nodes
    ADD COLUMN start_activity_id UUID REFERENCES learning_activities(id) ON DELETE SET NULL;

COMMENT ON COLUMN learning_nodes.start_activity_id IS
    'Optional authoring preferred start activity. A portal exit is never exposed as startable.';
