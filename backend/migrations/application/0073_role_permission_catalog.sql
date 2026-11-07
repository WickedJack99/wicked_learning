CREATE TABLE application_role_permissions (
    role_key TEXT NOT NULL REFERENCES application_roles(role_key) ON DELETE CASCADE,
    resource_key TEXT NOT NULL,
    level TEXT NOT NULL,
    scope TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_key, resource_key),
    CONSTRAINT application_role_permissions_resource_check CHECK (resource_key IN (
        'users', 'roles', 'groups', 'group_members', 'group_topics',
        'world_maps', 'world_nodes', 'world_activities', 'world_map_access',
        'assets', 'media_paths', 'sounds', 'presentation', 'languages',
        'journal_settings', 'journal_feedback', 'competence_topics',
        'learning_concepts', 'learner_support_signals', 'learner_messages',
        'platform_feedback', 'organization_moderation', 'ai', 'companion',
        'content_api', 'content_topics'
    )),
    CONSTRAINT application_role_permissions_level_check CHECK (level IN ('none', 'ro', 'ru', 'rud')),
    CONSTRAINT application_role_permissions_scope_check CHECK (scope IN ('none', 'own', 'assigned', 'group', 'all'))
);

INSERT INTO application_role_permissions (role_key, resource_key, level, scope)
SELECT
    roles.role_key,
    resources.resource_key,
    CASE
        WHEN roles.role_key = 'platform_administrator' THEN 'rud'
        WHEN roles.role_key = 'learning_support' AND resources.resource_key = 'learner_messages' THEN 'rud'
        ELSE 'none'
    END,
    'all'
FROM application_roles AS roles
CROSS JOIN (
    VALUES
        ('users'), ('roles'), ('groups'), ('group_members'), ('group_topics'),
        ('world_maps'), ('world_nodes'), ('world_activities'), ('world_map_access'),
        ('assets'), ('media_paths'), ('sounds'), ('presentation'), ('languages'),
        ('journal_settings'), ('journal_feedback'), ('competence_topics'),
        ('learning_concepts'), ('learner_support_signals'), ('learner_messages'),
        ('platform_feedback'), ('organization_moderation'), ('ai'), ('companion'),
        ('content_api'), ('content_topics')
) AS resources(resource_key)
ON CONFLICT (role_key, resource_key) DO NOTHING;

COMMENT ON TABLE application_role_permissions IS
    'Source-shaped role permission levels and scopes. Existing capability grants remain authoritative until each application feature has migrated to this catalogue.';
