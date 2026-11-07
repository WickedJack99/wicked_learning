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
            'users_view'
        )
    );

INSERT INTO application_capabilities (capability_key)
VALUES ('users_view')
ON CONFLICT (capability_key) DO NOTHING;

INSERT INTO application_role_capabilities (role_key, capability_key)
VALUES ('platform_administrator', 'users_view')
ON CONFLICT (role_key, capability_key) DO NOTHING;

COMMENT ON TABLE application_capabilities IS
    'Server-owned access capabilities. User administration reads are separate from later access-changing commands.';
