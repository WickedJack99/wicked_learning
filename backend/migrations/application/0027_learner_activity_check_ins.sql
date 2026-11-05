-- Private learner check-ins are individual observations, not mutable progress
-- metadata. A later browser reader can preserve the source's bounded history
-- without returning another learner's observations.
CREATE TABLE learner_activity_check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    play_run_id UUID NOT NULL,
    feeling TEXT,
    note TEXT,
    next_direction TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_activity_check_ins_feeling_check
        CHECK (feeling IS NULL OR feeling IN ('clearer', 'forming', 'stretched', 'stuck')),
    CONSTRAINT learner_activity_check_ins_note_not_blank_check
        CHECK (note IS NULL OR btrim(note) <> ''),
    CONSTRAINT learner_activity_check_ins_next_direction_check
        CHECK (next_direction IS NULL OR next_direction IN ('revisit', 'related', 'settle')),
    CONSTRAINT learner_activity_check_ins_not_empty_check
        CHECK (feeling IS NOT NULL OR note IS NOT NULL OR next_direction IS NOT NULL)
);

CREATE INDEX learner_activity_check_ins_principal_activity_recorded_index
    ON learner_activity_check_ins (principal_id, activity_id, recorded_at DESC, id DESC);

ALTER TABLE learner_activity_progress
    ADD COLUMN revisit_status TEXT NOT NULL DEFAULT 'none',
    ADD COLUMN revisit_available_at TIMESTAMPTZ,
    ADD COLUMN revisit_check_in_id UUID REFERENCES learner_activity_check_ins(id) ON DELETE SET NULL,
    ADD CONSTRAINT learner_activity_progress_revisit_status_check
        CHECK (revisit_status IN ('none', 'pending', 'snoozed', 'dismissed'));

CREATE INDEX learner_activity_progress_due_revisit_index
    ON learner_activity_progress (principal_id, revisit_available_at DESC)
    WHERE revisit_status IN ('pending', 'snoozed') AND revisit_available_at IS NOT NULL;
