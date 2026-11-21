-- A terminal dialogue reflection has no next cursor. Its saved node identity
-- lets completion distinguish it from another reflection in the same activity.
ALTER TABLE learner_reflections
    ADD COLUMN npc_dialogue_node_id UUID
        REFERENCES learning_npc_dialogue_nodes(id) ON DELETE SET NULL;

CREATE INDEX learner_reflections_npc_node_index
    ON learner_reflections (npc_dialogue_node_id, principal_id, play_run_id, activity_id)
    WHERE npc_dialogue_node_id IS NOT NULL;
