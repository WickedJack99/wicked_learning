-- Question configuration is authored data. Correctness keys and detailed
-- feedback never belong to a broad World snapshot or a browser-controlled
-- completion request; the playback repository projects a learner-safe view.
CREATE TABLE learner_question_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    play_run_id UUID NOT NULL,
    selected_option_keys JSONB NOT NULL,
    is_correct BOOLEAN NOT NULL,
    confidence TEXT,
    calibration TEXT,
    attempt_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_question_answers_selected_option_keys_array_check
        CHECK (jsonb_typeof(selected_option_keys) = 'array'),
    CONSTRAINT learner_question_answers_confidence_check
        CHECK (confidence IS NULL OR confidence IN ('exploring', 'leaning', 'settled')),
    CONSTRAINT learner_question_answers_calibration_check
        CHECK (calibration IS NULL OR calibration IN ('aligned', 'stronger_than_expected', 'higher_than_result', 'uncertainty_made_gap_visible')),
    CONSTRAINT learner_question_answers_attempt_number_check CHECK (attempt_number > 0),
    CONSTRAINT learner_question_answers_run_activity_attempt_unique
        UNIQUE (principal_id, play_run_id, activity_id, attempt_number)
);

CREATE INDEX learner_question_answers_history_idx
    ON learner_question_answers (principal_id, activity_id, created_at DESC, id DESC);

-- Fresh orientation data exercises the full question boundary. It is not an
-- import of Laravel records and has no compatibility identifier.
UPDATE learning_activities
SET
    activity_type = 'question',
    activity_config = '{
        "prompt": "Which statement best keeps exploration learner-directed?",
        "allowMultiple": false,
        "feedbackCorrect": "Keeping the choice visible lets the learner decide their next useful direction.",
        "feedbackIncorrect": "Try again by looking for the option that preserves learner choice.",
        "explanation": "Maps are for orientation and choice, not a hidden sequence or ranking.",
        "options": [
            {"key": "keep-choice-visible", "label": "A", "body": "Keep useful next choices visible.", "isCorrect": true, "feedback": "This keeps the learner in charge of the next direction.", "outcomeKey": "choice"},
            {"key": "hide-other-routes", "label": "B", "body": "Hide all other routes until one prescribed route is complete.", "isCorrect": false, "feedback": "That would turn exploration into a compulsory sequence.", "outcomeKey": "sequence"}
        ]
    }'::jsonb
WHERE slug = 'consider-a-direction';

COMMENT ON TABLE learner_question_answers IS
    'Private learner answer attempts. Correctness is evaluated only in the application transaction that owns the active play run.';
