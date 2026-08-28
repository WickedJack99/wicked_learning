import { usePage } from '@inertiajs/react';
import {
    appendLearnerContextNavigation,
    createLearnerPrimaryNavigation,
} from '@/components/learner-navigation';
import { LearnerNavigationHeader } from '@/components/learner-navigation-header';
import type { LearnerNavigationItem } from '@/components/learner-navigation-header';
import { worldHref } from '@/features/world/types';
import { usePersistedActiveActivity } from '@/features/world/use-persisted-active-activity';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export function LearningDeskHeader() {
    const page = usePage();
    const t = usePlatformTranslation();
    const activeActivity = usePersistedActiveActivity(page.url);
    const items: LearnerNavigationItem[] = appendLearnerContextNavigation(
        t,
        createLearnerPrimaryNavigation(t, {
            activeUrl: page.url,
        }),
        {
            continueHref: activeActivity?.playHref ?? activeActivity?.worldHref,
            currentMapHref: activeActivity?.worldHref ?? worldHref,
        },
    );

    return <LearnerNavigationHeader items={items} />;
}
