ALTER TABLE identity_totp_factors
    ADD COLUMN last_accepted_step BIGINT;

COMMENT ON COLUMN identity_totp_factors.last_accepted_step IS
    'The last RFC 6238 time-step accepted during Rust-owned TOTP sign-in. A matching or older step cannot complete another login challenge.';
