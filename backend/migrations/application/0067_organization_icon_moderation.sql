ALTER TABLE organization_icon_reports
    ADD COLUMN icon_content_type TEXT CHECK (icon_content_type IS NULL OR icon_content_type IN ('image/gif', 'image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'));

ALTER TABLE organization_icon_reports
    DROP CONSTRAINT organization_icon_reports_status_check;
ALTER TABLE organization_icon_reports
    ADD CONSTRAINT organization_icon_reports_status_check CHECK (status IN ('pending', 'resolved', 'dismissed'));
CREATE INDEX organization_icon_reports_pending_index
    ON organization_icon_reports (created_at DESC, id DESC)
    WHERE status = 'pending';

ALTER TABLE application_capabilities
    DROP CONSTRAINT application_capabilities_key_check;
ALTER TABLE application_capabilities
    ADD CONSTRAINT application_capabilities_key_check CHECK (
        capability_key IN (
            'learner_messages_moderate',
            'learning_groups_manage',
            'platform_feedback_review',
            'platform_feedback_view',
            'journal_feedback_policy_manage',
            'journal_feedback_review',
            'journal_feedback_view',
            'organization_icons_moderate'
        )
    );
INSERT INTO application_capabilities (capability_key)
VALUES ('organization_icons_moderate')
ON CONFLICT (capability_key) DO NOTHING;
INSERT INTO application_role_capabilities (role_key, capability_key)
VALUES ('platform_administrator', 'organization_icons_moderate')
ON CONFLICT (role_key, capability_key) DO NOTHING;
