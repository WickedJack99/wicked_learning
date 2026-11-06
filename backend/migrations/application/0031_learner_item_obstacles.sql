-- Source item-obstacle state persists per learner/activity, while an opaque
-- route run authorizes each command. Filled slots are normalized so one item
-- consumption has one durable, auditable fact.
CREATE TABLE learner_item_obstacle_states (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    passed_play_run_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, activity_id),
    CONSTRAINT learner_item_obstacle_states_failed_attempts_check CHECK (failed_attempts >= 0)
);

CREATE TABLE learner_item_obstacle_slots (
    principal_id UUID NOT NULL,
    activity_id UUID NOT NULL,
    slot_index SMALLINT NOT NULL,
    item_id UUID NOT NULL REFERENCES learning_items(id) ON DELETE RESTRICT,
    filled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, activity_id, slot_index),
    CONSTRAINT learner_item_obstacle_slots_state_fk
        FOREIGN KEY (principal_id, activity_id)
        REFERENCES learner_item_obstacle_states(principal_id, activity_id)
        ON DELETE CASCADE,
    CONSTRAINT learner_item_obstacle_slots_index_check CHECK (slot_index BETWEEN 0 AND 9)
);
