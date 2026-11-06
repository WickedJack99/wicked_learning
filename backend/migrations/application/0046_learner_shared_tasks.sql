-- Shared tasks are a separate learner-state boundary. They deliberately keep
-- contribution bodies, peer review and contributor-owned follow-up notes in
-- the application database; the identity database is never consulted for
-- learner-to-learner playback.
CREATE TABLE learner_shared_task_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    play_run_id UUID NOT NULL,
    body TEXT NOT NULL,
    revised_body TEXT,
    revised_at TIMESTAMPTZ,
    share_with_peers BOOLEAN NOT NULL DEFAULT FALSE,
    task_kind TEXT NOT NULL,
    project_step_index SMALLINT,
    validation_mode TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'accepted',
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_shared_task_submissions_body_not_blank CHECK (btrim(body) <> ''),
    CONSTRAINT learner_shared_task_submissions_body_length CHECK (char_length(body) <= 20000),
    CONSTRAINT learner_shared_task_submissions_revised_body_length CHECK (revised_body IS NULL OR (btrim(revised_body) <> '' AND char_length(revised_body) <= 20000)),
    CONSTRAINT learner_shared_task_submissions_task_kind_check CHECK (task_kind IN ('text', 'question', 'reflection')),
    CONSTRAINT learner_shared_task_submissions_project_step_check CHECK (project_step_index IS NULL OR project_step_index BETWEEN 0 AND 5),
    CONSTRAINT learner_shared_task_submissions_validation_mode_check CHECK (validation_mode IN ('minimum_length', 'none')),
    CONSTRAINT learner_shared_task_submissions_status_check CHECK (status = 'accepted')
);

CREATE INDEX learner_shared_task_submissions_activity_accepted_idx
    ON learner_shared_task_submissions (activity_id, accepted_at DESC, id DESC)
    WHERE status = 'accepted';
CREATE INDEX learner_shared_task_submissions_principal_activity_idx
    ON learner_shared_task_submissions (principal_id, activity_id, accepted_at DESC, id DESC)
    WHERE status = 'accepted';
CREATE INDEX learner_shared_task_submissions_shared_idx
    ON learner_shared_task_submissions (activity_id, accepted_at DESC, id DESC)
    WHERE status = 'accepted' AND share_with_peers;

CREATE TABLE learner_shared_task_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES learner_shared_task_submissions(id) ON DELETE CASCADE,
    reviewer_principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    response_type TEXT,
    project_step_index SMALLINT,
    helpful_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_shared_task_reviews_body_not_blank CHECK (btrim(body) <> ''),
    CONSTRAINT learner_shared_task_reviews_body_length CHECK (char_length(body) <= 2000),
    CONSTRAINT learner_shared_task_reviews_response_type_check CHECK (response_type IS NULL OR response_type IN ('explanation', 'example', 'question', 'counterexample')),
    CONSTRAINT learner_shared_task_reviews_project_step_check CHECK (project_step_index IS NULL OR project_step_index BETWEEN 0 AND 5),
    CONSTRAINT learner_shared_task_reviews_one_per_reviewer UNIQUE (activity_id, reviewer_principal_id)
);

CREATE INDEX learner_shared_task_reviews_submission_idx
    ON learner_shared_task_reviews (submission_id, created_at DESC, id DESC);
CREATE INDEX learner_shared_task_reviews_activity_helpful_idx
    ON learner_shared_task_reviews (activity_id, helpful_at DESC, id DESC)
    WHERE helpful_at IS NOT NULL;

CREATE TABLE learner_shared_task_review_follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    review_id UUID NOT NULL REFERENCES learner_shared_task_reviews(id) ON DELETE CASCADE,
    contributor_principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_shared_task_review_follow_ups_body_not_blank CHECK (btrim(body) <> ''),
    CONSTRAINT learner_shared_task_review_follow_ups_body_length CHECK (char_length(body) <= 2000),
    CONSTRAINT learner_shared_task_review_follow_ups_one_per_contributor UNIQUE (review_id, contributor_principal_id)
);

CREATE INDEX learner_shared_task_review_follow_ups_activity_contributor_idx
    ON learner_shared_task_review_follow_ups (activity_id, contributor_principal_id);

-- The source checklist is a private, per-run planning aid. It neither changes
-- the shared contribution threshold nor appears in another learner's state.
CREATE TABLE learner_shared_task_checklists (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    play_run_id UUID NOT NULL,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    completed_step_indexes SMALLINT[] NOT NULL DEFAULT '{}'::SMALLINT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, play_run_id, activity_id),
    CONSTRAINT learner_shared_task_checklists_length_check CHECK (cardinality(completed_step_indexes) <= 6),
    CONSTRAINT learner_shared_task_checklists_range_check CHECK (completed_step_indexes <@ ARRAY[0, 1, 2, 3, 4, 5]::SMALLINT[])
);

COMMENT ON TABLE learner_shared_task_submissions IS
    'Accepted learner-owned shared-task contributions. Sharing is an explicit per-submission choice.';
COMMENT ON TABLE learner_shared_task_reviews IS
    'Anonymous peer feedback; identities remain absent from learner playback.';
COMMENT ON TABLE learner_shared_task_review_follow_ups IS
    'Private contributor notes about received peer feedback.';
