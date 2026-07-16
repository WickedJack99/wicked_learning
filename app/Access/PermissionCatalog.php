<?php

namespace App\Access;

class PermissionCatalog
{
    public const USERS = 'users';

    public const ROLES = 'roles';

    public const WORLDS = 'worlds';

    public const ASSETS = 'assets';

    public const SOUNDS = 'sounds';

    public const PRESENTATION = 'presentation';

    public const LANGUAGES = 'languages';

    public const JOURNALS = 'journals';

    /**
     * @return array<string, array{label: string, description: string}>
     */
    public static function resources(): array
    {
        return [
            self::USERS => [
                'label' => 'User management',
                'description' => 'Registration tokens, user roles, bans and account deletion.',
            ],
            self::ROLES => [
                'label' => 'Role management',
                'description' => 'Create roles and decide which administrative areas they can access.',
            ],
            self::WORLDS => [
                'label' => 'World editing',
                'description' => 'Maps, tiles, activities, portals and dialogue authoring.',
            ],
            self::ASSETS => [
                'label' => 'Assets',
                'description' => 'Tools, media, reusable images, items and future currencies.',
            ],
            self::SOUNDS => [
                'label' => 'Sounds',
                'description' => 'Reusable music, sound effects, ambience and voice clips.',
            ],
            self::PRESENTATION => [
                'label' => 'Presentation',
                'description' => 'Welcome pages, public information pages, login visuals and cursors.',
            ],
            self::LANGUAGES => [
                'label' => 'Languages',
                'description' => 'Available learner languages and the import/export of translated catalogs.',
            ],
            self::JOURNALS => [
                'label' => 'Journals',
                'description' => 'Learner reflections and whether learners may request informational expert feedback.',
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
}
