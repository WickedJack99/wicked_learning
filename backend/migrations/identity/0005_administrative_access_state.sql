ALTER TABLE identity_subjects
    ADD COLUMN login_disabled_at TIMESTAMPTZ,
    ADD COLUMN banned_until TIMESTAMPTZ;

CREATE INDEX identity_subjects_banned_until_idx
    ON identity_subjects (banned_until)
    WHERE banned_until IS NOT NULL;

COMMENT ON COLUMN identity_subjects.login_disabled_at IS
    'Identity-owned administrator login disablement. Credential verification must reject disabled subjects.';

COMMENT ON COLUMN identity_subjects.banned_until IS
    'Identity-owned temporary login ban. A past timestamp does not block authentication.';
