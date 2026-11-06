import { ChevronDown, LogOut, NotebookPen, Settings } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import { OriginalJournalOverlay } from './original-journal';

const primaryItems = [
    { href: '/home', id: 'learning-desk', label: 'Learning desk' },
    { href: '/paths', id: 'paths', label: 'Paths' },
    { href: '/topics', id: 'topics', label: 'Topics' },
    { href: '/competence', id: 'competence', label: 'Competence map' },
    { href: '/bookmarks', id: 'bookmarks', label: 'Bookmarks' },
    { href: '/world', id: 'current-map', label: 'Current map' },
] as const;

/**
 * Source-adapted from the shared learner navigation header. Only Rust routes
 * with complete destinations are listed; unavailable source destinations are
 * not replaced with inert controls.
 */
export function OriginalLearnerHeader({
    onSignedOut,
    userEmail,
}: {
    onSignedOut: () => void;
    userEmail: string;
}) {
    const location = useLocation();
    const [isJournalOpen, setIsJournalOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [signOutError, setSignOutError] = useState<string | null>(null);

    async function signOut(): Promise<void> {
        setSignOutError(null);

        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST('/session/logout', {
                params: { header: { 'X-CSRF-Token': token } },
            });

            if (!response.ok) {
                throw new Error('logout unavailable');
            }

            setIsUserMenuOpen(false);
            onSignedOut();
        } catch {
            setSignOutError('Sign out is temporarily unavailable.');
        }
    }

    return (
        <header
            className="sticky top-0 z-40 border-b border-[var(--learner-border-color)] bg-[var(--learner-header-background,var(--learner-panel-background))] text-[var(--learner-heading-text)] backdrop-blur-xl"
            data-wl-id="learner.navigation.header"
        >
            <a
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-[80] focus:rounded-md focus:bg-[var(--learner-panel-background)] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-[var(--learner-action-accent)] focus:outline-none"
                href="#learner-main-content"
            >
                Skip to content
            </a>
            <div className="flex min-h-16 flex-wrap items-center gap-x-5 px-4 sm:px-6 lg:px-8 xl:flex-nowrap">
                <Link
                    className="flex shrink-0 items-center gap-3"
                    data-wl-id="learner.navigation.brand"
                    to="/home"
                >
                    <img alt="" aria-hidden="true" className="size-8 object-contain" draggable={false} src="/images/logo.png" />
                    <span className="hidden text-sm font-semibold tracking-wide sm:block">Learning Worlds</span>
                </Link>
                <nav
                    aria-label="Learner navigation"
                    className="order-3 -mx-4 flex w-[calc(100%+2rem)] basis-full flex-wrap gap-0 overflow-visible border-t border-[var(--learner-border-color)] px-4 xl:order-none xl:mx-0 xl:min-w-0 xl:flex-1 xl:flex-nowrap xl:border-t-0 xl:px-0 2xl:gap-1"
                    data-wl-id="learner.navigation.primary"
                >
                    {primaryItems.map((item) => {
                        const active = isActiveNavigationItem(
                            location.pathname,
                            item.href,
                        );

                        return (
                            <Link
                                aria-current={active ? 'page' : undefined}
                                className={`relative inline-flex shrink-0 items-center gap-2 px-2 py-3 text-sm transition hover:text-[var(--learner-heading-text)] focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none xl:py-[1.35rem] 2xl:px-3 ${active ? 'text-[var(--learner-heading-text)] after:absolute after:right-3 after:bottom-0 after:left-3 after:h-0.5 after:bg-[var(--learner-accent)]' : 'text-[var(--learner-muted-text)]'}`}
                                data-wl-id={`learner.navigation.item.${item.id}`}
                                key={item.id}
                                to={item.href}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
                <div className="relative ml-auto flex shrink-0 items-center gap-2">
                    <button
                        aria-controls="learning-journal-panel"
                        aria-expanded={isJournalOpen}
                        aria-label="Journal"
                        className="grid size-10 place-items-center rounded-lg border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] text-[var(--learner-muted-text)] transition hover:bg-white/10 hover:text-[var(--learner-heading-text)]"
                        onClick={() => setIsJournalOpen((open) => !open)}
                        type="button"
                    >
                        <NotebookPen className="size-4" />
                    </button>
                    <button
                        aria-expanded={isUserMenuOpen}
                        aria-haspopup="menu"
                        aria-label="Open user menu"
                        className="flex h-10 items-center gap-2 rounded-lg border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] px-2.5 transition hover:bg-white/10"
                        onClick={() => setIsUserMenuOpen((open) => !open)}
                        type="button"
                    >
                        <span className="grid size-7 place-items-center rounded-full bg-[color-mix(in_srgb,var(--learner-accent)_20%,transparent)] text-xs text-[var(--learner-accent)]">{userEmail.slice(0, 1).toUpperCase()}</span>
                        <span className="hidden max-w-32 truncate text-sm sm:block">{userEmail}</span>
                        <ChevronDown className="hidden size-3.5 text-[var(--learner-muted-text)] sm:block" />
                    </button>
                    {isUserMenuOpen ? (
                        <div className="absolute top-12 right-0 z-[80] w-60 rounded-lg border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] p-1 shadow-2xl" role="menu">
                            <div className="flex items-center gap-2 px-2 py-2 text-left text-sm"><span className="grid size-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--learner-accent)_20%,transparent)] text-xs text-[var(--learner-accent)]">{userEmail.slice(0, 1).toUpperCase()}</span><span className="min-w-0 truncate font-medium">{userEmail}</span></div>
                            <div aria-hidden="true" className="my-1 h-px bg-[var(--learner-border-color)]" />
                            <Link className="flex w-full items-center rounded-md px-2 py-2 text-left text-sm font-medium transition hover:bg-white/10" onClick={() => setIsUserMenuOpen(false)} role="menuitem" to="/settings"><Settings className="mr-2 size-4" />Settings</Link>
                            <button className="flex w-full items-center rounded-md px-2 py-2 text-left text-sm font-medium transition hover:bg-white/10" onClick={() => void signOut()} role="menuitem" type="button"><LogOut className="mr-2 size-4" />Log out</button>
                            {signOutError ? <p className="px-2 text-sm text-red-300" role="alert">{signOutError}</p> : null}
                        </div>
                    ) : null}
                </div>
            </div>
            {isJournalOpen ? <OriginalJournalOverlay onClose={() => setIsJournalOpen(false)} /> : null}
        </header>
    );
}

function isActiveNavigationItem(pathname: string, href: string): boolean {
    return href === '/home'
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`);
}
