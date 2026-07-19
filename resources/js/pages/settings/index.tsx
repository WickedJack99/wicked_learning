import { Head, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Bot,
    CalendarClock,
    Copy,
    Database,
    Info,
    KeyRound,
    NotebookPen,
    Map,
    Palette,
    Plus,
    Shield,
    Trash2,
    UserRound,
    Users,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppearanceTabs from '@/components/appearance-tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PlatformInfoPageKey } from '@/features/platform-info/content';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';
import type { PublicPresentationSettings } from '@/theme/presentation';
import type { User as AuthUser } from '@/types';

type SettingsPanelKey =
    | 'admin-access'
    | 'admin-presentation'
    | 'admin-users'
    | 'admin-world'
    | 'appearance'
    | 'notifications'
    | 'profile'
    | 'security';

type Translator = ReturnType<typeof usePlatformTranslation>;

type UserReference = {
    email: string;
    id: number;
    name: string;
};

type UserRole = string;

type PermissionLevel = 'none' | 'ro' | 'ru' | 'rud';

type AccessCapability = {
    delete: boolean;
    read: boolean;
    update: boolean;
};

type PermissionResource = {
    description: string;
    key: string;
    label: string;
};

type AccessRoleSummary = {
    description: string | null;
    id: number;
    is_system: boolean;
    level: number;
    name: string;
    permissions: Record<string, PermissionLevel>;
    slug: string;
};

type RegistrationTokenSummary = {
    created_at: string | null;
    created_by: UserReference | null;
    expires_at: string | null;
    id: number;
    is_expired: boolean;
    is_used: boolean;
    role: UserRole;
    roles: UserRole[];
    used_at: string | null;
    used_by: UserReference | null;
};

type AdminUser = {
    banned_until: string | null;
    created_at: string | null;
    email: string;
    id: number;
    is_currently_banned: boolean;
    is_login_disabled: boolean;
    login_disabled_at: string | null;
    name: string;
    registration_token: RegistrationTokenSummary | null;
    role: UserRole;
    roles: UserRole[];
};

type SettingsIndexProps = {
    accessCapabilities: Record<string, AccessCapability>;
    adminRoles: AccessRoleSummary[];
    adminUsers: AdminUser[];
    assignableRegistrationRoles: UserRole[];
    canAccessAdministration: boolean;
    canManageUsers: boolean;
    createdRegistrationToken?: string | null;
    platformInfoPages: Partial<
        Record<PlatformInfoPageKey, PlatformInfoContent>
    >;
    permissionResources: PermissionResource[];
    publicPresentation: PublicPresentationSettings;
    registrationTokens: RegistrationTokenSummary[];
};

type PlatformInfoContent = {
    key: PlatformInfoPageKey;
    markdown: string | null;
    updated_at: string | null;
    updated_by: UserReference | null;
};

type AccessFormState = {
    bannedUntil: string;
    loginDisabled: boolean;
    roles: UserRole[];
};

type RoleFormState = {
    description: string;
    level: string;
    name: string;
    permissions: Record<string, PermissionLevel>;
    slug: string;
};

type SettingsListItem = {
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

type SettingsListLink = {
    href: string;
    label: string;
    labelKey?: string;
    resources?: string[];
};

const personalSettings: SettingsListItem[] = [
    {
        key: 'personal',
        label: 'Personal',
        labelKey: 'settings.navigation.personal',
        description:
            'Profile, appearance, language, notifications and security.',
        descriptionKey: 'settings.navigation.personal.description',
        icon: UserRound,
        href: '/settings/personal',
    },
] satisfies SettingsListItem[];

const informationSettings: SettingsListItem[] = [
    {
        key: 'about-and-legal',
        label: 'About & legal',
        labelKey: 'settings.navigation.about_and_legal',
        description: 'Read about the platform, imprint and data protection.',
        descriptionKey: 'settings.navigation.about_and_legal.description',
        icon: Info,
        href: '/settings/about',
    },
] satisfies SettingsListItem[];

const adminSettings: SettingsListItem[] = [
    {
        key: 'admin-world-builder',
        label: 'World Builder',
        labelKey: 'settings.navigation.world_builder',
        description: 'Worlds, maps, nodes, activity graphs and portal routes.',
        descriptionKey: 'settings.navigation.world_builder.description',
        icon: Map,
        href: '/settings/worlds',
        resources: ['worlds'],
        children: [
            {
                label: 'World graph',
                labelKey: 'settings.navigation.world_builder.world_graph',
                href: '/settings/worlds',
                resources: ['worlds'],
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
        href: '/settings/presentation',
        resources: ['presentation', 'languages'],
        children: [
            {
                label: 'Public presentation',
                labelKey: 'settings.navigation.presentation',
                href: '/settings/presentation',
                resources: ['presentation'],
            },
            {
                label: 'Color palette',
                labelKey: 'settings.navigation.color_palette',
                href: '/settings/color-palette',
                resources: ['presentation', 'journals', 'worlds'],
            },
            {
                label: 'Languages',
                labelKey: 'settings.navigation.languages',
                href: '/settings/languages',
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
        href: '/settings/assets',
        resources: ['assets', 'sounds'],
        children: [
            {
                label: 'Visuals',
                labelKey: 'settings.navigation.visuals',
                href: '/settings/assets/media',
                resources: ['assets'],
            },
            {
                label: 'Sounds',
                labelKey: 'settings.navigation.sounds',
                href: '/settings/assets/sounds',
                resources: ['sounds'],
            },
            {
                label: 'Tools',
                labelKey: 'settings.assets.sections.tools',
                href: '/settings/assets/tools',
                resources: ['assets'],
            },
            {
                label: 'Items',
                labelKey: 'settings.assets.sections.items',
                href: '/settings/assets/items',
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
        resources: ['users', 'roles'],
    },
    {
        key: 'admin-learning-support',
        label: 'Learning Support',
        labelKey: 'settings.navigation.learning_support',
        description:
            'Journal settings, reflection support and future competence views.',
        descriptionKey: 'settings.navigation.learning_support.description',
        icon: NotebookPen,
        href: '/settings/journal',
        resources: ['journals'],
        children: [
            {
                label: 'Journal',
                labelKey: 'settings.navigation.journal',
                href: '/settings/journal',
                resources: ['journals'],
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
        href: '/settings/ai',
        resources: ['ai'],
        children: [
            {
                label: 'AI support',
                labelKey: 'settings.navigation.ai',
                href: '/settings/ai',
                resources: ['ai'],
            },
        ],
    },
] satisfies SettingsListItem[];

const panelContent: Partial<
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

const settingsPanelKeys: SettingsPanelKey[] = [
    'admin-access',
    'admin-presentation',
    'admin-users',
    'admin-world',
    'appearance',
    'notifications',
    'profile',
    'security',
];

function isSettingsPanelKey(value: string | null): value is SettingsPanelKey {
    return settingsPanelKeys.includes(value as SettingsPanelKey);
}

function canOpenPanel(
    panel: SettingsPanelKey,
    canAccessAdministration: boolean,
): boolean {
    return canAccessAdministration || !panel.startsWith('admin-');
}

function readPanelFromUrl(
    canAccessAdministration: boolean,
): SettingsPanelKey | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const panel = new URL(window.location.href).searchParams.get('panel');

    if (
        !isSettingsPanelKey(panel) ||
        !canOpenPanel(panel, canAccessAdministration)
    ) {
        return null;
    }

    return panel;
}

function writePanelToUrl(panel: SettingsPanelKey | null): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);

    if (panel) {
        url.searchParams.set('panel', panel);
    } else {
        url.searchParams.delete('panel');
    }

    window.history.pushState({ panel }, '', url);
}

export default function SettingsIndex({
    accessCapabilities,
    adminRoles,
    adminUsers,
    assignableRegistrationRoles,
    canAccessAdministration,
    createdRegistrationToken = null,
    permissionResources,
    registrationTokens,
}: SettingsIndexProps) {
    const t = usePlatformTranslation();
    const [selectedPanel, setSelectedPanel] = useState<SettingsPanelKey | null>(
        () => readPanelFromUrl(canAccessAdministration),
    );
    const selectPanel = useCallback((panel: SettingsPanelKey) => {
        setSelectedPanel(panel);
        writePanelToUrl(panel);
    }, []);
    const clearPanel = useCallback(() => {
        setSelectedPanel(null);
        writePanelToUrl(null);
    }, []);

    useEffect(() => {
        const syncPanelFromHistory = () => {
            setSelectedPanel(readPanelFromUrl(canAccessAdministration));
        };

        window.addEventListener('popstate', syncPanelFromHistory);

        return () => {
            window.removeEventListener('popstate', syncPanelFromHistory);
        };
    }, [canAccessAdministration]);

    return (
        <>
            <Head title={t('settings.title', 'Settings')} />
            <main className="h-full overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="mx-auto flex h-full max-w-[92rem] flex-col px-4 pt-6 pb-24">
                    <header className="shrink-0 pb-5">
                        {selectedPanel ? (
                            <Button
                                className="mb-5"
                                onClick={clearPanel}
                                variant="ghost"
                            >
                                <ArrowLeft className="size-4" />
                                {t('settings.back', 'Settings')}
                            </Button>
                        ) : null}
                        <p
                            className="text-xs font-medium tracking-[0.18em] uppercase"
                            style={{ color: 'var(--settings-accent)' }}
                        >
                            {t('settings.eyebrow', 'Platform')}
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                            {t('settings.title', 'Settings')}
                        </h1>
                    </header>

                    <section className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#111820]">
                        {selectedPanel ? (
                            <SettingsDetail
                                accessCapabilities={accessCapabilities}
                                adminRoles={adminRoles}
                                adminUsers={adminUsers}
                                createdRegistrationToken={
                                    createdRegistrationToken
                                }
                                permissionResources={permissionResources}
                                assignableRegistrationRoles={
                                    assignableRegistrationRoles
                                }
                                registrationTokens={registrationTokens}
                                selectedPanel={selectedPanel}
                            />
                        ) : (
                            <SettingsList
                                accessCapabilities={accessCapabilities}
                                canAccessAdministration={
                                    canAccessAdministration
                                }
                                onSelect={selectPanel}
                            />
                        )}
                    </section>
                </div>
            </main>
        </>
    );
}

SettingsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Settings',
            href: '/settings',
        },
    ],
};

function SettingsList({
    accessCapabilities,
    canAccessAdministration,
    onSelect,
}: {
    accessCapabilities: Record<string, AccessCapability>;
    canAccessAdministration: boolean;
    onSelect: (panel: SettingsPanelKey) => void;
}) {
    const t = usePlatformTranslation();
    const sections = [
        {
            label: t('settings.sections.personal', 'Personal'),
            items: personalSettings,
        },
        {
            label: t('settings.sections.information', 'Information'),
            items: informationSettings,
        },
        ...(canAccessAdministration
            ? [
                  {
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

    return (
        <div className="h-full overflow-y-auto p-4">
            {sections.map((section) => (
                <section className="mb-6" key={section.label}>
                    <h2 className="mb-2 px-2 text-xs font-medium tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">
                        {section.label}
                    </h2>
                    <div className="grid gap-2">
                        {section.items.map((item) => {
                            const Icon = item.icon;
                            const label = item.labelKey
                                ? t(item.labelKey, item.label)
                                : item.label;
                            const description = item.descriptionKey
                                ? t(item.descriptionKey, item.description)
                                : item.description;
                            const visibleChildren = (
                                item.children ?? []
                            ).filter((child) =>
                                canSeeSettingsLink(
                                    child,
                                    accessCapabilities,
                                ),
                            );

                            return (
                                <div
                                    className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:bg-slate-100 md:grid-cols-[minmax(0,1fr)_max-content] md:items-center dark:border-white/8 dark:bg-white/5 dark:hover:bg-white/10"
                                    key={item.key}
                                >
                                    <button
                                        className="flex min-w-0 items-center gap-3 text-left focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none"
                                        onClick={() => {
                                            if (item.href) {
                                                router.visit(item.href);

                                                return;
                                            }

                                            onSelect(
                                                (item.panel ??
                                                    item.key) as SettingsPanelKey,
                                            );
                                        }}
                                        type="button"
                                    >
                                        <span
                                            className="flex size-9 shrink-0 items-center justify-center rounded-md"
                                            style={{
                                                backgroundColor:
                                                    'color-mix(in srgb, var(--settings-accent) 18%, transparent)',
                                                color: 'var(--settings-accent)',
                                            }}
                                        >
                                            <Icon className="size-4" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium text-slate-950 dark:text-white">
                                                {label}
                                            </span>
                                            <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                {description}
                                            </span>
                                        </span>
                                    </button>

                                    {visibleChildren.length > 0 ? (
                                        <div className="flex flex-wrap gap-2 md:flex-nowrap md:justify-end">
                                            {visibleChildren.map((child) => (
                                                <button
                                                    className="inline-flex h-7 items-center rounded-md border border-[color-mix(in_srgb,var(--settings-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_10%,transparent)] px-2 text-xs font-medium whitespace-nowrap text-[var(--settings-accent)] transition hover:bg-[color-mix(in_srgb,var(--settings-accent)_16%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none"
                                                    key={child.href}
                                                    onClick={() =>
                                                        router.visit(child.href)
                                                    }
                                                    type="button"
                                                >
                                                    {child.labelKey
                                                        ? t(
                                                              child.labelKey,
                                                              child.label,
                                                          )
                                                        : child.label}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}

function canSeeAdminItem(
    item: SettingsListItem,
    accessCapabilities: Record<string, AccessCapability>,
): boolean {
    const itemIsVisible =
        !item.resources ||
        item.resources.some(
            (resource) => accessCapabilities[resource]?.read,
        );

    if (itemIsVisible) {
        return true;
    }

    return (item.children ?? []).some((child) =>
        canSeeSettingsLink(child, accessCapabilities),
    );
}

function canSeeSettingsLink(
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

function SettingsDetail({
    accessCapabilities,
    adminRoles,
    adminUsers,
    assignableRegistrationRoles,
    createdRegistrationToken,
    permissionResources,
    registrationTokens,
    selectedPanel,
}: {
    accessCapabilities: Record<string, AccessCapability>;
    adminRoles: AccessRoleSummary[];
    adminUsers: AdminUser[];
    assignableRegistrationRoles: UserRole[];
    createdRegistrationToken: string | null;
    permissionResources: PermissionResource[];
    registrationTokens: RegistrationTokenSummary[];
    selectedPanel: SettingsPanelKey;
}) {
    const content = panelContent[selectedPanel];

    return (
        <div className="h-full overflow-y-auto bg-white dark:bg-[#111820]">
            {(selectedPanel === 'admin-access' ||
                selectedPanel === 'admin-users') &&
            (accessCapabilities.users?.read ||
                accessCapabilities.roles?.read) ? (
                <AccessManagementPanel
                    accessCapabilities={accessCapabilities}
                    roles={adminRoles}
                    assignableRegistrationRoles={assignableRegistrationRoles}
                    createdRegistrationToken={createdRegistrationToken}
                    permissionResources={permissionResources}
                    registrationTokens={registrationTokens}
                    users={adminUsers}
                />
            ) : content ? (
                <PlaceholderPanel content={content} panel={selectedPanel} />
            ) : null}
        </div>
    );
}

function AccessManagementPanel({
    accessCapabilities,
    assignableRegistrationRoles,
    createdRegistrationToken,
    permissionResources,
    registrationTokens,
    roles,
    users,
}: {
    accessCapabilities: Record<string, AccessCapability>;
    assignableRegistrationRoles: UserRole[];
    createdRegistrationToken: string | null;
    permissionResources: PermissionResource[];
    registrationTokens: RegistrationTokenSummary[];
    roles: AccessRoleSummary[];
    users: AdminUser[];
}) {
    const t = usePlatformTranslation();
    const [section, setSection] = useState<'roles' | 'users'>('users');

    return (
        <div className="grid gap-5">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                <div>
                    <div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]">
                        <Shield className="size-5" />
                        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                            {t('settings.access.title', 'Access management')}
                        </h2>
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {t(
                            'settings.access.description',
                            'Configure who can read, update or delete administration areas. Default roles stay available.',
                        )}
                    </p>
                </div>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-sm font-medium dark:border-white/10 dark:bg-slate-950/70">
                    {accessCapabilities.users?.read ? (
                        <AccessSectionButton
                            active={section === 'users'}
                            label={t(
                                'settings.access.tabs.users',
                                'User management',
                            )}
                            onClick={() => setSection('users')}
                        />
                    ) : null}
                    {accessCapabilities.roles?.read ? (
                        <AccessSectionButton
                            active={section === 'roles'}
                            label={t(
                                'settings.access.tabs.roles',
                                'Role management',
                            )}
                            onClick={() => setSection('roles')}
                        />
                    ) : null}
                </div>
            </div>

            {section === 'users' && accessCapabilities.users?.read ? (
                <AdminUsersPanel
                    assignableRegistrationRoles={assignableRegistrationRoles}
                    createdRegistrationToken={createdRegistrationToken}
                    registrationTokens={registrationTokens}
                    roles={roles}
                    users={users}
                    canDeleteUsers={accessCapabilities.users?.delete ?? false}
                    canUpdateUsers={accessCapabilities.users?.update ?? false}
                />
            ) : null}

            {section === 'roles' && accessCapabilities.roles?.read ? (
                <RoleManagementPanel
                    canDeleteRoles={accessCapabilities.roles?.delete ?? false}
                    canUpdateRoles={accessCapabilities.roles?.update ?? false}
                    permissionResources={permissionResources}
                    roles={roles}
                />
            ) : null}
        </div>
    );
}

function AccessSectionButton({
    active,
    label,
    onClick,
}: {
    active: boolean;
    label: string;
    onClick: () => void;
}) {
    const t = usePlatformTranslation();

    return (
        <button
            className={cn(
                'rounded-md px-3 py-2 transition',
                active
                    ? 'bg-[var(--settings-accent)] text-[var(--settings-accent-foreground)] shadow-sm'
                    : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white',
            )}
            onClick={onClick}
            type="button"
        >
            {label}
        </button>
    );
}

function PlaceholderPanel({
    content,
    panel,
}: {
    content: { body: string; title: string };
    panel: SettingsPanelKey;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/6">
            <div className="mb-4 flex items-center gap-3 text-[var(--settings-accent)]">
                <Database className="size-5" />
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                    {content.title}
                </h2>
            </div>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {content.body}
            </p>
            {panel === 'appearance' ? (
                <div className="mt-5">
                    <AppearanceTabs />
                </div>
            ) : (
                <div className="mt-5 rounded-md border border-dashed border-slate-300 p-4 text-sm leading-6 text-slate-500 dark:border-white/15 dark:text-slate-400">
                    {t(
                        'settings.scaffold',
                        'This is a scaffolded settings panel. The next step can connect this area to real forms and policies.',
                    )}
                </div>
            )}
        </div>
    );
}

function AdminUsersPanel({
    assignableRegistrationRoles,
    canDeleteUsers,
    canUpdateUsers,
    createdRegistrationToken,
    registrationTokens,
    roles,
    users,
}: {
    assignableRegistrationRoles: UserRole[];
    canDeleteUsers: boolean;
    canUpdateUsers: boolean;
    createdRegistrationToken: string | null;
    registrationTokens: RegistrationTokenSummary[];
    roles: AccessRoleSummary[];
    users: AdminUser[];
}) {
    const t = usePlatformTranslation();
    const { props } = usePage();
    const currentUser = props.auth.user as AuthUser | null;
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [isCreatingToken, setIsCreatingToken] = useState(false);
    const [tokenRoles, setTokenRoles] = useState<UserRole[]>([
        assignableRegistrationRoles[0] ?? 'user',
    ]);
    const [tokenRoleToAdd, setTokenRoleToAdd] = useState<UserRole>(
        assignableRegistrationRoles[0] ?? 'user',
    );
    const [tokenExpiresAt, setTokenExpiresAt] = useState('');
    const [formOverrides, setFormOverrides] = useState<
        Record<number, Partial<AccessFormState>>
    >({});
    const defaultForms = useMemo(() => {
        return Object.fromEntries(
            users.map((user) => [
                user.id,
                {
                    loginDisabled: user.is_login_disabled,
                    bannedUntil: toDateTimeLocal(user.banned_until),
                    roles: user.roles,
                },
            ]),
        ) as Record<number, AccessFormState>;
    }, [users]);
    const forms = useMemo(
        () =>
            Object.fromEntries(
                Object.entries(defaultForms).map(([userId, form]) => [
                    userId,
                    {
                        ...form,
                        ...formOverrides[Number(userId)],
                    },
                ]),
            ) as Record<number, AccessFormState>,
        [defaultForms, formOverrides],
    );

    const unusedTokenCount = useMemo(
        () =>
            registrationTokens.filter(
                (token) => !token.is_used && !token.is_expired,
            ).length,
        [registrationTokens],
    );

    const createToken = () => {
        router.post(
            '/settings/registration-tokens',
            {
                roles: tokenRoles,
                expires_at: tokenExpiresAt || null,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setIsCreatingToken(false);
                    setTokenRoles([assignableRegistrationRoles[0] ?? 'user']);
                    setTokenRoleToAdd(assignableRegistrationRoles[0] ?? 'user');
                    setTokenExpiresAt('');
                },
            },
        );
    };

    const resetTokenCreation = () => {
        setIsCreatingToken(false);
        setTokenRoles([assignableRegistrationRoles[0] ?? 'user']);
        setTokenRoleToAdd(assignableRegistrationRoles[0] ?? 'user');
        setTokenExpiresAt('');
    };

    const copyCreatedToken = async () => {
        if (!createdRegistrationToken) {
            return;
        }

        await navigator.clipboard.writeText(createdRegistrationToken);
    };

    const updateForm = (
        userId: number,
        nextState: Partial<AccessFormState>,
    ) => {
        setFormOverrides((current) => ({
            ...current,
            [userId]: {
                ...current[userId],
                ...nextState,
            },
        }));
    };

    const saveAccess = (user: AdminUser) => {
        const form = forms[user.id];

        if (!form) {
            return;
        }

        router.patch(
            `/settings/admin/users/${user.id}/access`,
            {
                login_disabled: form.loginDisabled,
                banned_until: form.bannedUntil || null,
                roles: form.roles,
            },
            {
                preserveScroll: true,
                preserveState: true,
            },
        );
    };

    const deleteUser = (user: AdminUser) => {
        if (
            !window.confirm(
                t(
                    'settings.access.users.delete_confirm',
                    'Delete :name? This cannot be undone.',
                    { name: user.name },
                ),
            )
        ) {
            return;
        }

        router.delete(`/settings/admin/users/${user.id}`, {
            preserveScroll: true,
        });
    };

    return (
        <div>
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between dark:border-white/10">
                <div>
                    <div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]">
                        <Users className="size-5" />
                        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                            {t('settings.access.users.title', 'Users')}
                        </h2>
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {t(
                            'settings.access.users.description',
                            'Manage registration tokens and account access. Token plaintext is shown only once after creation.',
                        )}
                    </p>
                </div>
                <Button onClick={() => setIsCreatingToken(true)}>
                    <Plus className="size-4" />
                    {t('settings.access.users.create_token', 'Create token')}
                </Button>
            </div>

            <Dialog
                onOpenChange={(open) => {
                    if (!open) {
                        resetTokenCreation();
                    }
                }}
                open={isCreatingToken}
            >
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>
                            {t(
                                'settings.access.tokens.dialog_title',
                                'Create registration token',
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                'settings.access.tokens.dialog_description',
                                'Choose the roles this one-use token grants and optionally set an expiration date.',
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                        <RoleEditor
                            assignableRoles={assignableRegistrationRoles}
                            idPrefix="token"
                            onChange={setTokenRoles}
                            roleToAdd={tokenRoleToAdd}
                            roleOptions={roles}
                            roles={tokenRoles}
                            setRoleToAdd={setTokenRoleToAdd}
                        />
                        <div className="grid gap-1">
                            <Label htmlFor="token-expires-at">
                                {t(
                                    'settings.access.tokens.expires_at',
                                    'Expires at',
                                )}
                            </Label>
                            <Input
                                id="token-expires-at"
                                onChange={(event) =>
                                    setTokenExpiresAt(event.currentTarget.value)
                                }
                                type="datetime-local"
                                value={tokenExpiresAt}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={resetTokenCreation}
                            type="button"
                            variant="secondary"
                        >
                            {t('common.cancel', 'Cancel')}
                        </Button>
                        <Button onClick={createToken} type="button">
                            <Plus className="size-4" />
                            {t('common.create', 'Create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {createdRegistrationToken ? (
                <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)] p-4 text-slate-950 dark:text-slate-50">
                    <p className="text-sm font-medium">
                        {t(
                            'settings.access.tokens.new',
                            'New registration token',
                        )}
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-white px-3 py-2 text-sm dark:bg-slate-950/70">
                            {createdRegistrationToken}
                        </code>
                        <Button onClick={copyCreatedToken} variant="secondary">
                            <Copy className="size-4" />
                            {t('common.copy', 'Copy')}
                        </Button>
                    </div>
                </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <AdminMetric
                    label={t(
                        'settings.access.metrics.registered_users',
                        'Registered users',
                    )}
                    value={users.length}
                />
                <AdminMetric
                    label={t(
                        'settings.access.metrics.unused_tokens',
                        'Unused tokens',
                    )}
                    value={unusedTokenCount}
                />
                <AdminMetric
                    label={t(
                        'settings.access.metrics.blocked_users',
                        'Blocked users',
                    )}
                    value={
                        users.filter(
                            (user) =>
                                user.is_login_disabled ||
                                user.is_currently_banned,
                        ).length
                    }
                />
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(180px,1fr)_150px_minmax(0,1fr)_180px] gap-3 bg-slate-100 px-4 py-3 text-xs font-medium tracking-[0.14em] text-slate-500 uppercase lg:grid dark:bg-white/5 dark:text-slate-400">
                    <span>
                        {t('settings.access.users.table.user', 'User')}
                    </span>
                    <span>
                        {t('settings.access.users.table.roles', 'Roles')}
                    </span>
                    <span>
                        {t('settings.access.users.table.status', 'Status')}
                    </span>
                    <span>
                        {t(
                            'settings.access.users.table.ban_until',
                            'Ban until',
                        )}
                    </span>
                    <span>
                        {t('settings.access.users.table.actions', 'Actions')}
                    </span>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-white/10">
                    {users.map((user) => {
                        const form = forms[user.id];
                        const isCurrentUser = currentUser?.id === user.id;

                        return (
                            <div
                                className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,1fr)_150px_minmax(0,1fr)_180px] lg:items-center"
                                key={user.id}
                            >
                                <button
                                    className="min-w-0 text-left focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none"
                                    onClick={() => setSelectedUser(user)}
                                    type="button"
                                >
                                    <span className="block truncate text-sm font-medium text-slate-950 dark:text-white">
                                        {user.name}
                                    </span>
                                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                        {user.email}
                                    </span>
                                </button>

                                <RoleEditor
                                    assignableRoles={
                                        assignableRegistrationRoles
                                    }
                                    disabled={isCurrentUser || !canUpdateUsers}
                                    idPrefix={`user-${user.id}`}
                                    onChange={(roles) =>
                                        updateForm(user.id, { roles })
                                    }
                                    roleOptions={roles}
                                    roleToAdd={
                                        firstAddableRole(
                                            assignableRegistrationRoles,
                                            form?.roles ?? user.roles,
                                        ) ?? assignableRegistrationRoles[0]
                                    }
                                    roles={form?.roles ?? user.roles}
                                />

                                <div className="flex flex-col gap-2">
                                    <StatusBadges user={user} />
                                    <LoginToggle
                                        disabled={isCurrentUser}
                                        isDisabled={
                                            form?.loginDisabled ?? false
                                        }
                                        onChange={(loginDisabled) =>
                                            updateForm(user.id, {
                                                loginDisabled,
                                            })
                                        }
                                    />
                                </div>

                                <div className="grid gap-1">
                                    <Label
                                        className="text-xs lg:hidden"
                                        htmlFor={`banned-until-${user.id}`}
                                    >
                                        {t(
                                            'settings.access.users.table.ban_until',
                                            'Ban until',
                                        )}
                                    </Label>
                                    <Input
                                        disabled={isCurrentUser}
                                        id={`banned-until-${user.id}`}
                                        onChange={(event) =>
                                            updateForm(user.id, {
                                                bannedUntil:
                                                    event.currentTarget.value,
                                            })
                                        }
                                        type="datetime-local"
                                        value={form?.bannedUntil ?? ''}
                                    />
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        disabled={
                                            isCurrentUser || !canUpdateUsers
                                        }
                                        onClick={() => saveAccess(user)}
                                        size="sm"
                                        variant="secondary"
                                    >
                                        {t('common.save', 'Save')}
                                    </Button>
                                    <Button
                                        disabled={
                                            isCurrentUser || !canDeleteUsers
                                        }
                                        onClick={() => deleteUser(user)}
                                        size="sm"
                                        variant="destructive"
                                    >
                                        <Trash2 className="size-4" />
                                        {t('common.delete', 'Delete')}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-950 dark:text-white">
                    <KeyRound className="size-4 text-[var(--settings-accent)]" />
                    {t(
                        'settings.access.tokens.latest',
                        'Latest registration tokens',
                    )}
                </div>
                <div className="grid gap-2">
                    {registrationTokens.map((token) => (
                        <div
                            className="flex flex-col gap-2 rounded-md bg-slate-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:bg-white/5"
                            key={token.id}
                        >
                            <div>
                                <span className="font-medium">
                                    {t(
                                        'settings.access.tokens.number',
                                        'Token #:id',
                                        { id: token.id },
                                    )}
                                </span>
                                <span className="ml-2 text-slate-500 dark:text-slate-400">
                                    {t(
                                        'settings.access.tokens.created_by',
                                        'created by :name',
                                        {
                                            name:
                                                token.created_by?.name ??
                                                t('common.unknown', 'Unknown'),
                                        },
                                    )}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <RoleBadges
                                    roleOptions={roles}
                                    roles={token.roles}
                                />
                                <Badge
                                    variant={
                                        token.is_expired
                                            ? 'destructive'
                                            : token.is_used
                                              ? 'secondary'
                                              : 'default'
                                    }
                                >
                                    {token.is_expired
                                        ? t(
                                              'settings.access.tokens.expired',
                                              'Expired',
                                          )
                                        : token.is_used
                                          ? t(
                                                'settings.access.tokens.used',
                                                'Used',
                                            )
                                          : t(
                                                'settings.access.tokens.unused',
                                                'Unused',
                                            )}
                                </Badge>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {formatDate(token.created_at, t)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Dialog
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedUser(null);
                    }
                }}
                open={Boolean(selectedUser)}
            >
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
                    {selectedUser ? (
                        <UserDetailsDialog
                            roleOptions={roles}
                            user={selectedUser}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function AdminMetric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-2xl font-semibold text-slate-950 dark:text-white">
                {value}
            </p>
            <p className="mt-1 text-xs font-medium tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
                {label}
            </p>
        </div>
    );
}

function RoleEditor({
    assignableRoles,
    disabled = false,
    idPrefix,
    onChange,
    roleToAdd,
    roleOptions,
    roles,
    setRoleToAdd,
}: {
    assignableRoles: UserRole[];
    disabled?: boolean;
    idPrefix: string;
    onChange: (roles: UserRole[]) => void;
    roleToAdd?: UserRole;
    roleOptions: AccessRoleSummary[];
    roles: UserRole[];
    setRoleToAdd?: (role: UserRole) => void;
}) {
    const t = usePlatformTranslation();
    const [internalRoleToAdd, setInternalRoleToAdd] = useState<UserRole>(
        firstAddableRole(assignableRoles, roles) ??
            assignableRoles[0] ??
            'user',
    );
    const selectedRoleToAdd = roleToAdd ?? internalRoleToAdd;
    const setSelectedRoleToAdd = setRoleToAdd ?? setInternalRoleToAdd;
    const addableRoles = assignableRoles.filter(
        (role) => !roles.includes(role),
    );
    const addRole = () => {
        if (!selectedRoleToAdd || roles.includes(selectedRoleToAdd)) {
            return;
        }

        onChange([...roles, selectedRoleToAdd]);
        setSelectedRoleToAdd(
            firstAddableRole(assignableRoles, [...roles, selectedRoleToAdd]) ??
                assignableRoles[0] ??
                'user',
        );
    };
    const removeRole = (roleToRemove: UserRole) => {
        if (roles.length <= 1) {
            return;
        }

        onChange(roles.filter((role) => role !== roleToRemove));
    };

    return (
        <div className="grid gap-2">
            <div className="flex flex-wrap gap-1.5">
                {roles.map((role) => (
                    <span
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100"
                        key={role}
                    >
                        {roleLabel(role, roleOptions)}
                        {!disabled && roles.length > 1 ? (
                            <button
                                aria-label={t(
                                    'settings.access.roles.remove_role',
                                    'Remove :role role',
                                    { role: roleLabel(role, roleOptions) },
                                )}
                                className="rounded text-slate-500 transition hover:text-red-600 focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none dark:text-slate-400 dark:hover:text-red-300"
                                onClick={() => removeRole(role)}
                                type="button"
                            >
                                <X className="size-3" />
                            </button>
                        ) : null}
                    </span>
                ))}
            </div>

            {!disabled && addableRoles.length > 0 ? (
                <div className="flex gap-2">
                    <select
                        className="h-9 min-w-0 flex-1 rounded-md border border-input bg-white px-3 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                        id={`${idPrefix}-role`}
                        onChange={(event) =>
                            setSelectedRoleToAdd(
                                event.currentTarget.value as UserRole,
                            )
                        }
                        value={selectedRoleToAdd}
                    >
                        {addableRoles.map((role) => (
                            <option
                                className="bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-100"
                                key={role}
                                value={role}
                            >
                                {roleLabel(role, roleOptions)}
                            </option>
                        ))}
                    </select>
                    <Button onClick={addRole} size="sm" variant="secondary">
                        {t('common.add', 'Add')}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

function LoginToggle({
    disabled,
    isDisabled,
    onChange,
}: {
    disabled: boolean;
    isDisabled: boolean;
    onChange: (isDisabled: boolean) => void;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="inline-grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs font-medium dark:border-white/10 dark:bg-slate-950/70">
            <button
                className={cn(
                    'rounded-md px-2 py-1.5 transition',
                    !isDisabled
                        ? 'bg-[var(--settings-accent)] text-[var(--settings-accent-foreground)] shadow-sm'
                        : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white',
                )}
                disabled={disabled}
                onClick={() => onChange(false)}
                type="button"
            >
                {t('settings.access.login.enabled', 'Enabled')}
            </button>
            <button
                className={cn(
                    'rounded-md px-2 py-1.5 transition',
                    isDisabled
                        ? 'bg-red-600 text-white shadow-sm dark:bg-red-400 dark:text-slate-950'
                        : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white',
                )}
                disabled={disabled}
                onClick={() => onChange(true)}
                type="button"
            >
                {t('settings.access.login.disabled', 'Disabled')}
            </button>
        </div>
    );
}

function UserDetailsDialog({
    roleOptions,
    user,
}: {
    roleOptions: AccessRoleSummary[];
    user: AdminUser;
}) {
    const t = usePlatformTranslation();
    const token = user.registration_token;

    return (
        <>
            <DialogHeader>
                <DialogTitle>{user.name}</DialogTitle>
                <DialogDescription>
                    {t(
                        'settings.access.users.details.description',
                        'Read-only account and registration-token audit details.',
                    )}
                </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 text-sm">
                <DetailRow
                    label={t('settings.access.users.details.email', 'Email')}
                    value={user.email}
                />
                <DetailRow
                    label={t('settings.access.users.details.roles', 'Roles')}
                    value={roleListLabel(user.roles, roleOptions)}
                />
                <DetailRow
                    label={t(
                        'settings.access.users.details.registered',
                        'Registered',
                    )}
                    value={formatDate(user.created_at, t)}
                />
                <DetailRow
                    label={t(
                        'settings.access.users.details.login_disabled',
                        'Login disabled',
                    )}
                    value={formatDate(user.login_disabled_at, t)}
                />
                <DetailRow
                    label={t(
                        'settings.access.users.details.banned_until',
                        'Banned until',
                    )}
                    value={formatDate(user.banned_until, t)}
                />

                <div className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                    <div className="mb-3 flex items-center gap-2 font-medium">
                        <CalendarClock className="size-4 text-[var(--settings-accent)]" />
                        {t(
                            'settings.access.users.details.registration_token',
                            'Registration token',
                        )}
                    </div>
                    {token ? (
                        <div className="grid gap-3">
                            <DetailRow
                                label={t(
                                    'settings.access.users.details.token_id',
                                    'Token id',
                                )}
                                value={`#${token.id.toString()}`}
                            />
                            <DetailRow
                                label={t(
                                    'settings.access.users.details.token_created',
                                    'Token created',
                                )}
                                value={formatDate(token.created_at, t)}
                            />
                            <DetailRow
                                label={t(
                                    'settings.access.users.details.token_roles',
                                    'Token roles',
                                )}
                                value={roleListLabel(token.roles, roleOptions)}
                            />
                            <DetailRow
                                label={t(
                                    'settings.access.users.details.token_expires',
                                    'Token expires',
                                )}
                                value={formatDate(token.expires_at, t)}
                            />
                            <DetailRow
                                label={t(
                                    'settings.access.users.details.token_creator',
                                    'Token creator',
                                )}
                                value={formatUserReference(token.created_by, t)}
                            />
                            <DetailRow
                                label={t(
                                    'settings.access.users.details.token_used',
                                    'Token used',
                                )}
                                value={formatDate(token.used_at, t)}
                            />
                            <DetailRow
                                label={t(
                                    'settings.access.users.details.used_by',
                                    'Used by',
                                )}
                                value={formatUserReference(token.used_by, t)}
                            />
                        </div>
                    ) : (
                        <p className="text-slate-500 dark:text-slate-400">
                            {t(
                                'settings.access.users.details.no_token',
                                'No registration token is linked to this account.',
                            )}
                        </p>
                    )}
                </div>
            </div>
        </>
    );
}

function RoleManagementPanel({
    canDeleteRoles,
    canUpdateRoles,
    permissionResources,
    roles,
}: {
    canDeleteRoles: boolean;
    canUpdateRoles: boolean;
    permissionResources: PermissionResource[];
    roles: AccessRoleSummary[];
}) {
    const t = usePlatformTranslation();
    const [selectedRoleId, setSelectedRoleId] = useState<number | 'new'>(
        roles[0]?.id ?? 'new',
    );
    const selectedRole =
        selectedRoleId === 'new'
            ? null
            : (roles.find((role) => role.id === selectedRoleId) ?? null);
    const [form, setForm] = useState<RoleFormState>(() =>
        roleFormFromRole(selectedRole, permissionResources),
    );

    const selectRole = (role: AccessRoleSummary) => {
        setSelectedRoleId(role.id);
        setForm(roleFormFromRole(role, permissionResources));
    };
    const startCreate = () => {
        setSelectedRoleId('new');
        setForm(roleFormFromRole(null, permissionResources));
    };
    const saveRole = () => {
        const payload = {
            ...form,
            level: Number(form.level || 10),
        };

        if (selectedRole) {
            router.patch(`/settings/admin/roles/${selectedRole.id}`, payload, {
                preserveScroll: true,
                preserveState: true,
            });

            return;
        }

        router.post('/settings/admin/roles', payload, {
            preserveScroll: true,
            preserveState: true,
        });
    };
    const deleteRole = () => {
        if (!selectedRole) {
            return;
        }

        if (
            !window.confirm(
                t('settings.access.roles.delete_confirm', 'Delete role :name?', {
                    name: selectedRole.name,
                }),
            )
        ) {
            return;
        }

        router.delete(`/settings/admin/roles/${selectedRole.id}`, {
            preserveScroll: true,
        });
    };
    const setPermission = (resource: string, level: PermissionLevel) => {
        setForm((current) => ({
            ...current,
            permissions: {
                ...current.permissions,
                [resource]: level,
            },
        }));
    };

    return (
        <div className="grid min-h-[32rem] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col rounded-lg border border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-white/10">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                            {t('settings.access.roles.title', 'Roles')}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t(
                                'settings.access.roles.description',
                                'Select a role to inspect or edit.',
                            )}
                        </p>
                    </div>
                    {canUpdateRoles ? (
                        <Button onClick={startCreate} size="sm">
                            <Plus className="size-4" />
                        </Button>
                    ) : null}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {roles.map((role) => (
                        <button
                            className={cn(
                                'mb-2 w-full rounded-lg border p-3 text-left transition',
                                selectedRoleId === role.id
                                    ? 'border-[var(--settings-accent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)] text-slate-950 dark:text-slate-50'
                                    : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] dark:border-white/10 dark:bg-white/5 dark:text-slate-100',
                            )}
                            key={role.id}
                            onClick={() => selectRole(role)}
                            type="button"
                        >
                            <span className="block text-sm font-medium">
                                {role.name}
                            </span>
                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                {role.slug}
                            </span>
                        </button>
                    ))}
                </div>
            </aside>

            <section className="min-h-0 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                            {selectedRole
                                ? t(
                                      'settings.access.roles.eyebrow_existing',
                                      'Role',
                                  )
                                : t(
                                      'settings.access.roles.eyebrow_new',
                                      'New role',
                                  )}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                            {selectedRole
                                ? selectedRole.name
                                : t(
                                      'settings.access.roles.create_title',
                                      'Create role',
                                  )}
                        </h3>
                    </div>
                    <div className="flex gap-2">
                        {canUpdateRoles ? (
                            <Button onClick={saveRole}>
                                {selectedRole
                                    ? t('common.save', 'Save')
                                    : t('common.create', 'Create')}
                            </Button>
                        ) : (
                            <Button disabled variant="secondary">
                                {t('common.read_only', 'Read only')}
                            </Button>
                        )}
                        {selectedRole && canDeleteRoles ? (
                            <Button
                                disabled={selectedRole.is_system}
                                onClick={deleteRole}
                                variant="destructive"
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        ) : null}
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1">
                        <Label htmlFor="role-name">
                            {t('settings.access.roles.name', 'Name')}
                        </Label>
                        <Input
                            disabled={!canUpdateRoles}
                            id="role-name"
                            onChange={(event) =>
                                setForm((current) => ({
                                    ...current,
                                    name: event.currentTarget.value,
                                }))
                            }
                            value={form.name}
                        />
                    </div>
                    <div className="grid gap-1">
                        <Label htmlFor="role-slug">
                            {t('settings.access.roles.slug', 'Slug')}
                        </Label>
                        <Input
                            disabled={!canUpdateRoles || Boolean(selectedRole)}
                            id="role-slug"
                            onChange={(event) =>
                                setForm((current) => ({
                                    ...current,
                                    slug: event.currentTarget.value,
                                }))
                            }
                            value={form.slug}
                        />
                    </div>
                    <div className="grid gap-1 sm:col-span-2">
                        <Label htmlFor="role-description">
                            {t(
                                'settings.access.roles.role_description',
                                'Description',
                            )}
                        </Label>
                        <Input
                            disabled={!canUpdateRoles}
                            id="role-description"
                            onChange={(event) =>
                                setForm((current) => ({
                                    ...current,
                                    description: event.currentTarget.value,
                                }))
                            }
                            value={form.description}
                        />
                    </div>
                    <div className="grid gap-1">
                        <Label htmlFor="role-level">
                            {t(
                                'settings.access.roles.assignment_level',
                                'Assignment level',
                            )}
                        </Label>
                        <Input
                            disabled={!canUpdateRoles}
                            id="role-level"
                            max="100"
                            min="1"
                            onChange={(event) =>
                                setForm((current) => ({
                                    ...current,
                                    level: event.currentTarget.value,
                                }))
                            }
                            type="number"
                            value={form.level}
                        />
                    </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                    <div className="grid grid-cols-[minmax(12rem,1fr)_22rem] bg-slate-100 px-4 py-3 text-xs font-medium tracking-[0.14em] text-slate-500 uppercase dark:bg-white/5 dark:text-slate-400">
                        <span>{t('settings.access.roles.area', 'Area')}</span>
                        <span>
                            {t(
                                'settings.access.roles.permission_level',
                                'Permission level',
                            )}
                        </span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {permissionResources.map((resource) => (
                            <div
                                className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-[minmax(12rem,1fr)_22rem] sm:items-center dark:border-white/10"
                                key={resource.key}
                            >
                                <div>
                                    <p className="text-sm font-medium text-slate-950 dark:text-white">
                                        {resource.label}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                        {resource.description}
                                    </p>
                                </div>
                                <PermissionButtonGroup
                                    disabled={!canUpdateRoles}
                                    level={
                                        form.permissions[resource.key] ?? 'none'
                                    }
                                    onChange={(level) =>
                                        setPermission(resource.key, level)
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    <p>
                        <strong>
                            {t('settings.access.permissions.ro', 'RO')}
                        </strong>
                        :{' '}
                        {t(
                            'settings.access.permissions.ro_legend',
                            'read only. The role may inspect the area but not save changes.',
                        )}
                    </p>
                    <p>
                        <strong>
                            {t('settings.access.permissions.ru', 'RU')}
                        </strong>
                        :{' '}
                        {t(
                            'settings.access.permissions.ru_legend',
                            'read and update. The role may edit existing content and create new content.',
                        )}
                    </p>
                    <p>
                        <strong>
                            {t('settings.access.permissions.rud', 'RUD')}
                        </strong>
                        :{' '}
                        {t(
                            'settings.access.permissions.rud_legend',
                            'read, update and delete. The role may remove records where the feature supports deletion.',
                        )}
                    </p>
                </div>
            </section>
        </div>
    );
}

function PermissionButtonGroup({
    disabled,
    level,
    onChange,
}: {
    disabled: boolean;
    level: PermissionLevel;
    onChange: (level: PermissionLevel) => void;
}) {
    const t = usePlatformTranslation();
    const options: { label: string; value: PermissionLevel }[] = [
        { label: t('settings.access.permissions.no', 'No'), value: 'none' },
        { label: t('settings.access.permissions.ro', 'RO'), value: 'ro' },
        { label: t('settings.access.permissions.ru', 'RU'), value: 'ru' },
        { label: t('settings.access.permissions.rud', 'RUD'), value: 'rud' },
    ];

    return (
        <div className="inline-grid grid-cols-4 rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs font-medium dark:border-white/10 dark:bg-slate-950/70">
            {options.map((option) => (
                <button
                    className={cn(
                        'rounded-md px-3 py-2 transition',
                        level === option.value
                            ? 'bg-[var(--settings-accent)] text-[var(--settings-accent-foreground)] shadow-sm'
                            : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white',
                    )}
                    disabled={disabled}
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    type="button"
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
            <dt className="text-xs font-medium tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
                {label}
            </dt>
            <dd className="min-w-0 break-words text-slate-800 dark:text-slate-100">
                {value}
            </dd>
        </div>
    );
}

function RoleBadges({
    roleOptions,
    roles,
}: {
    roleOptions: AccessRoleSummary[];
    roles: UserRole[];
}) {
    return (
        <div className="flex flex-wrap gap-1">
            {roles.map((role) => (
                <Badge
                    key={role}
                    variant={role === 'admin' ? 'default' : 'outline'}
                >
                    {roleLabel(role, roleOptions)}
                </Badge>
            ))}
        </div>
    );
}

function roleLabel(role: UserRole, roleOptions: AccessRoleSummary[]): string {
    return (
        roleOptions.find((option) => option.slug === role)?.name ??
        role
            .split('-')
            .filter(Boolean)
            .map((part) => part[0]?.toUpperCase() + part.slice(1))
            .join(' ')
    );
}

function roleListLabel(
    roles: UserRole[],
    roleOptions: AccessRoleSummary[],
): string {
    return roles.map((role) => roleLabel(role, roleOptions)).join(', ');
}

function firstAddableRole(
    assignableRoles: UserRole[],
    currentRoles: UserRole[],
): UserRole | null {
    return assignableRoles.find((role) => !currentRoles.includes(role)) ?? null;
}

function roleFormFromRole(
    role: AccessRoleSummary | null,
    resources: PermissionResource[],
): RoleFormState {
    const emptyPermissions = Object.fromEntries(
        resources.map((resource) => [resource.key, 'none']),
    ) as Record<string, PermissionLevel>;

    if (!role) {
        return {
            description: '',
            level: '10',
            name: '',
            permissions: emptyPermissions,
            slug: '',
        };
    }

    return {
        description: role.description ?? '',
        level: role.level.toString(),
        name: role.name,
        permissions: {
            ...emptyPermissions,
            ...role.permissions,
        },
        slug: role.slug,
    };
}

function StatusBadges({ user }: { user: AdminUser }) {
    const t = usePlatformTranslation();

    if (!user.is_login_disabled && !user.is_currently_banned) {
        return (
            <Badge variant="secondary">
                {t('settings.access.status.active', 'Active')}
            </Badge>
        );
    }

    return (
        <div className="flex flex-wrap gap-1">
            {user.is_login_disabled ? (
                <Badge variant="destructive">
                    {t('settings.access.status.disabled', 'Disabled')}
                </Badge>
            ) : null}
            {user.is_currently_banned ? (
                <Badge variant="destructive">
                    {t('settings.access.status.banned', 'Banned')}
                </Badge>
            ) : null}
        </div>
    );
}

function formatDate(value: string | null, t?: Translator): string {
    if (!value) {
        return t?.('common.not_set', 'Not set') ?? 'Not set';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function formatUserReference(
    user: UserReference | null,
    t?: Translator,
): string {
    if (!user) {
        return t?.('common.unknown', 'Unknown') ?? 'Unknown';
    }

    return `${user.name} (${user.email})`;
}

function toDateTimeLocal(value: string | null): string {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    const offsetDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60_000,
    );

    return offsetDate.toISOString().slice(0, 16);
}
