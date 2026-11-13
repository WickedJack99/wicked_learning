CREATE TABLE identity_client_ip_login_rate_limits (
    client_key_hash CHAR(64) PRIMARY KEY,
    attempt_count SMALLINT NOT NULL,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT identity_client_ip_login_rate_limits_key_hash_length
        CHECK (char_length(client_key_hash) = 64),
    CONSTRAINT identity_client_ip_login_rate_limits_attempt_count
        CHECK (attempt_count > 0 AND attempt_count <= 5),
    CONSTRAINT identity_client_ip_login_rate_limits_expiry_after_window
        CHECK (expires_at > window_started_at)
);

CREATE INDEX identity_client_ip_login_rate_limits_expiry_idx
    ON identity_client_ip_login_rate_limits (expires_at);

COMMENT ON TABLE identity_client_ip_login_rate_limits IS
    'One-minute client login limiter. The client key is a LOGIN_RATE_LIMIT_KEY-keyed digest of the trusted proxy IP, never a raw address.';
