import { Link, usePage } from '@inertiajs/react';
import { Bell, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserMenuContent } from '@/components/user-menu-content';
import { JournalOverlay } from '@/features/journal/journal-overlay';
import { useInitials } from '@/hooks/use-initials';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';

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
    const { auth, name } = page.props;
    const initials = useInitials();
    const t = usePlatformTranslation();
    const [journalOpen, setJournalOpen] = useState(false);

    return (
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-slate-50/94 backdrop-blur-xl dark:border-white/10 dark:bg-[#08111b]/94">
            <div className="flex min-h-16 flex-wrap items-center gap-x-5 px-4 sm:flex-nowrap sm:px-6 lg:px-8">
                <Link className="flex shrink-0 items-center gap-3" href="/home">
                    <AppLogoIcon className="size-8 text-violet-600 dark:text-violet-400" />
                    <span className="hidden text-sm font-semibold tracking-wide text-slate-900 sm:block dark:text-slate-100">
                        {name}
                    </span>
                </Link>

                <nav
                    aria-label={t(
                        'home.learning_desk.navigation.label',
                        'Learner navigation',
                    )}
                    className="order-3 -mx-4 flex w-[calc(100%+2rem)] basis-full gap-1 overflow-x-auto border-t border-slate-200/70 px-4 sm:order-none sm:mx-0 sm:w-auto sm:basis-auto sm:border-t-0 sm:px-0 dark:border-white/8"
                >
                    {navigation.map((item) => (
                        <LearningDeskNavigationItem
                            isActive={
                                item.href === '/learning/journal'
                                    ? journalOpen
                                    : isActiveNavigationItem(
                                          page.url,
                                          item.href,
                                      )
                            }
                            item={item}
                            key={item.href}
                            onOpenJournal={
                                item.href === '/learning/journal'
                                    ? () => setJournalOpen(true)
                                    : undefined
                            }
                            t={t}
                        />
                    ))}
                </nav>

                <div className="ml-auto flex shrink-0 items-center gap-2">
                    <Button
                        asChild
                        aria-label={t(
                            'home.learning_desk.notifications',
                            'Notifications',
                        )}
                        className="rounded-lg border border-slate-200 bg-white text-slate-600 shadow-none hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/9 dark:hover:text-white"
                        size="icon"
                        variant="ghost"
                    >
                        <Link href="/settings?panel=personal&personal=notifications">
                            <Bell className="size-4" />
                        </Link>
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                className="h-10 gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-slate-900 shadow-none hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/9"
                                variant="ghost"
                            >
                                <Avatar className="size-7">
                                    <AvatarImage
                                        alt={auth.user?.name ?? ''}
                                        src={auth.user?.avatar ?? undefined}
                                    />
                                    <AvatarFallback className="bg-violet-500/20 text-xs text-violet-700 dark:text-violet-200">
                                        {initials(auth.user?.name ?? '')}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="hidden max-w-32 truncate text-sm sm:block">
                                    {auth.user?.name}
                                </span>
                                <ChevronDown className="hidden size-3.5 text-slate-400 sm:block" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                            {auth.user ? (
                                <UserMenuContent user={auth.user} />
                            ) : null}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            {journalOpen ? (
                <JournalOverlay onClose={() => setJournalOpen(false)} />
            ) : null}
        </header>
    );
}

function LearningDeskNavigationItem({
    isActive,
    item,
    onOpenJournal,
    t,
}: {
    isActive: boolean;
    item: (typeof navigation)[number];
    onOpenJournal?: () => void;
    t: ReturnType<typeof usePlatformTranslation>;
}) {
    const className = cn(
        'relative shrink-0 px-3 py-3 text-sm text-slate-500 transition hover:text-slate-950 sm:py-[1.35rem] dark:text-slate-400 dark:hover:text-white',
        isActive &&
            'text-slate-950 after:absolute after:right-3 after:bottom-0 after:left-3 after:h-0.5 after:bg-violet-500 dark:text-white',
    );

    if (onOpenJournal) {
        return (
            <button
                aria-expanded={isActive}
                className={className}
                onClick={onOpenJournal}
                type="button"
            >
                {t(item.key, item.fallback)}
            </button>
        );
    }

    return (
        <Link className={className} href={item.href}>
            {t(item.key, item.fallback)}
        </Link>
    );
}

function isActiveNavigationItem(url: string, href: string): boolean {
    const path = url.split('?')[0];

    if (href === '/home') {
        return path === href;
    }

    return path === href || path.startsWith(`${href}/`);
}
