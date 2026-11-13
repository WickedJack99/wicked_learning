import { Bookmark, DoorOpen, Github, Home, Info, Map } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import { usePlatformTranslation } from './original-platform-translation';

type SettingsCornerNavigationItem = {
    asButton?: boolean;
    danger?: boolean;
    href?: string;
    icon: ReactNode;
    label: string;
};

/**
 * Extracted from resources/js/features/settings/settings-corner-navigation.tsx.
 * The logout seam uses the standalone Rust session endpoint; source route
 * targets remain source-compatible React routes.
 */
export function SettingsCornerNavigation({
    onSignedOut,
}: {
    onSignedOut: () => void;
}) {
    const location = useLocation();
    const t = usePlatformTranslation();
    const selectedMapId = new URLSearchParams(location.search).get('map');
    const currentMapHref = selectedMapId
        ? `/world?map=${encodeURIComponent(selectedMapId)}`
        : '/world';

    const items: SettingsCornerNavigationItem[] = [
        {
            href: '/home',
            icon: <Home className="size-4" />,
            label: t('home.learning_desk.navigation.desk', 'Learning desk'),
        },
        {
            href: currentMapHref,
            icon: <Map className="size-4" />,
            label: t('navigation.primary.map', 'Map'),
        },
        {
            href: '/bookmarks',
            icon: <Bookmark className="size-4" />,
            label: t('navigation.primary.bookmarks', 'Bookmarks'),
        },
        {
            asButton: true,
            danger: true,
            icon: <DoorOpen className="size-4" />,
            label: t('navigation.primary.log_out', 'Log out'),
        },
        {
            href: '/source',
            icon: <Github className="size-4" />,
            label: t('navigation.source', 'Source code'),
        },
        {
            href: '/settings?panel=information',
            icon: <Info className="size-4" />,
            label: t('settings.navigation.about_and_legal', 'About & Legal'),
        },
    ];

    async function signOut(): Promise<void> {
        const token = await getCsrfToken();
        const { response } = await apiClient.POST('/session/logout', {
            params: { header: { 'X-CSRF-Token': token } },
        });

        if (!response.ok) {
            throw new Error('logout unavailable');
        }

        onSignedOut();
    }

    const renderItems = (className: string) => (
        <nav
            aria-label={t('settings.quick_navigation', 'Settings quick navigation')}
            className={className}
        >
            {items.map((item) => {
                const className = [
                    'grid h-10 grid-cols-[1.75rem_minmax(0,1fr)] items-center rounded-lg px-3 text-left text-sm font-medium text-[var(--settings-muted-text)] transition hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)] focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none',
                    item.danger &&
                        'text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-200 dark:hover:bg-red-400/10 dark:hover:text-red-100',
                ]
                    .filter(Boolean)
                    .join(' ');

                if (item.asButton) {
                    return (
                        <button
                            aria-label={item.label}
                            className={className}
                            key={item.label}
                            onClick={() => void signOut().catch(() => undefined)}
                            type="button"
                        >
                            {item.icon}
                            <span className="truncate">{item.label}</span>
                        </button>
                    );
                }

                return (
                    <Link
                        aria-label={item.label}
                        className={className}
                        key={item.label}
                        to={item.href!}
                    >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );

    return (
        <>
            <details className="border-t border-[var(--settings-border-color)] lg:hidden">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-[var(--settings-muted-text)] transition hover:text-[var(--settings-accent)] focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                    {t('settings.quick_navigation', 'Quick navigation')}
                </summary>
                {renderItems('grid gap-1 px-3 pb-3')}
            </details>
            {renderItems(
                'hidden gap-1 border-t border-[var(--settings-border-color)] px-3 pt-3 pb-4 lg:grid',
            )}
        </>
    );
}
