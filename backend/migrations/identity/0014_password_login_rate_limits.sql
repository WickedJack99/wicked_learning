CREATE TABLE identity_password_login_rate_limits (
    account_key_hash TEXT PRIMARY KEY,
    attempt_count SMALLINT NOT NULL,
    window_started_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT identity_password_login_rate_limits_key_hash_length
        CHECK (char_length(account_key_hash) = 64),
    CONSTRAINT identity_password_login_rate_limits_attempt_count
        CHECK (attempt_count BETWEEN 1 AND 5),
    CONSTRAINT identity_password_login_rate_limits_expiry_after_window
        CHECK (expires_at > window_started_at)
);

CREATE INDEX identity_password_login_rate_limits_expiry_idx
    ON identity_password_login_rate_limits (expires_at);

COMMENT ON TABLE identity_password_login_rate_limits IS
    'Short-lived keyed digests for the durable per-account password-login burst limit. Raw email addresses and passwords are never stored here.';
