CREATE TABLE identity_security_access_audit_outbox (
    id UUID PRIMARY KEY,
    action TEXT NOT NULL CHECK (action IN ('two_factor_enabled', 'two_factor_disabled', 'passkey_registered', 'passkey_deleted')),
    actor_subject_id UUID NOT NULL REFERENCES identity_subjects(id) ON DELETE CASCADE,
    target_subject_id UUID NOT NULL REFERENCES identity_subjects(id) ON DELETE CASCADE,
    changes JSONB NOT NULL CHECK (jsonb_typeof(changes) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

CREATE INDEX identity_security_access_audit_outbox_pending_idx
    ON identity_security_access_audit_outbox (created_at, id)
    WHERE delivered_at IS NULL;

COMMENT ON TABLE identity_security_access_audit_outbox IS
    'Identity-transactional non-secret account-security audit events. They are idempotently delivered to application_access_change_events after the factor mutation commits.';
