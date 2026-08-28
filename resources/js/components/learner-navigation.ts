import type { LearnerNavigationItem } from './learner-navigation-header';

type LearnerNavigationTranslator = (key: string, fallback: string) => string;

export const learnerPrimaryNavigation = [
    {
        href: '/home',
        id: 'learning-desk',
        key: 'home.learning_desk.navigation.desk',
        fallback: 'Learning desk',
    },
    {
        href: '/paths',
        id: 'paths',
        key: 'home.learning_desk.navigation.paths',
        fallback: 'Paths',
    },
    {
        href: '/topics',
        id: 'topics',
        key: 'home.learning_desk.navigation.topics',
        fallback: 'Topics',
    },
    {
        href: '/competence',
        id: 'competence',
        key: 'home.learning_desk.navigation.competence',
        fallback: 'Competence map',
    },
    {
        href: '/learning/journal',
        id: 'journal',
        key: 'home.learning_desk.navigation.journal',
        fallback: 'Journal',
    },
    {
        href: '/bookmarks',
        id: 'bookmarks',
        key: 'home.learning_desk.navigation.bookmarks',
        fallback: 'Bookmarks',
    },
] as const;

export function createLearnerPrimaryNavigation(
    t: LearnerNavigationTranslator,
    options: {
        activeId?: string;
        activeUrl?: string;
        journalOpen?: boolean;
        onJournalOpen?: () => void;
    } = {},
): Array<LearnerNavigationItem & { id: string }> {
    return learnerPrimaryNavigation.map((item) => ({
        active:
            item.id === 'journal'
                ? (options.journalOpen ?? false)
                : item.id === options.activeId ||
                  (options.activeUrl
                      ? isLearnerNavigationItemActive(
                            options.activeUrl,
                            item.href,
                        )
                      : false),
        href: item.href,
        id: item.id,
        label: t(item.key, item.fallback),
        onClick:
            item.id === 'journal' && options.onJournalOpen
                ? options.onJournalOpen
                : undefined,
    }));
}

export function appendLearnerContextNavigation(
    t: LearnerNavigationTranslator,
    items: LearnerNavigationItem[],
    options: {
        currentMapHref: string;
        currentMapActive?: boolean;
        continueHref?: string;
        continueActive?: boolean;
    },
): LearnerNavigationItem[] {
    items.push({
        active: options.currentMapActive ?? false,
        href: options.currentMapHref,
        label: t('navigation.primary.current_map', 'Current map'),
    });

    if (options.continueHref) {
        items.push({
            active: options.continueActive ?? false,
            href: options.continueHref,
            label: t('navigation.activity.continue', 'Continue activity'),
        });
    }

    return items;
}

export function isLearnerNavigationItemActive(
    url: string,
    href: string,
): boolean {
    const path = url.split('?')[0];

    if (href === '/home') {
        return path === href;
    }

    return path === href || path.startsWith(`${href}/`);
}
