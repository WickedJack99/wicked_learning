ALTER TABLE identity_registration_tokens
    ADD COLUMN roles JSONB NOT NULL DEFAULT '["learner"]'::jsonb,
    ADD CONSTRAINT identity_registration_tokens_roles_array_check CHECK (
        jsonb_typeof(roles) = 'array' AND jsonb_array_length(roles) > 0
    );

COMMENT ON COLUMN identity_registration_tokens.roles IS
    'Application role keys selected by the invitation issuer. The identity database stores no role definitions; registration validates the keys against the application database before activation.';
