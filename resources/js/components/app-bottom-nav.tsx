import { Link, router, usePage } from '@inertiajs/react';
import { Bookmark, Cog, DoorOpen, Map, PlayCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
    clearPersistedActiveActivity,
    readPersistedActiveActivity,
} from '@/features/world/active-activity';
import type { ActiveActivity } from '@/features/world/active-activity';
import { worldHref } from '@/features/world/types';
import { cn } from '@/lib/utils';
import { logout } from '@/routes';

type NavItem = {
    active: boolean;
    asButton?: boolean;
    danger?: boolean;
    href: string | ReturnType<typeof logout>;
    icon: ReactNode;
    id: string;
    label: string;
    onClick?: () => void;
    shouldAnimateInsertion?: boolean;
};

const navItemSize = 44;
const navItemGap = 4;
const navPadding = 12;

export function AppBottomNav() {
    const { props, url } = usePage();
    const isAuthenticated = Boolean(props.auth.user);
    const [activeActivity, setActiveActivity] = useState<ActiveActivity | null>(
        () => readPersistedActiveActivity(),
    );
    const [shouldAnimateActiveActivity, setShouldAnimateActiveActivity] =
        useState(false);
    const activeActivityRef = useRef(activeActivity);
    const hasSyncedStoredActivity = useRef(false);
    const applyActiveActivity = useCallback(
        (
            nextActivity: ActiveActivity | null,
            shouldAnimateWhenAdded: boolean,
        ) => {
            const previousActivity = activeActivityRef.current;
            const wasAddedAfterInitialRender =
                hasSyncedStoredActivity.current &&
                shouldAnimateWhenAdded &&
                !previousActivity &&
                Boolean(nextActivity);

            activeActivityRef.current = nextActivity;
            hasSyncedStoredActivity.current = true;
            setShouldAnimateActiveActivity(wasAddedAfterInitialRender);
            setActiveActivity(nextActivity);
        },
        [],
    );

    useEffect(() => {
        const readActiveActivity = () => {
            applyActiveActivity(readPersistedActiveActivity(), true);
        };

        applyActiveActivity(readPersistedActiveActivity(), false);
        window.addEventListener(
            'learning:active-activity-changed',
            readActiveActivity,
        );
        window.addEventListener('storage', readActiveActivity);

        return () => {
            window.removeEventListener(
                'learning:active-activity-changed',
                readActiveActivity,
            );
            window.removeEventListener('storage', readActiveActivity);
        };
    }, [applyActiveActivity]);

    useEffect(() => {
        const refreshTimer = window.setTimeout(() => {
            applyActiveActivity(readPersistedActiveActivity(), false);
        }, 0);

        return () => window.clearTimeout(refreshTimer);
    }, [applyActiveActivity, url]);

    const handleLogout = useCallback(() => {
        clearPersistedActiveActivity();
        router.flushAll();
    }, []);

    const isMapActive = useMemo(() => url.startsWith('/world'), [url]);
    const isBookmarksActive = useMemo(
        () => url.startsWith('/bookmarks'),
        [url],
    );
    const isSettingsActive = useMemo(() => url.startsWith('/settings'), [url]);
    const items = useMemo<NavItem[]>(() => {
        const baseItems: NavItem[] = [
            {
                active: isMapActive,
                href: worldHref,
                icon: <Map className="size-5" />,
                id: 'map',
                label: 'Map',
            },
            ...(isAuthenticated
                ? [
                      {
                          active: isBookmarksActive,
                          href: '/bookmarks',
                          icon: <Bookmark className="size-5" />,
                          id: 'bookmarks',
                          label: 'Bookmarks',
                      },
                      {
                          active: isSettingsActive,
                          href: '/settings',
                          icon: <Cog className="size-5" />,
                          id: 'settings',
                          label: 'Settings',
                      },
                      {
                          active: false,
                          asButton: true,
                          href: logout(),
                          icon: <DoorOpen className="size-5" />,
                          id: 'logout',
                          label: 'Log out',
                          onClick: handleLogout,
                          danger: true,
                      },
                  ]
                : []),
        ];

        if (!activeActivity) {
            return baseItems;
        }

        return [
            {
                active: false,
                href:
                    activeActivity.playHref ??
                    activeActivity.worldHref ??
                    worldHref,
                icon: <PlayCircle className="size-5" />,
                id: 'active-activity',
                shouldAnimateInsertion: shouldAnimateActiveActivity,
                label: `Return to ${activeActivity.activityTitle}`,
            },
            ...baseItems,
        ];
    }, [
        activeActivity,
        isBookmarksActive,
        isMapActive,
        isSettingsActive,
        handleLogout,
        isAuthenticated,
        shouldAnimateActiveActivity,
    ]);
    const navWidth =
        navPadding +
        items.length * navItemSize +
        Math.max(0, items.length - 1) * navItemGap;

    return (
        <nav
            aria-label="Primary"
            className="fixed bottom-4 left-1/2 z-40 h-14 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/88 p-1.5 shadow-2xl shadow-slate-950/15 backdrop-blur-md transition-[width,background-color,border-color,box-shadow] duration-1000 ease-out dark:border-white/12 dark:bg-slate-950/82 dark:shadow-black/35"
            style={{
                background: 'var(--map-bottom-nav-background)',
                borderColor: 'var(--map-bottom-nav-border-color)',
                color: 'var(--map-bottom-nav-text-color)',
                cursor: 'var(--platform-cursor)',
                width: navWidth,
            }}
        >
            <div className="relative h-11">
                {items.map((item, index) => (
                    <AnimatedNavButton item={item} key={item.id} slot={index} />
                ))}
            </div>
        </nav>
    );
}

function AnimatedNavButton({ item, slot }: { item: NavItem; slot: number }) {
    return (
        <div
            className={cn(
                'absolute top-0 left-0 transition-[opacity,transform] duration-1000 ease-out',
                item.shouldAnimateInsertion && 'animate-nav-inserted-item',
            )}
            style={{
                transform: `translateX(${slot * (navItemSize + navItemGap)}px)`,
            }}
        >
            <FloatingNavLink
                active={item.active}
                asButton={item.asButton}
                href={item.href}
                label={item.label}
                onClick={item.onClick}
                danger={item.danger}
            >
                {item.icon}
            </FloatingNavLink>
        </div>
    );
}

function FloatingNavLink({
    active,
    asButton,
    children,
    href,
    label,
    onClick,
    danger = false,
}: {
    active: boolean;
    asButton?: boolean;
    children: ReactNode;
    danger?: boolean;
    href: string | ReturnType<typeof logout>;
    label: string;
    onClick?: () => void;
}) {
    return (
        <Link
            aria-label={label}
            as={asButton ? 'button' : undefined}
            className={cn(
                'flex size-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
                active &&
                    'bg-[var(--map-bottom-nav-active-background)] text-[var(--map-bottom-nav-active-icon-color)] hover:bg-[var(--map-bottom-nav-active-background)] hover:text-[var(--map-bottom-nav-active-icon-color)]',
            )}
            href={href}
            onClick={onClick}
            style={{
                background: active
                    ? 'var(--map-bottom-nav-active-background)'
                    : undefined,
                color: active
                    ? 'var(--map-bottom-nav-active-icon-color, var(--map-bottom-nav-active-text-color))'
                    : danger
                      ? 'var(--map-bottom-nav-exit-icon-color)'
                      : 'var(--map-bottom-nav-icon-color, var(--map-bottom-nav-text-color))',
                cursor: 'var(--platform-action-cursor)',
            }}
        >
            {children}
        </Link>
    );
}
