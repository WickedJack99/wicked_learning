import { router } from '@inertiajs/react';
import {
    Bell,
    ChevronDown,
    HelpCircle,
    NotebookPen,
    Search,
    Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import { OrganizationIcon } from '@/features/organizations/organization-icon';
import {
    isActiveSettingsItem,
    settingsItemLabel,
    type SettingsListItem,
    type SettingsNavigationSection,
    type SettingsPanelKey,
} from '@/features/settings/settings-navigation';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';
import type { User as AuthUser } from '@/types';

export type SettingsNotificationSummary = {
    pendingFeedbackRequests: number;
    pendingOrganizationIconReports: number;
    reportedOrganizations: SettingsNotificationOrganization[];
};

export type SettingsNotificationOrganization = {
    iconUrl: string | null;
    id: number;
    name: string;
};

export type SettingsWorldBreadcrumb = {
    map: {
        id: number;
        title: string;
    } | null;
    node: {
        title: string;
    } | null;
    view: 'configure' | 'nodes' | null;
};

type SettingsSidebarNavigationProps = {
    activePanel: SettingsPanelKey | null;
    onOpenItem: (item: SettingsListItem) => void;
    sections: SettingsNavigationSection[];
};

type SettingsTopBarProps = {
    activeItem: SettingsListItem | null;
    currentUser: AuthUser | null;
    menuQuery: string;
    notifications: SettingsNotificationSummary;
    onSearchChange: (query: string) => void;
    worldBreadcrumb: SettingsWorldBreadcrumb;
};

export function SettingsSidebarNavigation({
    activePanel,
    onOpenItem,
    sections,
}: SettingsSidebarNavigationProps) {
    const t = usePlatformTranslation();

    return (
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {sections.map((section) => (
                <section className="mb-5" key={section.key}>
                    <h2 className="mb-2 px-2 text-xs font-medium tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                        {section.label}
                    </h2>
                    <div className="grid gap-2">
                        {section.items.map((item) => {
                            const Icon = item.icon;
                            const active = isActiveSettingsItem(
                                item,
                                activePanel,
                            );

                            return (
                                <button
                                    className={cn(
                                        'grid h-12 grid-cols-[2rem_minmax(0,1fr)] items-center rounded-lg px-3 text-left text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none',
                                        active
                                            ? 'bg-[var(--settings-accent)] text-[var(--settings-accent-foreground)] shadow-sm'
                                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
                                    )}
                                    key={item.key}
                                    onClick={() => onOpenItem(item)}
                                    type="button"
                                >
                                    <Icon className="size-4" />
                                    <span className="truncate">
                                        {settingsItemLabel(item, t)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            ))}
        </nav>
    );
}

export function SettingsTopBar({
    activeItem,
    currentUser,
    menuQuery,
    notifications,
    onSearchChange,
    worldBreadcrumb,
}: SettingsTopBarProps) {
    const t = usePlatformTranslation();

    return (
        <header className="flex h-auto shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 md:h-16 md:flex-row md:items-center md:justify-between dark:border-white/10 dark:bg-[#111820]">
            <SettingsBreadcrumb
                activeItem={activeItem}
                worldBreadcrumb={worldBreadcrumb}
            />

            <div className="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">
                <label className="relative min-w-0 flex-1 md:w-72 md:flex-none">
                    <span className="sr-only">
                        {t('settings.search', 'Search settings')}
                    </span>
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        className="h-10 rounded-lg border-slate-200 bg-slate-50 pl-9 dark:border-white/10 dark:bg-white/5"
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder={t(
                            'settings.search_placeholder',
                            'Search settings...',
                        )}
                        value={menuQuery}
                    />
                </label>

                <SettingsNotificationsMenu notifications={notifications} />

                <a
                    aria-label={t('settings.help', 'Help')}
                    className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                    href="https://github.com/WickedJack99/wicked_learning"
                    rel="noreferrer"
                    target="_blank"
                >
                    <HelpCircle className="size-4" />
                </a>

                {currentUser ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 text-left transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                                type="button"
                            >
                                <UserInfo user={currentUser} />
                                <ChevronDown className="size-4 shrink-0 text-slate-500 dark:text-slate-400" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                        >
                            <UserMenuContent user={currentUser} />
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null}
            </div>
        </header>
    );
}

function SettingsBreadcrumb({
    activeItem,
    worldBreadcrumb,
}: {
    activeItem: SettingsListItem | null;
    worldBreadcrumb: SettingsWorldBreadcrumb;
}) {
    const t = usePlatformTranslation();
    const isWorldBuilder = activeItem?.panel === 'admin-world-builder';
    const selectedMap = worldBreadcrumb.map;
    const selectedNode = worldBreadcrumb.node;
    const selectedView = worldBreadcrumb.view;

    return (
        <nav
            aria-label={t('settings.breadcrumb', 'Settings navigation')}
            className="flex min-w-0 items-center gap-2 text-sm"
        >
            {activeItem ? (
                <button
                    className={cn(
                        'truncate text-slate-600 transition hover:text-[var(--settings-accent)] dark:text-slate-300',
                        isWorldBuilder &&
                            'font-medium text-[var(--settings-accent)]',
                    )}
                    onClick={() => {
                        if (isWorldBuilder) {
                            router.visit('/settings?panel=admin-world-builder');
                        }
                    }}
                    type="button"
                >
                    {settingsItemLabel(activeItem, t)}
                </button>
            ) : null}
            {isWorldBuilder && selectedMap ? (
                <>
                    <span className="text-slate-400">/</span>
                    <button
                        className="truncate text-slate-600 transition hover:text-[var(--settings-accent)] dark:text-slate-300"
                        onClick={() =>
                            router.visit(
                                `/settings?panel=admin-world-builder&map=${selectedMap.id}&worldView=nodes`,
                            )
                        }
                        type="button"
                    >
                        {selectedMap.title}
                    </button>
                </>
            ) : null}
            {isWorldBuilder && selectedNode ? (
                <>
                    <span className="text-slate-400">/</span>
                    <span className="truncate text-slate-600 dark:text-slate-300">
                        {selectedNode.title}
                    </span>
                </>
            ) : null}
            {isWorldBuilder && selectedMap && !selectedNode && selectedView ? (
                <>
                    <span className="text-slate-400">/</span>
                    <span className="truncate text-slate-600 dark:text-slate-300">
                        {selectedView === 'configure'
                            ? t(
                                  'settings.world_builder.breadcrumb.configure',
                                  'Map configuration',
                              )
                            : t(
                                  'settings.world_builder.breadcrumb.nodes',
                                  'Nodes',
                              )}
                    </span>
                </>
            ) : null}
        </nav>
    );
}

function SettingsNotificationsMenu({
    notifications,
}: {
    notifications: SettingsNotificationSummary;
}) {
    const t = usePlatformTranslation();
    const total =
        notifications.pendingFeedbackRequests +
        notifications.pendingOrganizationIconReports;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    aria-label={t('settings.notifications', 'Notifications')}
                    className="relative grid size-10 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                    type="button"
                >
                    <Bell className="size-4" />
                    {total > 0 ? (
                        <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-[var(--settings-accent)] px-1 text-[0.65rem] font-semibold text-[var(--settings-accent-foreground)]">
                            {total > 99 ? '99+' : total}
                        </span>
                    ) : null}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 rounded-lg p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">
                        {t('settings.notifications', 'Notifications')}
                    </p>
                    {total > 0 ? (
                        <Badge variant="secondary">
                            {t(
                                'settings.notifications.pending',
                                ':count open',
                                {
                                    count: total,
                                },
                            )}
                        </Badge>
                    ) : null}
                </div>

                <div className="grid gap-2 text-sm">
                    <NotificationSummaryRow
                        count={notifications.pendingFeedbackRequests}
                        href="/settings?panel=admin-learning-support&support=admin-panel"
                        icon={NotebookPen}
                        label={t(
                            'settings.notifications.feedback_requests',
                            'Feedback requests',
                        )}
                    />
                    <NotificationSummaryRow
                        count={notifications.pendingOrganizationIconReports}
                        href="/settings?panel=admin-learning-support&support=admin-panel"
                        icon={Shield}
                        label={t(
                            'settings.notifications.organization_reports',
                            'Reported organization icons',
                        )}
                    />
                </div>

                {notifications.reportedOrganizations.length > 0 ? (
                    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-white/10">
                        <p className="mb-2 text-xs font-medium tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
                            {t(
                                'settings.notifications.organizations',
                                'Organizations',
                            )}
                        </p>
                        <div className="flex gap-2">
                            {notifications.reportedOrganizations.map(
                                (organization) => (
                                    <OrganizationIcon
                                        className="size-9 rounded-lg"
                                        iconUrl={organization.iconUrl}
                                        key={organization.id}
                                        name={organization.name}
                                    />
                                ),
                            )}
                        </div>
                    </div>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function NotificationSummaryRow({
    count,
    href,
    icon: Icon,
    label,
}: {
    count: number;
    href: string;
    icon: LucideIcon;
    label: string;
}) {
    return (
        <button
            className="flex items-center gap-3 rounded-md p-2 text-left transition hover:bg-slate-100 dark:hover:bg-white/10"
            onClick={() => router.visit(href)}
            type="button"
        >
            <span className="grid size-8 place-items-center rounded-md bg-[color-mix(in_srgb,var(--settings-accent)_14%,transparent)] text-[var(--settings-accent)]">
                <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{label}</span>
            </span>
            <Badge variant={count > 0 ? 'default' : 'secondary'}>{count}</Badge>
        </button>
    );
}
