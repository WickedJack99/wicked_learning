-- A review run is immutable audit history. Retain the run if its reusable
-- helper is later removed, while preventing references to unknown templates.
ALTER TABLE learning_activity_review_runs
    ADD CONSTRAINT learning_activity_review_runs_agent_template_id_fkey
    FOREIGN KEY (agent_template_id)
    REFERENCES ai_agent_templates(id)
    ON DELETE SET NULL;
