-- Learning Groups are collaborative application state. They deliberately
-- reference application principals, never credential records in the identity
-- database. Identity display data is projected only after membership checks.
CREATE TABLE learning_groups (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    study_topic TEXT,
    admin_chat_visible_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    admin_chat_visible_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_groups_name_length CHECK (char_length(name) BETWEEN 1 AND 120),
    CONSTRAINT learning_groups_slug_format CHECK (slug ~ '^[a-z0-9-]{1,140}$'),
    CONSTRAINT learning_groups_description_length CHECK (description IS NULL OR char_length(description) <= 4000),
    CONSTRAINT learning_groups_study_topic_length CHECK (study_topic IS NULL OR char_length(study_topic) <= 180)
);

CREATE TABLE learning_group_memberships (
    group_id UUID NOT NULL REFERENCES learning_groups(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, principal_id)
);

CREATE INDEX learning_group_memberships_principal_group_index
    ON learning_group_memberships (principal_id, group_id);

CREATE TABLE learning_group_messages (
    id UUID PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES learning_groups(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    is_help_request BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_group_messages_body_length CHECK (char_length(body) BETWEEN 1 AND 4000),
    CONSTRAINT learning_group_messages_resolution_consistency CHECK (
        (resolved_at IS NULL AND resolved_by_principal_id IS NULL)
        OR (resolved_at IS NOT NULL AND resolved_by_principal_id IS NOT NULL)
    ),
    CONSTRAINT learning_group_messages_only_help_requests_resolve CHECK (
        resolved_at IS NULL OR is_help_request
    ),
    CONSTRAINT learning_group_messages_author_cannot_resolve CHECK (
        resolved_by_principal_id IS NULL OR resolved_by_principal_id <> principal_id
    )
);

CREATE INDEX learning_group_messages_group_created_index
    ON learning_group_messages (group_id, created_at DESC, id DESC);

CREATE TABLE learning_group_admin_chat_votes (
    group_id UUID NOT NULL REFERENCES learning_groups(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, principal_id)
);

COMMENT ON TABLE learning_groups IS
    'Collaborative learner groups. Membership and chat state remain in the application database.';
COMMENT ON TABLE learning_group_admin_chat_votes IS
    'One member consent vote per group for the source-defined staff-chat visibility policy.';
