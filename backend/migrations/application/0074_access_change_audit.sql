CREATE TABLE application_access_change_events (
    id UUID PRIMARY KEY,
    action TEXT NOT NULL,
    actor_subject_id UUID,
    target_subject_id UUID,
    changes JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT application_access_change_events_action_check CHECK (
        action IN (
            'access_updated',
            'password_updated',
            'two_factor_enabled',
            'two_factor_disabled',
            'passkey_registered',
            'passkey_deleted'
        )
    ),
    CONSTRAINT application_access_change_events_changes_object_check CHECK (
        jsonb_typeof(changes) = 'object'
    )
);

CREATE INDEX application_access_change_events_target_created_idx
    ON application_access_change_events (target_subject_id, created_at DESC, id DESC);

COMMENT ON TABLE application_access_change_events IS
    'Application-owned audit of source-shaped account-access changes. It references immutable identity subject IDs without copying credential material.';
