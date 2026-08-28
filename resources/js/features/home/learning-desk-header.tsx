import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    appendLearnerContextNavigation,
    createLearnerPrimaryNavigation,
} from '@/components/learner-navigation';
import { LearnerNavigationHeader } from '@/components/learner-navigation-header';
import type { LearnerNavigationItem } from '@/components/learner-navigation-header';
import { JournalOverlay } from '@/features/journal/journal-overlay';
import { worldHref } from '@/features/world/types';
import { usePersistedActiveActivity } from '@/features/world/use-persisted-active-activity';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export function LearningDeskHeader() {
    const page = usePage();
    const t = usePlatformTranslation();
    const activeActivity = usePersistedActiveActivity(page.url);
    const [journalOpen, setJournalOpen] = useState(() =>
        journalQueryIsOpen(page.url),
    );
    const closeJournal = () => {
        setJournalOpen(false);

        if (!journalQueryIsOpen(page.url)) {
            return;
        }

        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete('journal');
        window.history.replaceState(
            window.history.state,
            '',
            `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
        );
    };
    const items: LearnerNavigationItem[] = appendLearnerContextNavigation(
        t,
        createLearnerPrimaryNavigation(t, {
            activeUrl: page.url,
            journalOpen,
            onJournalOpen: () => setJournalOpen(true),
        }),
        {
            continueHref: activeActivity?.playHref ?? activeActivity?.worldHref,
            currentMapHref: activeActivity?.worldHref ?? worldHref,
        },
    );

    return (
        <>
            <LearnerNavigationHeader items={items} />
            {journalOpen ? <JournalOverlay onClose={closeJournal} /> : null}
        </>
    );
}

function journalQueryIsOpen(url: string): boolean {
    return (
        new URL(url, 'http://learning.local').searchParams.get('journal') ===
        '1'
    );
}
