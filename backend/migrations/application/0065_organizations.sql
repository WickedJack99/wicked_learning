-- Organization collaboration is application data. It references application
-- principals only; credentials and authentication factors remain exclusively
-- in the identity database.
CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    created_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    slogan TEXT,
    description TEXT,
    governance_type TEXT NOT NULL DEFAULT 'monarchy',
    leadership_rotated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT organizations_name_length CHECK (char_length(name) BETWEEN 1 AND 120),
    CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9-]{1,140}$'),
    CONSTRAINT organizations_slogan_length CHECK (slogan IS NULL OR char_length(slogan) <= 180),
    CONSTRAINT organizations_description_length CHECK (description IS NULL OR char_length(description) <= 4000),
    CONSTRAINT organizations_governance_type CHECK (governance_type IN ('monarchy', 'anarchy', 'random'))
);

CREATE TABLE organization_memberships (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT organization_memberships_unique_member UNIQUE (organization_id, principal_id),
    CONSTRAINT organization_memberships_role CHECK (role IN ('leader', 'member'))
);

CREATE INDEX organization_memberships_principal_index
    ON organization_memberships (principal_id, organization_id);

CREATE TABLE organization_join_requests (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    message TEXT,
    reviewed_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT organization_join_requests_unique_requester UNIQUE (organization_id, principal_id),
    CONSTRAINT organization_join_requests_status CHECK (status IN ('pending', 'approved', 'declined')),
    CONSTRAINT organization_join_requests_message_length CHECK (message IS NULL OR char_length(message) <= 1000),
    CONSTRAINT organization_join_requests_review_consistency CHECK (
        (status = 'pending' AND reviewed_by_principal_id IS NULL AND reviewed_at IS NULL)
        OR (status IN ('approved', 'declined') AND reviewed_by_principal_id IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX organization_join_requests_pending_index
    ON organization_join_requests (organization_id, created_at ASC, id ASC)
    WHERE status = 'pending';

CREATE TABLE organization_messages (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    hidden_at TIMESTAMPTZ,
    hidden_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT organization_messages_body_length CHECK (char_length(body) BETWEEN 1 AND 4000),
    CONSTRAINT organization_messages_hidden_consistency CHECK (
        (hidden_at IS NULL AND hidden_by_principal_id IS NULL)
        OR (hidden_at IS NOT NULL AND hidden_by_principal_id IS NOT NULL)
    )
);

CREATE INDEX organization_messages_recent_index
    ON organization_messages (organization_id, created_at DESC, id DESC);

CREATE TABLE platform_organization_policy (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    max_memberships_per_user SMALLINT NOT NULL DEFAULT 10,
    CONSTRAINT platform_organization_policy_membership_limit CHECK (max_memberships_per_user BETWEEN 1 AND 100)
);

INSERT INTO platform_organization_policy (singleton)
VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;

COMMENT ON TABLE organizations IS
    'Source-shaped learner organizations, their governance mode and visible profile data.';
COMMENT ON TABLE organization_memberships IS
    'Application-side organization membership and role state; never credential data.';
COMMENT ON TABLE organization_join_requests IS
    'One durable request lifecycle per organization/principal pair.';
