ALTER TABLE learning_nodes
    DROP CONSTRAINT learning_nodes_state_check;

ALTER TABLE learning_nodes
    ADD CONSTRAINT learning_nodes_state_check
    CHECK (state IN ('active', 'available', 'completed', 'hidden', 'hinted', 'locked', 'recommended'));

COMMENT ON COLUMN learning_nodes.state IS
    'Source-compatible authoring state. Only hidden and locked alter the current learner availability policy; the remaining source states are visible.';
