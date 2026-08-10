import { router } from '@inertiajs/react';
import { Bell, HelpCircle, NotebookPen, Search, Shield } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { NavigationLoadingIndicator } from '@/components/navigation-loading-indicator';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { UserInfo } from '@/components/user-info';
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
    section: 'graph' | 'structural';
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
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-4">
            {sections.map((section) => (
                <section className="mb-5" key={section.key}>
                    <h2 className="mb-2 px-2 text-xs font-medium tracking-[0.16em] text-[var(--settings-muted-text)] uppercase">
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
                                        'relative grid h-12 grid-cols-[2rem_minmax(0,1fr)] items-center overflow-hidden rounded-lg px-3 text-left text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none',
                                        active
                                            ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]'
                                            : 'text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]',
                                    )}
                                    key={item.key}
                                    onClick={() => onOpenItem(item)}
                                    type="button"
                                >
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--settings-accent)] transition-opacity',
                                            active
                                                ? 'opacity-100'
                                                : 'opacity-0',
                                        )}
                                    />
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
    currentUser,
    menuQuery,
    notifications,
    onSearchChange,
}: SettingsTopBarProps) {
    const t = usePlatformTranslation();
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
        null,
    );

    return (
        <header
            className="flex h-auto shrink-0 flex-col gap-3 border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] px-4 py-3 md:h-16 md:flex-row md:items-center md:justify-between"
            ref={setPortalContainer}
        >
            <div className="flex min-w-0 items-center">
                <span className="shrink-0 text-2xl leading-none font-semibold text-white dark:text-white">
                    {t('settings.title', 'Settings')}
                </span>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">
                <label className="relative min-w-0 flex-1 md:w-72 md:flex-none">
                    <span className="sr-only">
                        {t('settings.search', 'Search settings')}
                    </span>
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--settings-muted-text)]" />
                    <Input
                        className="settings-topbar-control h-10 rounded-lg border-[var(--settings-border-color)] pl-9"
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder={t(
                            'settings.search_placeholder',
                            'Search settings...',
                        )}
                        style={{
                            backgroundColor:
                                'var(--settings-active-background)',
                        }}
                        value={menuQuery}
                    />
                </label>

                <SettingsNotificationsMenu
                    notifications={notifications}
                    portalContainer={portalContainer}
                />

                <a
                    aria-label={t('settings.help', 'Help')}
                    className="settings-topbar-control grid size-10 place-items-center rounded-lg border border-[var(--settings-border-color)] text-[var(--settings-muted-text)] transition hover:text-[var(--settings-accent)]"
                    href="https://github.com/WickedJack99/wicked_learning"
                    rel="noreferrer"
                    style={{
                        backgroundColor: 'var(--settings-active-background)',
                    }}
                    target="_blank"
                >
                    <HelpCircle className="size-4" />
                </a>

                {currentUser ? (
                    <div
                        className="settings-topbar-control flex h-10 min-w-0 items-center gap-2 rounded-lg border border-[var(--settings-border-color)] px-2 text-left"
                        style={{
                            backgroundColor:
                                'var(--settings-active-background)',
                        }}
                    >
                        <UserInfo user={currentUser} />
                    </div>
                ) : null}

                <NavigationLoadingIndicator />
            </div>
        </header>
    );
}

function SettingsNotificationsMenu({
    notifications,
    portalContainer,
}: {
    notifications: SettingsNotificationSummary;
    portalContainer: HTMLElement | null;
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
                    className="settings-topbar-control relative grid size-10 place-items-center rounded-lg border border-[var(--settings-border-color)] text-[var(--settings-muted-text)] transition hover:text-[var(--settings-accent)]"
                    style={{
                        backgroundColor: 'var(--settings-active-background)',
                    }}
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
            <DropdownMenuContent
                align="end"
                className="settings-floating-panel w-[21rem] max-w-[calc(100vw-2rem)] rounded-lg p-3"
                alignOffset={0}
                container={portalContainer}
                side="bottom"
                sideOffset={23}
                style={{
                    backgroundColor: 'var(--settings-sidebar-background)',
                    backgroundImage:
                        'linear-gradient(var(--settings-active-background), var(--settings-active-background))',
                    borderColor: 'var(--settings-border-color)',
                }}
            >
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
                        href="/settings?panel=admin-learning-support&support=feedback-requests"
                        icon={NotebookPen}
                        label={t(
                            'settings.notifications.feedback_requests',
                            'Feedback requests',
                        )}
                    />
                    <NotificationSummaryRow
                        count={notifications.pendingOrganizationIconReports}
                        href="/settings?panel=admin-learning-support&support=organization-icons"
                        icon={Shield}
                        label={t(
                            'settings.notifications.organization_reports',
                            'Reported organization icons',
                        )}
                    />
                </div>

                {notifications.reportedOrganizations.length > 0 ? (
                    <div className="mt-3 border-t border-[var(--settings-border-color)] pt-3">
                        <p className="mb-2 text-xs font-medium tracking-[0.14em] text-[var(--settings-muted-text)] uppercase">
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
            className="flex items-center gap-3 rounded-md p-2 text-left transition hover:bg-[var(--settings-active-background)]"
            onClick={() => router.visit(href)}
            type="button"
        >
            <span className="grid size-8 place-items-center rounded-md bg-[color-mix(in_srgb,var(--settings-muted-text)_12%,transparent)] text-[var(--settings-muted-text)]">
                <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{label}</span>
            </span>
            <Badge variant={count > 0 ? 'default' : 'secondary'}>{count}</Badge>
        </button>
    );
}
