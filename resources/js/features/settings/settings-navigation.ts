import {
    Bot,
    Braces,
    Database,
    Info,
    Languages,
    NotebookPen,
    Map as MapIcon,
    Palette,
    Shield,
    Sparkles,
    UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { usePlatformTranslation } from '@/hooks/use-platform-translation';

export type SettingsPanelKey =
    | 'admin-access'
    | 'admin-api'
    | 'admin-ai-integrations'
    | 'admin-assets-world-objects'
    | 'admin-color-palettes'
    | 'admin-learning-support'
    | 'admin-public-pages'
    | 'admin-translations'
    | 'admin-world-builder'
    | 'information'
    | 'personal';

export type SettingsTranslator = ReturnType<typeof usePlatformTranslation>;

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
            'Profile, appearance, language, notifications and security.',
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
            'Journal settings, reflection support and future competence views.',
        descriptionKey: 'settings.navigation.learning_support.description',
        icon: NotebookPen,
        panel: 'admin-learning-support',
        resources: [
            'journal_settings',
            'journal_feedback',
            'learner_support_signals',
        ],
        children: [
            {
                label: 'Support Signals',
                labelKey:
                    'settings.navigation.learning_support.support_signals',
                href: '/settings?panel=admin-learning-support&support=support-signals',
                resources: ['learner_support_signals'],
            },
            {
                label: 'Feedback',
                labelKey: 'settings.navigation.learning_support.admin_panel',
                href: '/settings?panel=admin-learning-support&support=feedback-requests',
                resources: ['journal_feedback'],
            },
            {
                label: 'Organization Icons',
                href: '/settings?panel=admin-learning-support&support=organization-icons',
                resources: ['organization_moderation'],
            },
            {
                label: 'Competence Topics',
                href: '/settings?panel=admin-learning-support&support=competence-topics',
                resources: ['competence_topics'],
            },
            {
                label: 'Journal',
                labelKey: 'settings.navigation.journal',
                href: '/settings?panel=admin-learning-support&support=journal',
                resources: ['journal_settings'],
            },
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
        children: [
            {
                label: 'Graph',
                labelKey: 'settings.navigation.world_builder.graph',
                href: '/settings?panel=admin-world-builder&worldSection=graph',
                resources: ['world_maps', 'world_nodes', 'world_activities'],
            },
            {
                label: 'Structural',
                labelKey: 'settings.navigation.world_builder.structural',
                href: '/settings?panel=admin-world-builder&worldSection=structural',
                resources: ['world_maps', 'world_nodes', 'world_activities'],
            },
        ],
    },
    {
        key: 'admin-assets-world-objects',
        label: 'Assets & World Objects',
        labelKey: 'settings.navigation.assets_world_objects',
        description:
            'Media, sounds, cursor images, reusable tools, consumable items and future currencies.',
        descriptionKey: 'settings.navigation.assets_world_objects.description',
        icon: Database,
        panel: 'admin-assets-world-objects',
        resources: ['assets', 'sounds', 'presentation'],
        children: [
            {
                label: 'Visuals',
                labelKey: 'settings.navigation.visuals',
                href: '/settings?panel=admin-assets-world-objects&asset=visuals',
                resources: ['assets'],
            },
            {
                label: 'Sounds',
                labelKey: 'settings.navigation.sounds',
                href: '/settings?panel=admin-assets-world-objects&asset=sounds',
                resources: ['sounds'],
            },
            {
                label: 'Cursor images',
                labelKey: 'settings.navigation.cursor_images',
                href: '/settings?panel=admin-assets-world-objects&asset=cursors',
                resources: ['presentation'],
            },
            {
                label: 'Tools',
                labelKey: 'settings.assets.sections.tools',
                href: '/settings?panel=admin-assets-world-objects&asset=tools',
                resources: ['assets'],
            },
            {
                label: 'Items',
                labelKey: 'settings.assets.sections.items',
                href: '/settings?panel=admin-assets-world-objects&asset=items',
                resources: ['assets'],
            },
        ],
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
        children: [
            {
                label: 'User management',
                labelKey: 'settings.navigation.user_management',
                href: '/settings?panel=admin-access&access=users',
                resources: ['users'],
            },
            {
                label: 'Role management',
                labelKey: 'settings.navigation.role_management',
                href: '/settings?panel=admin-access&access=roles',
                resources: ['roles'],
            },
            {
                label: 'Groups',
                labelKey: 'settings.navigation.groups',
                href: '/settings?panel=admin-access&access=groups',
                resources: ['groups', 'group_members'],
            },
        ],
    },
    {
        key: 'admin-ai-integrations',
        label: 'AI & Integrations',
        labelKey: 'settings.navigation.ai_integrations',
        description:
            'Provider credentials, agent templates, instruction sets and future integrations.',
        descriptionKey: 'settings.navigation.ai_integrations.description',
        icon: Bot,
        panel: 'admin-ai-integrations',
        resources: ['ai'],
        children: [
            {
                label: 'Provider keys',
                labelKey: 'settings.ai.sections.providers',
                href: '/settings?panel=admin-ai-integrations&ai=providers',
                resources: ['ai'],
            },
            {
                label: 'Agent templates',
                labelKey: 'settings.ai.sections.templates',
                href: '/settings?panel=admin-ai-integrations&ai=templates',
                resources: ['ai'],
            },
            {
                label: 'Guardrails',
                labelKey: 'settings.ai.sections.guardrails',
                href: '/settings?panel=admin-ai-integrations&ai=guardrails',
                resources: ['ai'],
            },
        ],
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
        children: [
            {
                label: 'Languages',
                labelKey: 'settings.navigation.languages',
                href: '/settings?panel=admin-translations',
                resources: ['languages'],
            },
        ],
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
        children: [
            {
                label: 'Color palette',
                labelKey: 'settings.navigation.color_palette',
                href: '/settings?panel=admin-color-palettes',
                resources: ['presentation', 'journal_settings', 'world_maps'],
            },
        ],
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
        children: [
            {
                label: 'Public pages',
                labelKey: 'settings.navigation.public_pages',
                href: '/settings?panel=admin-public-pages',
                resources: ['presentation'],
            },
        ],
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
        children: [
            {
                label: 'API Console',
                labelKey: 'settings.api.console.title',
                href: '/settings?panel=admin-api&api=console',
                resources: ['content_api'],
            },
            {
                label: 'API Documentation',
                labelKey: 'settings.api.documentation.title',
                href: '/settings?panel=admin-api&api=documentation',
                resources: ['content_api'],
            },
        ],
    },
];

export const settingsPanelKeys: SettingsPanelKey[] = [
    'admin-access',
    'admin-api',
    'admin-ai-integrations',
    'admin-assets-world-objects',
    'admin-color-palettes',
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
    t: SettingsTranslator,
    accessCapabilities: Record<string, AccessCapability>,
    canAccessAdministration: boolean,
    query: string,
): SettingsNavigationSection[] {
    const sections = [
        {
            key: 'personal',
            label: t('settings.sections.personal', 'Personal'),
            items: personalSettings,
        },
        ...(canAccessAdministration
            ? [
                  {
                      key: 'administration',
                      label: t(
                          'settings.sections.administration',
                          'Administration',
                      ),
                      items: adminSettings.filter((item) =>
                          canSeeAdminItem(item, accessCapabilities),
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
                    accessCapabilities,
                    normalizedQuery,
                    t,
                ),
            ),
        }))
        .filter((section) => section.items.length > 0);
}

export function canSeeAdminItem(
    item: SettingsListItem,
    accessCapabilities: Record<string, AccessCapability>,
): boolean {
    const itemIsVisible =
        !item.resources ||
        item.resources.some((resource) => accessCapabilities[resource]?.read);

    if (itemIsVisible) {
        return true;
    }

    return (item.children ?? []).some((child) =>
        canSeeSettingsLink(child, accessCapabilities),
    );
}

export function canSeeSettingsLink(
    link: SettingsListLink,
    accessCapabilities: Record<string, AccessCapability>,
): boolean {
    if (!link.resources) {
        return true;
    }

    return link.resources.some(
        (resource) => accessCapabilities[resource]?.read,
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
    accessCapabilities: Record<string, AccessCapability>,
    query: string,
    t: SettingsTranslator,
): boolean {
    const haystack = [
        settingsItemLabel(item, t),
        settingsItemDescription(item, t),
        ...(item.children ?? [])
            .filter((child) => canSeeSettingsLink(child, accessCapabilities))
            .map((child) => settingsLinkLabel(child, t)),
    ]
        .join(' ')
        .toLowerCase();

    return haystack.includes(query);
}

export function settingsItemLabel(
    item: SettingsListItem,
    t: SettingsTranslator,
): string {
    return item.labelKey ? t(item.labelKey, item.label) : item.label;
}

export function settingsItemDescription(
    item: SettingsListItem,
    t: SettingsTranslator,
): string {
    return item.descriptionKey
        ? t(item.descriptionKey, item.description)
        : item.description;
}

export function settingsLinkLabel(
    link: SettingsListLink,
    t: SettingsTranslator,
): string {
    return link.labelKey ? t(link.labelKey, link.label) : link.label;
}
