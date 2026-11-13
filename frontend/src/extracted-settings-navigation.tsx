import {
    Bot,
    Braces,
    Database,
    Info,
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
    | 'information'
    | 'personal';

export type SettingsTranslator = (key: string, fallback: string) => string;

export type AccessCapability = {
    delete: boolean;
    read: boolean;
    update: boolean;
};
export type SettingsListItem = {
    children?: SettingsListLink[];
    description: string;
    descriptionKey?: string;
    href?: string;
    icon: LucideIcon;
    key: string;
    label: string;
    labelKey?: string;
    panel?: SettingsPanelKey;
    resources?: string[];
};
export type SettingsListLink = {
    href: string;
    label: string;
    labelKey?: string;
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
        panel: 'personal',
    },
];

export const informationSettings: SettingsListItem[] = [
    {
        key: 'about-and-legal',
        label: 'About & legal',
        labelKey: 'settings.navigation.about_and_legal',
        description: 'Read about the platform, imprint and data protection.',
        descriptionKey: 'settings.navigation.about_and_legal.description',
        icon: Info,
        panel: 'information',
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
        panel: 'admin-learning-support',
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
        panel: 'admin-world-builder',
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
        panel: 'admin-assets-world-objects',
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
        panel: 'admin-access',
        resources: ['users', 'roles', 'groups', 'group_members'],
    },
    {
        key: 'admin-learning-companion',
        label: 'Learning Companion',
        labelKey: 'settings.navigation.learning_companion',
        description: 'Configure the scripted learner orientation companion.',
        descriptionKey: 'settings.navigation.learning_companion.description',
        icon: Sparkles,
        panel: 'admin-learning-companion',
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
        panel: 'admin-ai-integrations',
        resources: ['ai'],
    },
    {
        key: 'admin-translations',
        label: 'Translations',
        labelKey: 'settings.navigation.translations',
        description: 'Platform languages and translation catalogs.',
        descriptionKey: 'settings.navigation.translations.description',
        icon: Languages,
        panel: 'admin-translations',
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
        panel: 'admin-color-palettes',
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
        panel: 'admin-public-pages',
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
        panel: 'admin-api',
        resources: ['content_api'],
    },
];

export const settingsPanelKeys: SettingsPanelKey[] = [
    'admin-access',
    'admin-api',
    'admin-ai-integrations',
    'admin-assets-world-objects',
    'admin-color-palettes',
    'admin-learning-companion',
    'admin-learning-support',
    'admin-public-pages',
    'admin-translations',
    'admin-world-builder',
    'information',
    'personal',
];

export function isSettingsPanelKey(
    value: string | null,
): value is SettingsPanelKey {
    return settingsPanelKeys.includes(value as SettingsPanelKey);
}

export function canOpenPanel(
    panel: SettingsPanelKey,
    canAccessAdministration: boolean,
): boolean {
    return canAccessAdministration || !panel.startsWith('admin-');
}

export function settingsSections(
    translate: SettingsTranslator,
    access: Record<string, AccessCapability>,
    canAccessAdministration: boolean,
    query: string,
): SettingsNavigationSection[] {
    const sections = [
        {
            key: 'personal',
            label: translate('settings.sections.personal', 'Personal'),
            items: personalSettings,
        },
        ...(canAccessAdministration
            ? [
                  {
                      key: 'administration',
                      label: translate(
                          'settings.sections.administration',
                          'Administration',
                      ),
                      items: adminSettings.filter((item) =>
                          canSeeAdminItem(item, access),
                      ),
                  },
              ]
            : []),
    ];

    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
        return sections;
    }

    return sections
        .map((section) => ({
            ...section,
            items: section.items.filter((item) =>
                settingsItemMatchesQuery(
                    item,
                    access,
                    normalizedQuery,
                    translate,
                ),
            ),
        }))
        .filter((section) => section.items.length > 0);
}

export function canSeeAdminItem(
    item: SettingsListItem,
    access: Record<string, AccessCapability>,
): boolean {
    const itemIsVisible =
        !item.resources ||
        item.resources.some((resource) => access[resource]?.read);

    if (itemIsVisible) {
        return true;
    }

    return (item.children ?? []).some((child) =>
        canSeeSettingsLink(child, access),
    );
}

export function canSeeSettingsLink(
    link: SettingsListLink,
    access: Record<string, AccessCapability>,
): boolean {
    return (
        !link.resources ||
        link.resources.some((resource) => access[resource]?.read)
    );
}

export function findSettingsItemForPanel(
    panel: SettingsPanelKey | null,
): SettingsListItem | null {
    if (!panel) {
        return null;
    }

    return (
        [...personalSettings, ...informationSettings, ...adminSettings].find(
            (item) => isActiveSettingsItem(item, panel),
        ) ?? null
    );
}

export function isActiveSettingsItem(
    item: SettingsListItem,
    panel: SettingsPanelKey | null,
): boolean {
    return panel !== null && (item.panel === panel || item.key === panel);
}

export function settingsItemMatchesQuery(
    item: SettingsListItem,
    access: Record<string, AccessCapability>,
    query: string,
    translate: SettingsTranslator,
): boolean {
    return [
        settingsItemLabel(item, translate),
        settingsItemDescription(item, translate),
        ...(item.children ?? [])
            .filter((child) => canSeeSettingsLink(child, access))
            .map((child) => settingsLinkLabel(child, translate)),
    ]
        .join(' ')
        .toLowerCase()
        .includes(query);
}

export function settingsItemLabel(
    item: SettingsListItem,
    translate: SettingsTranslator,
): string {
    return item.labelKey ? translate(item.labelKey, item.label) : item.label;
}

export function settingsItemDescription(
    item: SettingsListItem,
    translate: SettingsTranslator,
): string {
    return item.descriptionKey
        ? translate(item.descriptionKey, item.description)
        : item.description;
}

export function settingsLinkLabel(
    link: SettingsListLink,
    translate: SettingsTranslator,
): string {
    return link.labelKey ? translate(link.labelKey, link.label) : link.label;
}
