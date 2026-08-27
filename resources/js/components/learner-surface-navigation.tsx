import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import { LearnerNavigationHeader } from '@/components/learner-navigation-header';
import { readPersistedActiveActivity } from '@/features/world/active-activity';
import type { ActiveActivity } from '@/features/world/active-activity';
import { worldHref } from '@/features/world/types';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

type LearnerSurfaceItem = {
    active: boolean;
    href: string;
    id: string;
    label: string;
};

/** Keeps map and bookmark surfaces on the shared top navigation. */
export function LearnerSurfaceNavigation() {
    const { props, url } = usePage();
    const t = usePlatformTranslation();
    const isAuthenticated = Boolean(props.auth.user);
    const [activeActivity, setActiveActivity] = useState<ActiveActivity | null>(
        () => readPersistedActiveActivity(),
    );
    const applyActiveActivity = useCallback(
        (nextActivity: ActiveActivity | null) => {
            setActiveActivity(nextActivity);
        },
        [],
    );

    useEffect(() => {
        const readActiveActivity = () => {
            applyActiveActivity(readPersistedActiveActivity());
        };

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
            applyActiveActivity(readPersistedActiveActivity());
        }, 0);

        return () => window.clearTimeout(refreshTimer);
    }, [applyActiveActivity, url]);

    const isMapSurface = url.startsWith('/world');
    const isBookmarksSurface = url.startsWith('/bookmarks');

    if (!isMapSurface && !isBookmarksSurface) {
        return null;
    }

    const items: LearnerSurfaceItem[] = [
        {
            active: false,
            href: '/home',
            id: 'learning-desk',
            label: t('home.learning_desk.navigation.desk', 'Learning desk'),
        },
        {
            active: isMapSurface,
            href: worldHref,
            id: 'map',
            label: t('navigation.bottom.map', 'Map'),
        },
        ...(isAuthenticated
            ? [
                  {
                      active: isBookmarksSurface,
                      href: '/bookmarks',
                      id: 'bookmarks',
                      label: t(
                          'home.learning_desk.navigation.bookmarks',
                          'Bookmarks',
                      ),
                  },
              ]
            : []),
    ];

    if (activeActivity) {
        items.push({
            active: false,
            href:
                activeActivity.playHref ??
                activeActivity.worldHref ??
                worldHref,
            id: 'active-activity',
            label: t(
                'navigation.bottom.continue_activity',
                'Continue activity',
            ),
        });
    }

    return <LearnerNavigationHeader items={items} mapThemed position="fixed" />;
}
