-- A source message topic belongs to one authored MapAsset. Learner requests
-- and staff replies are application data; identities and credentials remain
-- in the separate identity database.
CREATE TABLE learning_message_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_asset_id UUID NOT NULL REFERENCES learning_map_assets(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_message_topics_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT learning_message_topics_asset_slug_unique UNIQUE (map_asset_id, slug)
);

CREATE TABLE learner_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES learning_message_topics(id) ON DELETE CASCADE,
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    audience TEXT NOT NULL,
    body TEXT NOT NULL,
    hidden_at TIMESTAMPTZ,
    hidden_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_messages_audience_check CHECK (audience IN ('peers', 'support')),
    CONSTRAINT learner_messages_body_length_check CHECK (char_length(body) BETWEEN 2 AND 280),
    CONSTRAINT learner_messages_topic_principal_unique UNIQUE (topic_id, principal_id)
);

CREATE INDEX learner_messages_support_reader_idx
    ON learner_messages (principal_id, created_at DESC, id DESC)
    WHERE audience = 'support' AND hidden_at IS NULL;

CREATE TABLE learner_message_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES learner_messages(id) ON DELETE CASCADE,
    responder_principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    hidden_at TIMESTAMPTZ,
    hidden_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learner_message_responses_body_length_check CHECK (char_length(body) BETWEEN 2 AND 280),
    CONSTRAINT learner_message_responses_message_responder_unique UNIQUE (message_id, responder_principal_id)
);

CREATE INDEX learner_message_responses_visible_message_idx
    ON learner_message_responses (message_id, created_at DESC, id DESC)
    WHERE hidden_at IS NULL;

-- The fresh demonstration content makes the source private-support workflow
-- reachable without pretending that Laravel records were migrated.
INSERT INTO learning_message_topics (id, map_asset_id, slug, title)
VALUES (
    '00000000-0000-4000-8000-000000000042',
    '00000000-0000-4000-8000-000000000003',
    'orientation-support',
    'Orientation support'
)
ON CONFLICT (map_asset_id, slug) DO NOTHING;

INSERT INTO learning_activities (
    id, route_id, slug, title, description, position, published_at, activity_type, activity_config
)
VALUES (
    '00000000-0000-4000-8000-000000000043',
    '00000000-0000-4000-8000-000000000005',
    'ask-learning-support',
    'Ask Learning Support',
    'Send one short private request when a little guidance would help.',
    2,
    NOW(),
    'message_prompt',
    jsonb_build_object(
        'messageTopicId', '00000000-0000-4000-8000-000000000042',
        'messageAudience', 'support',
        'messagePrompt', 'What would you like help noticing on this map?',
        'messageInputLabel', 'Your short request',
        'messageUi', jsonb_build_object(
            'surfaceColorDark', '#071018',
            'surfaceColorLight', '#eff6ff',
            'cardColorDark', '#101827',
            'cardColorLight', '#ffffff',
            'accentColorDark', '#5eead4',
            'accentColorLight', '#0f766e'
        )
    )
)
ON CONFLICT (route_id, slug) DO NOTHING;

INSERT INTO learning_activity_transitions (
    from_activity_id, to_activity_id, from_connector, to_connector, trigger, label
)
VALUES (
    '00000000-0000-4000-8000-000000000008',
    '00000000-0000-4000-8000-000000000043',
    'completed',
    'in',
    'completed',
    'Ask Learning Support'
)
ON CONFLICT (from_activity_id, from_connector, trigger, trigger_value) DO NOTHING;

COMMENT ON TABLE learner_messages IS
    'One learner-owned contribution per topic. Support messages are private to their author and authorized staff.';
