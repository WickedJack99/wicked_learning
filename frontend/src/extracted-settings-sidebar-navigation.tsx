import {
    Bell,
    Building2,
    HelpCircle,
    NotebookPen,
    Search,
    Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { apiClient } from './api/client';
import { useCurrentUser } from './current-user';
import type { components } from './api/schema';
import type {
    SettingsListItem,
    SettingsNavigationSection,
    SettingsPanelKey,
} from './extracted-settings-navigation';
import {
    informationSettings,
    isActiveSettingsItem,
    settingsItemLabel,
} from './extracted-settings-navigation';
import { usePlatformTranslation } from './original-platform-translation';

/** Extracted from resources/js/features/settings/settings-workspace-shell.tsx. */
export function SettingsSidebarNavigation({
    activePanel,
    sections,
}: {
    activePanel: SettingsPanelKey | null;
    sections: SettingsNavigationSection[];
}) {
    const navigate = useNavigate();
    const t = usePlatformTranslation();
    const openItem = (item: SettingsListItem) =>
        navigate(item.href ?? `/settings?panel=${item.panel ?? item.key}`);
    const selectableItems = sections.flatMap((section) => section.items);
    const selectedItem = [...selectableItems, ...informationSettings].find(
        (item) => (item.panel ?? item.key) === activePanel,
    );

    return (
        <>
            <div className="border-b border-[var(--settings-border-color)] px-3 pt-3 pb-3 lg:hidden">
                <label
                    className="px-1 text-xs font-medium tracking-[0.16em] text-[var(--settings-muted-text)] uppercase"
                    htmlFor="settings-mobile-section"
                >
                    {t('settings.navigation.area', 'Settings area')}
                </label>
                <select
                    aria-label={t('settings.navigation.area', 'Settings area')}
                    className="mt-2 h-10 w-full rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-active-background)] px-3 text-sm text-white focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none dark:text-white"
                    id="settings-mobile-section"
                    onChange={(event) => {
                        const item = [
                            ...selectableItems,
                            ...informationSettings,
                        ].find(
                            (candidate) =>
                                (candidate.panel ?? candidate.key) ===
                                event.currentTarget.value,
                        );
                        if (item) openItem(item);
                    }}
                    value={selectedItem?.panel ?? ''}
                >
                    <option disabled value="">
                        {t(
                            'settings.navigation.choose_area',
                            'Choose a settings area',
                        )}
                    </option>
                    {sections.map((section) => (
                        <optgroup key={section.key} label={section.label}>
                            {section.items.map((item) => (
                                <option
                                    key={item.key}
                                    value={item.panel ?? item.key}
                                >
                                    {settingsItemLabel(item, t)}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                    <optgroup
                        label={t(
                            'settings.sections.information',
                            'Information',
                        )}
                    >
                        <option
                            value={
                                informationSettings[0]?.panel ?? 'information'
                            }
                        >
                            {settingsItemLabel(informationSettings[0]!, t)}
                        </option>
                    </optgroup>
                </select>
            </div>
            <nav
                aria-label={t(
                    'settings.navigation.label',
                    'Settings navigation',
                )}
                className="hidden min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-4 lg:block"
            >
                {sections.map((section) => (
                    <section
                        aria-labelledby={`settings-section-${section.key}`}
                        className="mb-5"
                        key={section.key}
                    >
                        <h2
                            className="mb-2 px-2 text-xs font-medium tracking-[0.16em] text-[var(--settings-muted-text)] uppercase"
                            id={`settings-section-${section.key}`}
                        >
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
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                        className={[
                                            'relative grid h-12 grid-cols-[2rem_minmax(0,1fr)] items-center overflow-hidden rounded-lg px-3 text-left text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none',
                                            active
                                                ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]'
                                                : 'text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]',
                                        ].join(' ')}
                                        key={item.key}
                                        onClick={() => openItem(item)}
                                        type="button"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={[
                                                'absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--settings-accent)] transition-opacity',
                                                active
                                                    ? 'opacity-100'
                                                    : 'opacity-0',
                                            ].join(' ')}
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
        </>
    );
}

/**
 * Source Settings top bar with standalone seams for routing and loaded user
 * chrome. The notification read is deliberately a bounded projection; the
 * linked review workspaces retain the detailed authorization boundary.
 */
export function SettingsTopBar({
    menuQuery,
    onSearchChange,
}: {
    menuQuery: string;
    onSearchChange: (query: string) => void;
}) {
    const t = usePlatformTranslation();
    const navigate = useNavigate();
    const { currentUser } = useCurrentUser();
    const accountName =
        currentUser.kind === 'loaded'
            ? currentUser.username || currentUser.name
            : null;
    const [notifications, setNotifications] =
        useState<components['schemas']['AdminSettingsNotifications']>({
            pending_feedback_requests: 0,
            pending_organization_icon_reports: 0,
            reported_organizations: [],
        });
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const total =
        notifications.pending_feedback_requests +
        notifications.pending_organization_icon_reports;

    useEffect(() => {
        let active = true;
        void apiClient
            .GET('/admin/settings/notifications')
            .then(({ data, response }) => {
                if (active && response.ok && data) {
                    setNotifications(data);
                }
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, []);

    const openNotificationTarget = (href: string) => {
        setNotificationsOpen(false);
        navigate(href);
    };

    return (
        <header className="flex h-auto shrink-0 flex-col gap-3 border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] px-4 py-3 md:h-16 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center">
                <h1 className="shrink-0 text-2xl leading-none font-semibold text-white dark:text-white">
                    {t('settings.title', 'Settings')}
                </h1>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">
                <label className="relative min-w-0 flex-1 md:w-72 md:flex-none">
                    <span className="sr-only">
                        {t('settings.search', 'Search settings')}
                    </span>
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--settings-muted-text)]" />
                    <input
                        className="settings-topbar-control h-10 w-full rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-active-background)] pl-9 text-sm text-slate-950 dark:text-slate-100"
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder={t(
                            'settings.search_placeholder',
                            'Search settings...',
                        )}
                        value={menuQuery}
                    />
                </label>

                <div className="relative">
                    <button
                        aria-expanded={notificationsOpen}
                        aria-label={t('settings.notifications', 'Notifications')}
                        className="settings-topbar-control relative grid size-10 place-items-center rounded-lg border border-[var(--settings-border-color)] text-[var(--settings-muted-text)] transition hover:text-[var(--settings-accent)]"
                        onClick={() => setNotificationsOpen((open) => !open)}
                        type="button"
                    >
                        <Bell className="size-4" />
                        {total > 0 ? (
                            <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-[var(--settings-accent)] px-1 text-xs font-semibold text-[var(--settings-accent-foreground)]">
                                {total > 99 ? '99+' : total}
                            </span>
                        ) : null}
                    </button>
                    {notificationsOpen ? (
                        <section
                            aria-label={t('settings.notifications', 'Notifications')}
                            className="settings-floating-panel absolute right-0 z-20 mt-2 w-[21rem] max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] p-3 shadow-lg"
                        >
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold">
                                    {t('settings.notifications', 'Notifications')}
                                </p>
                                {total > 0 ? (
                                    <span className="rounded-md bg-[var(--settings-active-background)] px-2 py-1 text-xs font-medium">
                                        {total} {t('settings.notifications.pending', 'open')}
                                    </span>
                                ) : null}
                            </div>
                            <div className="grid gap-2 text-sm">
                                <NotificationSummaryRow
                                    count={notifications.pending_feedback_requests}
                                    icon={NotebookPen}
                                    label={t('settings.notifications.feedback_requests', 'Feedback requests')}
                                    onClick={() =>
                                        openNotificationTarget(
                                            '/settings?panel=admin-learning-support&support=feedback-requests',
                                        )
                                    }
                                />
                                <NotificationSummaryRow
                                    count={notifications.pending_organization_icon_reports}
                                    icon={Shield}
                                    label={t('settings.notifications.organization_reports', 'Reported organization icons')}
                                    onClick={() =>
                                        openNotificationTarget(
                                            '/settings?panel=admin-learning-support&support=organization-icons',
                                        )
                                    }
                                />
                            </div>
                            {notifications.reported_organizations.length > 0 ? (
                                <div className="mt-3 border-t border-[var(--settings-border-color)] pt-3">
                                    <p className="mb-2 text-xs font-medium tracking-[0.14em] text-[var(--settings-muted-text)] uppercase">
                                        {t('settings.notifications.organizations', 'Organizations')}
                                    </p>
                                    <div className="flex gap-2">
                                        {notifications.reported_organizations.map((organization) => (
                                            <div
                                                aria-label={`${organization.name} icon`}
                                                className="grid size-9 overflow-hidden rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-active-background)] text-[var(--settings-muted-text)]"
                                                key={organization.icon_url ?? organization.name}
                                            >
                                                {organization.icon_url ? (
                                                    <img
                                                        alt={`${organization.name} icon`}
                                                        className="size-full object-cover"
                                                        src={organization.icon_url}
                                                    />
                                                ) : (
                                                    <Building2 className="m-auto size-4" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </section>
                    ) : null}
                </div>

                <a
                    aria-label={t('navigation.source', 'Source code')}
                    className="settings-topbar-control grid size-10 place-items-center rounded-lg border border-[var(--settings-border-color)] text-[var(--settings-muted-text)] transition hover:text-[var(--settings-accent)]"
                    href="https://github.com/WickedJack99/wicked_learning"
                    rel="noreferrer"
                    target="_blank"
                >
                    <HelpCircle className="size-4" />
                </a>
                {currentUser.kind === 'loaded' ? (
                    <div
                        aria-label={t(
                            'settings.account.signed_in',
                            'Signed-in account',
                        )}
                        className="settings-topbar-control flex h-10 min-w-0 items-center gap-2 rounded-lg border border-[var(--settings-border-color)] px-2 text-left"
                        data-wl-id="settings.current-user"
                    >
                        {currentUser.avatarUrl ? (
                            <img
                                alt=""
                                aria-hidden="true"
                                className="size-8 shrink-0 rounded-full object-cover"
                                src={currentUser.avatarUrl}
                            />
                        ) : (
                            <span
                                aria-hidden="true"
                                className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--settings-active-background)] text-xs font-medium text-[var(--settings-accent)]"
                            >
                                {accountName?.slice(0, 1).toUpperCase()}
                            </span>
                        )}
                        <span className="hidden max-w-48 truncate text-sm font-medium sm:block">
                            {accountName}
                        </span>
                    </div>
                ) : null}
            </div>
        </header>
    );
}

function NotificationSummaryRow({
    count,
    icon: Icon,
    label,
    onClick,
}: {
    count: number;
    icon: LucideIcon;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            className="flex items-center gap-3 rounded-md p-2 text-left transition hover:bg-[var(--settings-active-background)]"
            onClick={onClick}
            type="button"
        >
            <span className="grid size-8 place-items-center rounded-md bg-[color-mix(in_srgb,var(--settings-muted-text)_12%,transparent)] text-[var(--settings-muted-text)]">
                <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{label}</span>
            </span>
            <span className="rounded-md bg-[var(--settings-active-background)] px-2 py-1 text-xs font-medium">
                {count}
            </span>
        </button>
    );
}
