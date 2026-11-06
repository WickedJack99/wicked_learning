-- Preserve the source peer-message response vocabulary and the learner-owned
-- single helpful marker before exposing a peer wall. Private Learning Support
-- does not use either field, so this is additive to the existing safe slice.
ALTER TABLE learner_message_responses
    ADD COLUMN response_type TEXT,
    ADD COLUMN helpful_at TIMESTAMPTZ,
    ADD CONSTRAINT learner_message_responses_response_type_check
        CHECK (response_type IN ('explanation', 'example', 'question', 'counterexample'));

CREATE INDEX learner_message_responses_helpful_message_idx
    ON learner_message_responses (message_id, helpful_at DESC, created_at DESC, id DESC)
    WHERE helpful_at IS NOT NULL AND hidden_at IS NULL;

COMMENT ON COLUMN learner_message_responses.response_type IS
    'Optional source-defined peer response vocabulary; private support replies remain untyped.';

COMMENT ON COLUMN learner_message_responses.helpful_at IS
    'One learner-owned response per peer message may be marked helpful; enforced by the future command.';
