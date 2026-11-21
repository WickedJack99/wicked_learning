-- Source direct-node questions persist private feedback without a play run.
ALTER TABLE learner_question_answers ALTER COLUMN play_run_id DROP NOT NULL;
COMMENT ON TABLE learner_question_answers IS
    'Private learner answer attempts authorized by an owned play run or a currently playable node. Direct answers have no play run or Recall effect.';
