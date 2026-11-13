ALTER TABLE identity_security_access_audit_outbox
    DROP CONSTRAINT identity_security_access_audit_outbox_action_check;

ALTER TABLE identity_security_access_audit_outbox
    ADD CONSTRAINT identity_security_access_audit_outbox_action_check CHECK (
        action IN (
            'password_updated',
            'two_factor_enabled',
            'two_factor_disabled',
            'passkey_registered',
            'passkey_deleted'
        )
    );

COMMENT ON TABLE identity_security_access_audit_outbox IS
    'Identity-transactional non-secret source-shaped account-security change events. They are idempotently delivered to application_access_change_events after the identity mutation commits.';
