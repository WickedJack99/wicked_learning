-- A completed revisit can be a private reflection response. Preserve its
-- source-derived response type on the immutable review attempt so the
-- competence reader can describe the attempt without inspecting reflection
-- text or mutable activity configuration.
ALTER TABLE learner_review_attempts
    ADD COLUMN response_type TEXT,
    ADD CONSTRAINT learner_review_attempts_response_type_check
        CHECK (response_type IS NULL OR response_type IN ('reflection', 'explain', 'transfer'));

COMMENT ON COLUMN learner_review_attempts.response_type IS
    'Source-derived response type of the latest private reflection saved for this completed revisit, when applicable.';
