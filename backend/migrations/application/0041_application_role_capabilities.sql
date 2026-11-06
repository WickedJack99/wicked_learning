ALTER TABLE application_roles
    DROP CONSTRAINT application_roles_key_check;

INSERT INTO application_roles (role_key)
VALUES ('learning_support')
ON CONFLICT (role_key) DO NOTHING;

CREATE TABLE application_capabilities (
    capability_key TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT application_capabilities_key_check CHECK (
        capability_key IN ('learner_messages_moderate')
    )
);

CREATE TABLE application_role_capabilities (
    role_key TEXT NOT NULL REFERENCES application_roles(role_key) ON DELETE CASCADE,
    capability_key TEXT NOT NULL REFERENCES application_capabilities(capability_key) ON DELETE RESTRICT,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_key, capability_key)
);

INSERT INTO application_capabilities (capability_key)
VALUES ('learner_messages_moderate');

INSERT INTO application_role_capabilities (role_key, capability_key)
VALUES
    ('platform_administrator', 'learner_messages_moderate'),
    ('learning_support', 'learner_messages_moderate');

COMMENT ON TABLE application_role_capabilities IS
    'Server-owned application capabilities granted through independently assignable roles.';
