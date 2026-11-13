import {
    Bot,
    Braces,
    Database,
    Languages,
    Map as MapIcon,
    NotebookPen,
    Palette,
    Shield,
    Sparkles,
    UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Extracted from resources/js/features/settings/settings-navigation.ts. */
export type SettingsPanelKey =
    | 'admin-access'
    | 'admin-ai-integrations'
    | 'admin-api'
    | 'admin-assets-world-objects'
    | 'admin-color-palettes'
    | 'admin-learning-companion'
    | 'admin-learning-support'
    | 'admin-public-pages'
    | 'admin-translations'
    | 'admin-world-builder'
    | 'personal';

export type AccessCapability = {
    delete: boolean;
    read: boolean;
    update: boolean;
};
export type SettingsListItem = {
    description: string;
    descriptionKey: string;
    icon: LucideIcon;
    key: SettingsPanelKey;
    label: string;
    labelKey: string;
    resources?: string[];
};
export type SettingsNavigationSection = {
    items: SettingsListItem[];
    key: string;
    label: string;
};

export const personalSettings: SettingsListItem[] = [
    {
        key: 'personal',
        label: 'Personal',
        labelKey: 'settings.navigation.personal',
        description:
            'Profile, appearance, language, notifications, feedback and security.',
        descriptionKey: 'settings.navigation.personal.description',
        icon: UserRound,
    },
];

export const adminSettings: SettingsListItem[] = [
    {
        key: 'admin-learning-support',
        label: 'Learning Support',
        labelKey: 'settings.navigation.learning_support',
        description:
            'Journal settings, reflection support and competence topics.',
        descriptionKey: 'settings.navigation.learning_support.description',
        icon: NotebookPen,
        resources: [
            'journal_settings',
            'journal_feedback',
            'learner_support_signals',
            'learning_concepts',
            'platform_feedback',
        ],
    },
    {
        key: 'admin-world-builder',
        label: 'World Builder',
        labelKey: 'settings.navigation.world_builder',
        description: 'Worlds, maps, nodes, activity graphs and portal routes.',
        descriptionKey: 'settings.navigation.world_builder.description',
        icon: MapIcon,
        resources: [
            'world_maps',
            'world_nodes',
            'world_activities',
            'world_map_access',
        ],
    },
    {
        key: 'admin-assets-world-objects',
        label: 'Assets & World Objects',
        labelKey: 'settings.navigation.assets_world_objects',
        description:
            'Media, sounds, cursor images, reusable tools and consumable items.',
        descriptionKey: 'settings.navigation.assets_world_objects.description',
        icon: Database,
        resources: ['assets', 'sounds', 'presentation'],
    },
    {
        key: 'admin-access',
        label: 'Access management',
        labelKey: 'settings.navigation.access',
        description:
            'Users, registration tokens, roles, permissions and account access.',
        descriptionKey: 'settings.navigation.access.description',
        icon: Shield,
        resources: ['users', 'roles', 'groups', 'group_members'],
    },
    {
        key: 'admin-learning-companion',
        label: 'Learning Companion',
        labelKey: 'settings.navigation.learning_companion',
        description: 'Configure the scripted learner orientation companion.',
        descriptionKey: 'settings.navigation.learning_companion.description',
        icon: Sparkles,
        resources: ['companion'],
    },
    {
        key: 'admin-ai-integrations',
        label: 'AI',
        labelKey: 'settings.navigation.ai',
        description:
            'Provider credentials, content-authoring templates and guardrails.',
        descriptionKey: 'settings.navigation.ai.description',
        icon: Bot,
        resources: ['ai'],
    },
    {
        key: 'admin-translations',
        label: 'Translations',
        labelKey: 'settings.navigation.translations',
        description: 'Platform languages and translation catalogs.',
        descriptionKey: 'settings.navigation.translations.description',
        icon: Languages,
        resources: ['languages'],
    },
    {
        key: 'admin-color-palettes',
        label: 'Color palettes',
        labelKey: 'settings.navigation.color_palettes',
        description:
            'Public text colors, settings UI, journal colors and map visual palettes.',
        descriptionKey: 'settings.navigation.color_palettes.description',
        icon: Palette,
        resources: ['presentation', 'journal_settings', 'world_maps'],
    },
    {
        key: 'admin-public-pages',
        label: 'Public pages',
        labelKey: 'settings.navigation.public_pages',
        description:
            'Welcome pages, authentication backgrounds, public information pages and source links.',
        descriptionKey: 'settings.navigation.public_pages.description',
        icon: Sparkles,
        resources: ['presentation'],
    },
    {
        key: 'admin-api',
        label: 'API',
        labelKey: 'settings.navigation.api',
        description:
            'Interactive Content API console and machine-readable authoring documentation.',
        descriptionKey: 'settings.navigation.api.description',
        icon: Braces,
        resources: ['content_api'],
    },
];

export function settingsSections(
    translate: (key: string, fallback: string) => string,
    access: Record<string, AccessCapability>,
): SettingsNavigationSection[] {
    const administration = adminSettings.filter((item) =>
        item.resources?.some((resource) => access[resource]?.read),
    );

    return [
        {
            key: 'personal',
            label: translate('settings.sections.personal', 'Personal'),
            items: personalSettings,
        },
        ...(administration.length > 0
            ? [
                  {
                      key: 'administration',
                      label: translate(
                          'settings.sections.administration',
                          'Administration',
                      ),
                      items: administration,
                  },
              ]
            : []),
    ];
}
