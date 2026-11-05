-- An item grant is a one-time chance roll for one learner, activity and
-- server-issued route run. Keeping it separate from mutable route metadata
-- makes retries idempotent while allowing a later run to roll again.
CREATE TABLE learner_item_grants (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    play_run_id UUID NOT NULL,
    roll INTEGER NOT NULL,
    chance_basis_points INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    granted_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    rolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, activity_id, play_run_id),
    CONSTRAINT learner_item_grants_roll_check CHECK (roll BETWEEN 1 AND 10000),
    CONSTRAINT learner_item_grants_chance_check CHECK (chance_basis_points BETWEEN 1 AND 10000),
    CONSTRAINT learner_item_grants_items_array_check CHECK (jsonb_typeof(granted_items) = 'array')
);

CREATE INDEX learner_item_grants_principal_activity_index
    ON learner_item_grants (principal_id, activity_id, rolled_at DESC);
