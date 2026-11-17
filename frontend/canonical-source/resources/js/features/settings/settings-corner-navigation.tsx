import { Link, router, usePage } from '@inertiajs/react';
import { Bookmark, DoorOpen, Github, Home, Info, Map } from 'lucide-react';
import type { ReactNode } from 'react';
import { clearPersistedActiveActivity } from '@/features/world/active-activity';
import { worldHref } from '@/features/world/types';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';
import { logout } from '@/routes';

type SettingsCornerNavigationItem = {
    danger?: boolean;
    href: string | ReturnType<typeof logout>;
    icon: ReactNode;
    label: string;
    onClick?: () => void;
    asButton?: boolean;
};

export function SettingsCornerNavigation() {
    const { props } = usePage();
    const t = usePlatformTranslation();
    const currentMapHref = props.menuTheme?.mapSlug
        ? `${worldHref}?map=${encodeURIComponent(props.menuTheme.mapSlug)}`
        : worldHref;

    const handleLogout = () => {
        clearPersistedActiveActivity();
        router.flushAll();
    };

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
            href: logout(),
            icon: <DoorOpen className="size-4" />,
            label: t('navigation.primary.log_out', 'Log out'),
            onClick: handleLogout,
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

    const renderItems = (className: string) => (
        <nav
            aria-label={t(
                'settings.quick_navigation',
                'Settings quick navigation',
            )}
            className={className}
        >
            {items.map((item) => (
                <Link
                    aria-label={item.label}
                    as={item.asButton ? 'button' : undefined}
                    className={cn(
                        'grid h-10 grid-cols-[1.75rem_minmax(0,1fr)] items-center rounded-lg px-3 text-left text-sm font-medium text-[var(--settings-muted-text)] transition hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)] focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none',
                        item.danger &&
                            'text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-200 dark:hover:bg-red-400/10 dark:hover:text-red-100',
                    )}
                    href={item.href}
                    key={item.label}
                    onClick={item.onClick}
                >
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                </Link>
            ))}
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
