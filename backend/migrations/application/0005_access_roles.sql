CREATE TABLE application_roles (
    role_key TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT application_roles_key_check CHECK (role_key IN ('platform_administrator'))
);

INSERT INTO application_roles (role_key) VALUES ('platform_administrator');

CREATE TABLE application_principal_roles (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    role_key TEXT NOT NULL REFERENCES application_roles(role_key) ON DELETE RESTRICT,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, role_key)
);

COMMENT ON TABLE application_principal_roles IS
    'Fresh application authorization assignments. Credential material remains in the identity database.';
