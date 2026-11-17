import { usePage } from '@inertiajs/react';
import {
    appendLearnerContextNavigation,
    createLearnerPrimaryNavigation,
} from '@/components/learner-navigation';
import { LearnerNavigationHeader } from '@/components/learner-navigation-header';
import { worldHref } from '@/features/world/types';
import { usePersistedActiveActivity } from '@/features/world/use-persisted-active-activity';
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
    const activeActivity = usePersistedActiveActivity(url);

    const isMapSurface = url.startsWith('/world');
    const isBookmarksSurface = url.startsWith('/bookmarks');

    if (!isMapSurface && !isBookmarksSurface) {
        return null;
    }

    const items: LearnerSurfaceItem[] = createLearnerPrimaryNavigation(t, {
        activeId: isBookmarksSurface ? 'bookmarks' : undefined,
    });

    if (!isAuthenticated) {
        items.splice(1, 5);
    }

    appendLearnerContextNavigation(t, items, {
        continueHref: activeActivity?.playHref,
        currentMapActive: isMapSurface,
        currentMapHref: isMapSurface
            ? url
            : (activeActivity?.worldHref ?? worldHref),
    });

    return <LearnerNavigationHeader items={items} mapThemed position="fixed" />;
}
