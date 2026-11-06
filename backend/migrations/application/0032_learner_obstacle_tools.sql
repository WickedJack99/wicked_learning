-- Source `obstacle` activities distinguish a durable clear from a useful
-- current-run tool use. Keeping the facts separate preserves
-- persistAfterSolved=false without accidentally clearing later route runs.
CREATE TABLE learner_obstacle_resolutions (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, activity_id)
);

CREATE TABLE learner_obstacle_run_passes (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    play_run_id UUID NOT NULL,
    used_tool_id UUID NOT NULL REFERENCES learning_tools(id) ON DELETE RESTRICT,
    passed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, activity_id, play_run_id)
);
