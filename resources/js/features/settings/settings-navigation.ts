import {
    Bot,
    Database,
    Info,
    NotebookPen,
    Map as MapIcon,
    Palette,
    Shield,
    UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { usePlatformTranslation } from '@/hooks/use-platform-translation';

export type SettingsPanelKey =
    | 'admin-access'
    | 'admin-ai-integrations'
    | 'admin-assets-world-objects'
    | 'admin-learning-support'
    | 'admin-presentation'
    | 'admin-presentation-localization'
    | 'admin-users'
    | 'admin-world'
    | 'admin-world-builder'
    | 'appearance'
    | 'information'
    | 'notifications'
    | 'personal'
    | 'profile'
    | 'security';

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
                label: 'World graph',
                labelKey: 'settings.navigation.world_builder.world_graph',
                href: '/settings?panel=admin-world-builder',
                resources: ['world_maps', 'world_nodes', 'world_activities'],
            },
        ],
    },
    {
        key: 'admin-presentation-localization',
        label: 'Presentation & Localization',
        labelKey: 'settings.navigation.presentation_localization',
        description:
            'Public pages, authentication screens, cursors, colors and languages.',
        descriptionKey:
            'settings.navigation.presentation_localization.description',
        icon: Palette,
        panel: 'admin-presentation-localization',
        resources: ['presentation', 'languages'],
        children: [
            {
                label: 'Public presentation',
                labelKey: 'settings.navigation.presentation',
                href: '/settings?panel=admin-presentation-localization&presentation=public',
                resources: ['presentation'],
            },
            {
                label: 'Color palette',
                labelKey: 'settings.navigation.color_palette',
                href: '/settings?panel=admin-presentation-localization&presentation=palette',
                resources: ['presentation', 'journal_settings', 'world_maps'],
            },
            {
                label: 'Languages',
                labelKey: 'settings.navigation.languages',
                href: '/settings?panel=admin-presentation-localization&presentation=languages',
                resources: ['languages'],
            },
        ],
    },
    {
        key: 'admin-assets-world-objects',
        label: 'Assets & World Objects',
        labelKey: 'settings.navigation.assets_world_objects',
        description:
            'Media, sounds, reusable tools, consumable items and future currencies.',
        descriptionKey: 'settings.navigation.assets_world_objects.description',
        icon: Database,
        panel: 'admin-assets-world-objects',
        resources: ['assets', 'sounds'],
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
        key: 'admin-learning-support',
        label: 'Learning Support',
        labelKey: 'settings.navigation.learning_support',
        description:
            'Journal settings, reflection support and future competence views.',
        descriptionKey: 'settings.navigation.learning_support.description',
        icon: NotebookPen,
        panel: 'admin-learning-support',
        resources: ['journal_settings', 'journal_feedback'],
        children: [
            {
                label: 'Admin Panel',
                labelKey: 'settings.navigation.learning_support.admin_panel',
                href: '/settings?panel=admin-learning-support&support=admin-panel',
                resources: ['journal_feedback', 'organization_moderation'],
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
];

export const panelContent: Partial<
    Record<
        SettingsPanelKey,
        {
            body: string;
            title: string;
        }
    >
> = {
    profile: {
        title: 'Profile',
        body: 'This will connect to the existing profile settings while keeping account management inside the platform shell.',
    },
    security: {
        title: 'Security',
        body: 'Password, passkeys and two-factor controls can move here without relying on a separate sidebar-heavy screen.',
    },
    appearance: {
        title: 'Appearance',
        body: 'Theme preference, reduced motion and future cursor/theme packs belong here.',
    },
    notifications: {
        title: 'Notifications',
        body: 'Future reminders should support learner autonomy, quiet hours and wellbeing instead of pressure loops.',
    },
    'admin-world': {
        title: 'World content',
        body: 'First admin target: create and edit maps, hex nodes, activity graphs, dialogue stages, questions and portals.',
    },
    'admin-access': {
        title: 'Access management',
        body: 'Manage users and configurable access roles.',
    },
};

export const settingsPanelKeys: SettingsPanelKey[] = [
    'admin-access',
    'admin-ai-integrations',
    'admin-assets-world-objects',
    'admin-learning-support',
    'admin-presentation',
    'admin-presentation-localization',
    'admin-users',
    'admin-world',
    'admin-world-builder',
    'appearance',
    'information',
    'notifications',
    'personal',
    'profile',
    'security',
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
        {
            key: 'information',
            label: t('settings.sections.information', 'Information'),
            items: informationSettings,
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
