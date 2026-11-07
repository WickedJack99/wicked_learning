-- The source security screen lets a confirmed owner view remaining recovery
-- codes and generate a replacement set. Keep the Argon2id verifier used for
-- login, and retain a separately AES-GCM-encrypted display copy in the
-- identity database so that workflow remains available without putting a
-- plaintext code in application data or a browser cache.
ALTER TABLE identity_totp_recovery_code_verifiers
    ADD COLUMN encrypted_code BYTEA,
    ADD COLUMN encryption_nonce BYTEA;

ALTER TABLE identity_totp_recovery_code_verifiers
    ADD CONSTRAINT identity_totp_recovery_code_verifiers_encrypted_pair CHECK (
        (encrypted_code IS NULL AND encryption_nonce IS NULL)
        OR (encrypted_code IS NOT NULL AND octet_length(encryption_nonce) = 12)
    );

COMMENT ON COLUMN identity_totp_recovery_code_verifiers.encrypted_code IS
    'AES-256-GCM ciphertext used only to show an authenticated, recently password-confirmed owner their remaining source-compatible recovery codes.';
