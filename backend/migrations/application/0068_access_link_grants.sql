-- Access links are application-owned authorization grants.  The opaque raw
-- token is never persisted; only its SHA-256 digest can be looked up here.
-- Registration and temporary-session links need a separate two-database
-- provisioning workflow and are intentionally not represented by this first
-- grant-only schema.
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
            'access_links_manage'
        )
    );

INSERT INTO application_capabilities (capability_key)
VALUES ('access_links_manage')
ON CONFLICT (capability_key) DO NOTHING;

INSERT INTO application_role_capabilities (role_key, capability_key)
VALUES ('platform_administrator', 'access_links_manage')
ON CONFLICT (role_key, capability_key) DO NOTHING;

CREATE TABLE access_links (
    id UUID PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL,
    usage_policy TEXT NOT NULL DEFAULT 'one_time',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    note TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    redeemed_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    redeemed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT access_links_purpose_check CHECK (purpose IN ('grant_tool', 'grant_items')),
    CONSTRAINT access_links_usage_policy_check CHECK (usage_policy IN ('one_time', 'multiple', 'per_user')),
    CONSTRAINT access_links_payload_object_check CHECK (jsonb_typeof(payload) = 'object'),
    CONSTRAINT access_links_note_length CHECK (note IS NULL OR char_length(note) <= 500),
    CONSTRAINT access_links_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX access_links_recent_idx ON access_links (created_at DESC);
CREATE INDEX access_links_available_idx ON access_links (expires_at, created_at DESC)
    WHERE is_enabled = TRUE;

CREATE TABLE access_link_redemptions (
    id UUID PRIMARY KEY,
    access_link_id UUID NOT NULL REFERENCES access_links(id) ON DELETE CASCADE,
    redeemed_by_principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX access_link_redemptions_principal_idx
    ON access_link_redemptions (access_link_id, redeemed_by_principal_id);

COMMENT ON TABLE access_links IS
    'Hashed opaque links granting existing learners configured tools or items. Plaintext tokens are returned once only.';
COMMENT ON TABLE access_link_redemptions IS
    'One audit event per successful access-link use. Multiple-use links intentionally allow repeated rows for a principal.';
