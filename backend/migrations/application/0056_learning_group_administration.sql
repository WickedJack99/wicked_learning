-- Administration fields are added separately from the member collaboration
-- slice so the already-applied collaboration migration remains forward-only.
ALTER TABLE learning_groups
    ADD COLUMN created_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL;

ALTER TABLE learning_groups
    DROP CONSTRAINT learning_groups_slug_format;

ALTER TABLE learning_groups
    ADD CONSTRAINT learning_groups_slug_format CHECK (slug ~ '^[A-Za-z0-9_-]{1,140}$');

ALTER TABLE learning_group_memberships
    ADD COLUMN role TEXT NOT NULL DEFAULT 'member',
    ADD CONSTRAINT learning_group_memberships_role_check CHECK (role IN ('member', 'manager'));

ALTER TABLE application_capabilities
    DROP CONSTRAINT application_capabilities_key_check;

ALTER TABLE application_capabilities
    ADD CONSTRAINT application_capabilities_key_check CHECK (
        capability_key IN ('learner_messages_moderate', 'learning_groups_manage')
    );

INSERT INTO application_capabilities (capability_key)
VALUES ('learning_groups_manage')
ON CONFLICT (capability_key) DO NOTHING;

INSERT INTO application_role_capabilities (role_key, capability_key)
VALUES ('platform_administrator', 'learning_groups_manage')
ON CONFLICT (role_key, capability_key) DO NOTHING;

COMMENT ON COLUMN learning_groups.created_by_principal_id IS
    'Application-side creator reference for the future source-scoped group-management policy.';
COMMENT ON COLUMN learning_group_memberships.role IS
    'Source group membership role. The current administration UI writes member; manager assignment awaits the source role-management slice.';
