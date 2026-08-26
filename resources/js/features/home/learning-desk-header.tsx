import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import { LearnerNavigationHeader } from '@/components/learner-navigation-header';
import type { LearnerNavigationItem } from '@/components/learner-navigation-header';
import { JournalOverlay } from '@/features/journal/journal-overlay';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

const navigation = [
    {
        href: '/home',
        key: 'home.learning_desk.navigation.desk',
        fallback: 'Learning desk',
    },
    {
        href: '/paths',
        key: 'home.learning_desk.navigation.paths',
        fallback: 'Paths',
    },
    {
        href: '/topics',
        key: 'home.learning_desk.navigation.topics',
        fallback: 'Topics',
    },
    {
        href: '/competence',
        key: 'home.learning_desk.navigation.competence',
        fallback: 'Competence map',
    },
    {
        href: '/learning/journal',
        key: 'home.learning_desk.navigation.journal',
        fallback: 'Journal',
    },
    {
        href: '/bookmarks',
        key: 'home.learning_desk.navigation.bookmarks',
        fallback: 'Bookmarks',
    },
];

export function LearningDeskHeader() {
    const page = usePage();
    const t = usePlatformTranslation();
    const [journalOpen, setJournalOpen] = useState(false);
    const items: LearnerNavigationItem[] = navigation.map((item) => ({
        active:
            item.href === '/learning/journal'
                ? journalOpen
                : isActiveNavigationItem(page.url, item.href),
        href: item.href,
        label: t(item.key, item.fallback),
        onClick:
            item.href === '/learning/journal'
                ? () => setJournalOpen(true)
                : undefined,
    }));

    return (
        <>
            <LearnerNavigationHeader items={items} />
            {journalOpen ? (
                <JournalOverlay onClose={() => setJournalOpen(false)} />
            ) : null}
        </>
    );
}

function isActiveNavigationItem(url: string, href: string): boolean {
    const path = url.split('?')[0];

    if (href === '/home') {
        return path === href;
    }

    return path === href || path.startsWith(`${href}/`);
}
