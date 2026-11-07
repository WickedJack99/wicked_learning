ALTER TABLE application_roles
    ADD COLUMN name TEXT,
    ADD COLUMN description TEXT,
    ADD COLUMN level INTEGER,
    ADD COLUMN is_system BOOLEAN;

UPDATE application_roles
SET
    name = CASE role_key
        WHEN 'platform_administrator' THEN 'Platform administrator'
        WHEN 'learning_support' THEN 'Learning support'
        WHEN 'learner' THEN 'Learner'
        WHEN 'temporary' THEN 'Temporary learner'
        ELSE role_key
    END,
    level = CASE role_key
        WHEN 'platform_administrator' THEN 100
        WHEN 'learning_support' THEN 50
        WHEN 'learner' THEN 10
        WHEN 'temporary' THEN 1
        ELSE 1
    END,
    is_system = TRUE;

ALTER TABLE application_roles
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN level SET NOT NULL,
    ALTER COLUMN level SET DEFAULT 10,
    ALTER COLUMN is_system SET NOT NULL,
    ALTER COLUMN is_system SET DEFAULT FALSE,
    ADD CONSTRAINT application_roles_name_not_blank CHECK (btrim(name) <> ''),
    ADD CONSTRAINT application_roles_name_length CHECK (char_length(name) <= 80),
    ADD CONSTRAINT application_roles_description_length CHECK (description IS NULL OR char_length(description) <= 500),
    ADD CONSTRAINT application_roles_level_range CHECK (level BETWEEN 1 AND 100);

ALTER TABLE application_capabilities
    DROP CONSTRAINT application_capabilities_key_check;

ALTER TABLE application_capabilities
    ADD CONSTRAINT application_capabilities_key_check CHECK (
        capability_key IN (
            'learner_messages_moderate',
            'learning_groups_manage',
            'organization_icons_moderate',
            'journal_feedback_policy_manage',
            'journal_feedback_review',
            'journal_feedback_view',
            'platform_feedback_review',
            'platform_feedback_view',
            'access_links_manage',
            'users_view',
            'roles_view'
        )
    );

INSERT INTO application_capabilities (capability_key)
VALUES ('roles_view')
ON CONFLICT (capability_key) DO NOTHING;

INSERT INTO application_role_capabilities (role_key, capability_key)
VALUES ('platform_administrator', 'roles_view')
ON CONFLICT (role_key, capability_key) DO NOTHING;

COMMENT ON TABLE application_roles IS
    'Source-shaped role catalogue. Role metadata and capability grants remain application data, separate from identity credentials.';
