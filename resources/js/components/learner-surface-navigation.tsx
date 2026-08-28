import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import { createLearnerPrimaryNavigation } from '@/components/learner-navigation';
import { LearnerNavigationHeader } from '@/components/learner-navigation-header';
import { JournalOverlay } from '@/features/journal/journal-overlay';
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
    const [journalOpen, setJournalOpen] = useState(false);
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

    const items: LearnerSurfaceItem[] = createLearnerPrimaryNavigation(t, {
        activeId: isBookmarksSurface ? 'bookmarks' : undefined,
        journalOpen,
        onJournalOpen: () => setJournalOpen(true),
    });

    if (!isAuthenticated) {
        items.splice(1, 5);
    }

    items.push({
        active: isMapSurface,
        href: worldHref,
        id: 'map',
        label: t('navigation.primary.map', 'Map'),
    });

    if (activeActivity) {
        items.push({
            active: false,
            href:
                activeActivity.playHref ??
                activeActivity.worldHref ??
                worldHref,
            id: 'active-activity',
            label: t('navigation.activity.continue', 'Continue activity'),
        });
    }

    return (
        <>
            <LearnerNavigationHeader items={items} mapThemed position="fixed" />
            {journalOpen ? (
                <JournalOverlay onClose={() => setJournalOpen(false)} />
            ) : null}
        </>
    );
}
