import { Link, router, usePage } from '@inertiajs/react';
import { Cog, DoorOpen, Map, PlayCircle } from 'lucide-react';
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
import { platformActionCursor, platformCursor } from '@/theme/cursors';

type NavItem = {
    active: boolean;
    asButton?: boolean;
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
    const { url } = usePage();
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

    const isMapActive = useMemo(
        () => url.startsWith('/world') || url.startsWith('/dashboard'),
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
                icon: (
                    <DoorOpen className="size-5 text-red-600 dark:text-red-400" />
                ),
                id: 'logout',
                label: 'Log out',
                onClick: handleLogout,
            },
        ];

        if (!activeActivity) {
            return baseItems;
        }

        return [
            {
                active: false,
                href: activeActivity.worldHref ?? worldHref,
                icon: <PlayCircle className="size-5" />,
                id: 'active-activity',
                shouldAnimateInsertion: shouldAnimateActiveActivity,
                label: `Return to ${activeActivity.activityTitle}`,
            },
            ...baseItems,
        ];
    }, [
        activeActivity,
        isMapActive,
        isSettingsActive,
        handleLogout,
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
                cursor: platformCursor,
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
}: {
    active: boolean;
    asButton?: boolean;
    children: ReactNode;
    href: string | ReturnType<typeof logout>;
    label: string;
    onClick?: () => void;
}) {
    return (
        <Link
            aria-label={label}
            as={asButton ? 'button' : undefined}
            className={cn(
                'flex size-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-teal-200',
                active &&
                    'bg-cyan-600 text-white hover:bg-cyan-500 hover:text-white dark:bg-teal-300 dark:text-slate-950 dark:hover:bg-teal-200 dark:hover:text-slate-950',
            )}
            href={href}
            onClick={onClick}
            style={{ cursor: platformActionCursor }}
        >
            {children}
        </Link>
    );
}
