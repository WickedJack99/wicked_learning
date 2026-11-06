-- A journal page remains private unless its owner explicitly asks for one
-- review.  The request is application data; credentials and reviewer identity
-- profiles continue to live in the separate identity database.
CREATE TABLE application_journal_feedback_policy (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    allow_review_requests BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO application_journal_feedback_policy (singleton)
VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE learner_journal_pages
    ADD COLUMN expert_access_requested BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE learner_journal_feedback_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_journal_page_id UUID NOT NULL UNIQUE REFERENCES learner_journal_pages(id) ON DELETE CASCADE,
    requester_principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    reviewer_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    domain_type TEXT NOT NULL,
    domain_group_id UUID REFERENCES learning_groups(id) ON DELETE SET NULL,
    domain_label TEXT NOT NULL,
    feedback TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_journal_feedback_requests_domain_check CHECK (
        (domain_type = 'journal' AND domain_group_id IS NULL)
        OR (domain_type = 'group' AND domain_group_id IS NOT NULL)
    ),
    CONSTRAINT learner_journal_feedback_requests_label_not_blank CHECK (btrim(domain_label) <> ''),
    CONSTRAINT learner_journal_feedback_requests_response_consistency CHECK (
        (feedback IS NULL AND responded_at IS NULL AND reviewer_principal_id IS NULL)
        OR (feedback IS NOT NULL AND responded_at IS NOT NULL AND reviewer_principal_id IS NOT NULL)
    ),
    CONSTRAINT learner_journal_feedback_requests_feedback_length CHECK (
        feedback IS NULL OR char_length(feedback) <= 20000
    )
);

CREATE INDEX learner_journal_feedback_requests_requested_index
    ON learner_journal_feedback_requests (requested_at DESC, id DESC);

-- The original separates policy configuration from reading/replying to a
-- deliberately shared page.  Preserve that least-privilege boundary in the
-- greenfield capability model.
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
            'journal_feedback_view'
        )
    );

INSERT INTO application_capabilities (capability_key)
VALUES
    ('journal_feedback_policy_manage'),
    ('journal_feedback_review'),
    ('journal_feedback_view')
ON CONFLICT (capability_key) DO NOTHING;

INSERT INTO application_role_capabilities (role_key, capability_key)
VALUES
    ('platform_administrator', 'journal_feedback_policy_manage'),
    ('platform_administrator', 'journal_feedback_review'),
    ('platform_administrator', 'journal_feedback_view')
ON CONFLICT (role_key, capability_key) DO NOTHING;

COMMENT ON TABLE application_journal_feedback_policy IS
    'Source-defined global opt-in policy for one-time private-journal review requests.';
COMMENT ON TABLE learner_journal_feedback_requests IS
    'One explicit learner request per journal page. It is the authorization boundary for staff access to page writing.';
