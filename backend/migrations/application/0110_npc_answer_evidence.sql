-- Source NPC answers retain the selected authored facts separately from the
-- transient cursor. An answer is an encounter, not a competence claim.
CREATE TABLE learner_npc_dialogue_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    play_run_id UUID NOT NULL,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    question_node_id UUID NOT NULL,
    answer_node_id UUID NOT NULL,
    answer_label TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (activity_id, question_node_id)
        REFERENCES learning_npc_dialogue_nodes(activity_id, id) ON DELETE CASCADE
);
CREATE INDEX learner_npc_dialogue_answers_owner_activity
    ON learner_npc_dialogue_answers(principal_id, activity_id, created_at DESC, id DESC);

-- Source discovery metadata keeps effects after their authoring node is
-- removed. Null provenance preserves that behavior without dangling foreign keys.
CREATE TABLE learner_node_answer_events (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES learning_nodes(id) ON DELETE CASCADE,
    event_kind TEXT NOT NULL CHECK (event_kind IN ('hidden', 'unlocked')),
    source_activity_id UUID REFERENCES learning_activities(id) ON DELETE SET NULL,
    source_answer_node_id UUID REFERENCES learning_npc_dialogue_nodes(id) ON DELETE SET NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, node_id, event_kind)
);

COMMENT ON COLUMN learner_npc_dialogue_answers.answer_node_id IS
    'Historical selected-answer UUID, like source answer_key; deleting a selected answer does not erase a snapshot while its question still exists.';
COMMENT ON TABLE learner_node_answer_events IS
    'Private authored NPC answer effects. Repeated effects preserve their first timestamp and update only provenance; they are not manual/tool unlocks.';
