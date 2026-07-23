<?php

namespace App\Access;

class PermissionCatalog
{
    public const USERS = 'users';

    public const ROLES = 'roles';

    public const GROUPS = 'groups';

    public const GROUP_MEMBERS = 'group_members';

    public const GROUP_TOPICS = 'group_topics';

    public const WORLD_MAPS = 'world_maps';

    public const WORLD_NODES = 'world_nodes';

    public const WORLD_ACTIVITIES = 'world_activities';

    public const WORLD_MAP_ACCESS = 'world_map_access';

    public const WORLDS = self::WORLD_MAPS;

    public const ASSETS = 'assets';

    public const SOUNDS = 'sounds';

    public const PRESENTATION = 'presentation';

    public const LANGUAGES = 'languages';

    public const JOURNAL_SETTINGS = 'journal_settings';

    public const JOURNAL_FEEDBACK = 'journal_feedback';

    public const JOURNALS = self::JOURNAL_SETTINGS;

    public const ORGANIZATION_MODERATION = 'organization_moderation';

    public const AI = 'ai';

    /**
     * @return array<string, array{label: string, description: string, group: string}>
     */
    public static function resources(): array
    {
        return [
            self::USERS => [
                'label' => 'User management',
                'description' => 'Registration tokens, user roles, bans and account deletion.',
                'group' => 'Administration',
            ],
            self::ROLES => [
                'label' => 'Role management',
                'description' => 'Create roles and decide which administrative areas they can access.',
                'group' => 'Administration',
            ],
            self::GROUPS => [
                'label' => 'Groups',
                'description' => 'Create and edit learning groups.',
                'group' => 'Groups',
            ],
            self::GROUP_MEMBERS => [
                'label' => 'Group members',
                'description' => 'Add users to groups and manage group membership.',
                'group' => 'Groups',
            ],
            self::GROUP_TOPICS => [
                'label' => 'Group topics',
                'description' => 'Define the study topic or project focus for groups.',
                'group' => 'Groups',
            ],
            self::WORLD_MAPS => [
                'label' => 'World maps',
                'description' => 'Create, edit and delete maps.',
                'group' => 'World builder',
            ],
            self::WORLD_NODES => [
                'label' => 'World nodes',
                'description' => 'Create, edit and delete map tiles and node unlocks.',
                'group' => 'World builder',
            ],
            self::WORLD_ACTIVITIES => [
                'label' => 'World activities',
                'description' => 'Author activities, routes, dialogues and transitions.',
                'group' => 'World builder',
            ],
            self::WORLD_MAP_ACCESS => [
                'label' => 'Map access',
                'description' => 'Choose who can view or edit a map.',
                'group' => 'World builder',
            ],
            self::ASSETS => [
                'label' => 'Assets',
                'description' => 'Tools, media, reusable images, items and future currencies.',
                'group' => 'Assets',
            ],
            self::SOUNDS => [
                'label' => 'Sounds',
                'description' => 'Reusable music, sound effects, ambience and voice clips.',
                'group' => 'Assets',
            ],
            self::PRESENTATION => [
                'label' => 'Presentation',
                'description' => 'Welcome pages, public information pages, login visuals and cursors.',
                'group' => 'Presentation',
            ],
            self::LANGUAGES => [
                'label' => 'Languages',
                'description' => 'Available learner languages and the import/export of translated catalogs.',
                'group' => 'Presentation',
            ],
            self::JOURNAL_SETTINGS => [
                'label' => 'Journal settings',
                'description' => 'Configure learner journals and whether learners may request expert feedback.',
                'group' => 'Learning support',
            ],
            self::JOURNAL_FEEDBACK => [
                'label' => 'Journal feedback',
                'description' => 'Review learner feedback requests and send informational feedback.',
                'group' => 'Learning support',
            ],
            self::ORGANIZATION_MODERATION => [
                'label' => 'Organization moderation',
                'description' => 'Review reported organization icons and platform organization limits.',
                'group' => 'Learning support',
            ],
            self::AI => [
                'label' => 'AI support',
                'description' => 'Provider credentials, agent templates and usage guardrails.',
                'group' => 'AI',
            ],
        ];
    }

    /**
     * @return list<string>
     */
    public static function resourceKeys(): array
    {
        return array_keys(self::resources());
    }

    public static function ability(string $resource, string $level): string
    {
        return "{$resource}.{$level}";
    }

    /** @return array<string, list<string>> */
    public static function legacyResourceMap(): array
    {
        return [
            'worlds' => [
                self::WORLD_MAPS,
                self::WORLD_NODES,
                self::WORLD_ACTIVITIES,
                self::WORLD_MAP_ACCESS,
            ],
            'journals' => [
                self::JOURNAL_SETTINGS,
                self::JOURNAL_FEEDBACK,
                self::ORGANIZATION_MODERATION,
            ],
            'users' => [
                self::USERS,
                self::GROUPS,
                self::GROUP_MEMBERS,
                self::GROUP_TOPICS,
            ],
        ];
    }
}
