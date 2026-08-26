import { Link, usePage } from '@inertiajs/react';
import { Bookmark, Home, Map, PlayCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
    LearnerAccountControls,
    LearnerBrand,
} from '@/components/learner-account-controls';
import { readPersistedActiveActivity } from '@/features/world/active-activity';
import type { ActiveActivity } from '@/features/world/active-activity';
import { worldHref } from '@/features/world/types';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';
import type { LearningNode } from '@/types';

type NavItem = {
    active: boolean;
    href: string;
    icon: ReactNode;
    id: string;
    label: string;
    shouldAnimateInsertion?: boolean;
};

const navItemSize = 44;
const navItemGap = 4;
const navPadding = 12;

export function AppBottomNav() {
    const { props, url } = usePage();
    const t = usePlatformTranslation();
    const isAuthenticated = Boolean(props.auth.user);
    const pageNode = (
        props as typeof props & {
            node?: Pick<LearningNode, 'mapSlug' | 'slug'> | null;
        }
    ).node;
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

    const isMapActive = useMemo(() => url.startsWith('/world'), [url]);
    const isLearningDeskActive = useMemo(
        () => url.split('?')[0] === '/home',
        [url],
    );
    const isBookmarksActive = useMemo(
        () => url.startsWith('/bookmarks'),
        [url],
    );
    const mapNavigationHref = useMemo(
        () =>
            pageNode && url.startsWith('/learning/')
                ? `/world?map=${encodeURIComponent(pageNode.mapSlug)}&focused=${encodeURIComponent(pageNode.slug)}`
                : worldHref,
        [pageNode, url],
    );
    const isImmersiveSurface = useMemo(
        () =>
            url.startsWith('/world') ||
            url.startsWith('/bookmarks') ||
            url.startsWith('/learning/'),
        [url],
    );
    const items = useMemo<NavItem[]>(() => {
        const baseItems: NavItem[] = [
            {
                active: isLearningDeskActive,
                href: '/home',
                icon: <Home className="size-5" />,
                id: 'learning-desk',
                label: t('navigation.bottom.learning_desk', 'Learning desk'),
            },
            {
                active: isMapActive,
                href: mapNavigationHref,
                icon: <Map className="size-5" />,
                id: 'map',
                label: t('navigation.bottom.map', 'Map'),
            },
            ...(isAuthenticated
                ? [
                      {
                          active: isBookmarksActive,
                          href: '/bookmarks',
                          icon: <Bookmark className="size-5" />,
                          id: 'bookmarks',
                          label: t('navigation.bottom.bookmarks', 'Bookmarks'),
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
                label: t(
                    isMapActive || isBookmarksActive
                        ? 'navigation.bottom.continue_activity'
                        : 'navigation.bottom.return_to_activity',
                    isMapActive || isBookmarksActive
                        ? 'Continue activity'
                        : 'Return to :title',
                    isMapActive || isBookmarksActive
                        ? undefined
                        : { title: activeActivity.activityTitle },
                ),
            },
            ...baseItems,
        ];
    }, [
        activeActivity,
        isBookmarksActive,
        isLearningDeskActive,
        isMapActive,
        mapNavigationHref,
        isAuthenticated,
        shouldAnimateActiveActivity,
        t,
    ]);

    if (!isImmersiveSurface) {
        return null;
    }

    if (isMapActive || isBookmarksActive) {
        return <ImmersiveTopNav items={items} />;
    }

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

function ImmersiveTopNav({ items }: { items: NavItem[] }) {
    const t = usePlatformTranslation();

    return (
        <nav
            aria-label={t(
                'home.learning_desk.navigation.label',
                'Learner navigation',
            )}
            className="fixed top-0 right-0 left-0 z-[70] border-b border-slate-200/80 bg-slate-50/94 backdrop-blur-xl dark:border-white/10 dark:bg-[#08111b]/94"
        >
            <div className="flex min-h-16 flex-wrap items-center gap-x-5 px-4 sm:flex-nowrap sm:px-6 lg:px-8">
                <LearnerBrand />

                <div className="order-3 -mx-4 flex w-[calc(100%+2rem)] basis-full gap-1 overflow-x-auto border-t border-slate-200/70 px-4 sm:order-none sm:mx-0 sm:w-auto sm:basis-auto sm:border-t-0 sm:px-0 dark:border-white/8">
                    {items.map((item) => (
                        <ImmersiveTopNavItem item={item} key={item.id} />
                    ))}
                </div>

                <LearnerAccountControls mapThemed />
            </div>
        </nav>
    );
}

function ImmersiveTopNavItem({ item }: { item: NavItem }) {
    return (
        <Link
            aria-label={item.label}
            className={cn(
                'relative shrink-0 px-3 py-3 text-sm text-slate-500 transition hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none sm:py-[1.35rem] dark:text-slate-400 dark:hover:text-white',
                item.active &&
                    'text-slate-950 after:absolute after:right-3 after:bottom-0 after:left-3 after:h-0.5 after:bg-violet-500 dark:text-white',
            )}
            href={item.href}
            style={{ cursor: 'var(--platform-action-cursor)' }}
        >
            <span>{item.label}</span>
        </Link>
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
                href={item.href}
                label={item.label}
            >
                {item.icon}
            </FloatingNavLink>
        </div>
    );
}

function FloatingNavLink({
    active,
    children,
    href,
    label,
}: {
    active: boolean;
    children: ReactNode;
    href: string;
    label: string;
}) {
    return (
        <Link
            aria-label={label}
            className={cn(
                'flex size-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
                active &&
                    'bg-[var(--map-bottom-nav-active-background)] text-[var(--map-bottom-nav-active-icon-color)] hover:bg-[var(--map-bottom-nav-active-background)] hover:text-[var(--map-bottom-nav-active-icon-color)]',
            )}
            href={href}
            style={{
                background: active
                    ? 'var(--map-bottom-nav-active-background)'
                    : undefined,
                color: active
                    ? 'var(--map-bottom-nav-active-icon-color, var(--map-bottom-nav-active-text-color))'
                    : 'var(--map-bottom-nav-icon-color, var(--map-bottom-nav-text-color))',
                cursor: 'var(--platform-action-cursor)',
            }}
        >
            {children}
        </Link>
    );
}
