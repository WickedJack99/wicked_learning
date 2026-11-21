-- Keep source-content deletion and provenance nulling indexed as private
-- answer/event history grows across learners. Owner reads use the existing PK.
CREATE INDEX learner_npc_dialogue_answers_question
    ON learner_npc_dialogue_answers(activity_id, question_node_id);
CREATE INDEX learner_node_answer_events_activity
    ON learner_node_answer_events(source_activity_id)
    WHERE source_activity_id IS NOT NULL;
CREATE INDEX learner_node_answer_events_answer
    ON learner_node_answer_events(source_answer_node_id)
    WHERE source_answer_node_id IS NOT NULL;
