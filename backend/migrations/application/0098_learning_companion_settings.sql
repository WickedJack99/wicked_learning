CREATE TABLE learning_companion_settings (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
    avatar_url TEXT NULL CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 2048),
    avatar_color TEXT NOT NULL DEFAULT '#5eead4' CHECK (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
    avatar_position_x SMALLINT NOT NULL DEFAULT 50 CHECK (avatar_position_x BETWEEN 0 AND 100),
    avatar_position_y SMALLINT NOT NULL DEFAULT 50 CHECK (avatar_position_y BETWEEN 0 AND 100),
    avatar_scale SMALLINT NOT NULL DEFAULT 100 CHECK (avatar_scale BETWEEN 80 AND 200),
    welcome_message TEXT NOT NULL CHECK (char_length(welcome_message) BETWEEN 1 AND 1200),
    mode TEXT NOT NULL DEFAULT 'scripted' CHECK (mode IN ('scripted', 'guided_ai', 'open_ai')),
    ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ai_template_id UUID NULL REFERENCES ai_agent_templates(id) ON DELETE SET NULL,
    ai_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_by_principal_id UUID NULL REFERENCES application_principals(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO learning_companion_settings (
    singleton,
    display_name,
    welcome_message
) VALUES (
    TRUE,
    'Learning companion',
    'I can help you orient yourself. Choose a direction when you want one, or keep exploring at your own pace.'
) ON CONFLICT (singleton) DO NOTHING;

COMMENT ON TABLE learning_companion_settings IS
    'Singleton source-adapted platform configuration for the bounded learner Learning Companion.';
