-- The source permission model distinguishes reading deliberately shared
-- platform feedback from marking it reviewed. The initial greenfield grant is
-- deliberately narrow: only the existing platform-administrator role has it.
ALTER TABLE application_capabilities
    DROP CONSTRAINT application_capabilities_key_check;

ALTER TABLE application_capabilities
    ADD CONSTRAINT application_capabilities_key_check CHECK (
        capability_key IN (
            'learner_messages_moderate',
            'learning_groups_manage',
            'platform_feedback_review',
            'platform_feedback_view'
        )
    );

INSERT INTO application_capabilities (capability_key)
VALUES ('platform_feedback_view'), ('platform_feedback_review')
ON CONFLICT (capability_key) DO NOTHING;

INSERT INTO application_role_capabilities (role_key, capability_key)
VALUES
    ('platform_administrator', 'platform_feedback_view'),
    ('platform_administrator', 'platform_feedback_review')
ON CONFLICT (role_key, capability_key) DO NOTHING;
