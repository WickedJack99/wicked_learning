-- The source editor persists each dialogue card's independent graph position.
-- Learner playback deliberately ignores these author-only coordinates.
ALTER TABLE learning_npc_dialogue_nodes
    ADD COLUMN graph_position_x DOUBLE PRECISION,
    ADD COLUMN graph_position_y DOUBLE PRECISION;

COMMENT ON COLUMN learning_npc_dialogue_nodes.graph_position_x IS
    'Author-only X coordinate for the source-compatible NPC dialogue graph editor.';
COMMENT ON COLUMN learning_npc_dialogue_nodes.graph_position_y IS
    'Author-only Y coordinate for the source-compatible NPC dialogue graph editor.';
