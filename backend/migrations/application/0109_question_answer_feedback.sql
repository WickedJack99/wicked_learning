-- The source retains the feedback shown when an answer was recorded. Old
-- native answers did not retain that text; do not backfill invented history.
ALTER TABLE learner_question_answers
    ADD COLUMN feedback TEXT,
    ADD COLUMN feedback_recorded BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN learner_question_answers.feedback_recorded IS
    'Distinguishes a recorded null feedback from legacy answers whose feedback was not retained. Canonical latest-answer projection requires a recorded snapshot.';
