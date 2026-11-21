-- Source check-ins belong to completed learner/activity facts. Direct node
-- playback has no run; retain existing run IDs without inventing new ones.
ALTER TABLE learner_activity_check_ins ALTER COLUMN play_run_id DROP NOT NULL;
