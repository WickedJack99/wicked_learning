import { Link, usePage } from '@inertiajs/react';
import { Bell, ChevronDown, NotebookPen } from 'lucide-react';
import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { PlatformLogo } from '@/components/platform-logo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserMenuContent } from '@/components/user-menu-content';
import { JournalOverlay } from '@/features/journal/journal-overlay';
import { mapControlCssVariables } from '@/features/world/map-control-theme';
import { useAppearance } from '@/hooks/use-appearance';
import { useInitials } from '@/hooks/use-initials';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';

type Props = {
    className?: string;
    mapThemed?: boolean;
};

export function LearnerAccountControls({
    className,
    mapThemed = false,
}: Props) {
    const { props, url } = usePage();
    const { auth } = props;
    const initials = useInitials();
    const t = usePlatformTranslation();
    const { resolvedAppearance } = useAppearance();
    const [journalOpen, setJournalOpen] = useState(() =>
        journalQueryIsOpen(url),
    );
    const journalTriggerRef = useRef<HTMLButtonElement | null>(null);

    const mapControlVariables = mapThemed
        ? mapControlCssVariables(
              props.menuTheme?.backgroundConfig,
              resolvedAppearance,
          )
        : null;
    const menuStyle: CSSProperties | undefined = mapControlVariables
        ? {
              background:
                  mapControlVariables['--map-side-control-panel-background'] ??
                  'rgb(17 24 32 / 0.98)',
              borderColor:
                  mapControlVariables[
                      '--map-side-control-panel-border-color'
                  ] ?? 'rgb(51 65 85)',
              color:
                  mapControlVariables['--map-side-control-text-color'] ??
                  'rgb(226 232 240)',
          }
        : undefined;

    const closeJournal = () => {
        setJournalOpen(false);

        if (journalQueryIsOpen(url)) {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.delete('journal');
            window.history.replaceState(
                window.history.state,
                '',
                `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
            );
        }

        window.setTimeout(() => journalTriggerRef.current?.focus(), 0);
    };

    return (
        <>
            <div
                className={cn(
                    'ml-auto flex shrink-0 items-center gap-2',
                    className,
                )}
            >
                <Button
                    asChild
                    aria-label={t(
                        'home.learning_desk.notifications',
                        'Notifications',
                    )}
                    className="rounded-lg border bg-[var(--learner-panel-background)] text-[var(--learner-muted-text)] shadow-none hover:bg-[var(--learner-panel-muted-background)] hover:text-[var(--learner-heading-text)]"
                    size="icon"
                    variant="ghost"
                    style={{ borderColor: 'var(--learner-border-color)' }}
                >
                    <Link href="/settings?panel=personal&personal=notifications">
                        <Bell className="size-4" />
                    </Link>
                </Button>

                {auth.user ? (
                    <Button
                        aria-controls="learning-journal-panel"
                        aria-expanded={journalOpen}
                        aria-label={t('navigation.primary.journal', 'Journal')}
                        className="rounded-lg border bg-[var(--learner-panel-background)] text-[var(--learner-muted-text)] shadow-none hover:bg-[var(--learner-panel-muted-background)] hover:text-[var(--learner-heading-text)]"
                        onClick={() => {
                            if (journalOpen) {
                                closeJournal();

                                return;
                            }

                            setJournalOpen(true);
                        }}
                        ref={journalTriggerRef}
                        size="icon"
                        variant="ghost"
                        style={{ borderColor: 'var(--learner-border-color)' }}
                    >
                        <NotebookPen className="size-4" />
                    </Button>
                ) : null}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            className="h-10 gap-2 rounded-lg border bg-[var(--learner-panel-background)] px-2.5 text-[var(--learner-heading-text)] shadow-none hover:bg-[var(--learner-panel-muted-background)]"
                            variant="ghost"
                            style={{
                                borderColor: 'var(--learner-border-color)',
                            }}
                        >
                            <Avatar className="size-7">
                                <AvatarImage
                                    alt={auth.user?.name ?? ''}
                                    src={auth.user?.avatar ?? undefined}
                                />
                                <AvatarFallback className="bg-[color-mix(in_srgb,var(--learner-accent)_20%,transparent)] text-xs text-[var(--learner-accent)]">
                                    {initials(auth.user?.name ?? '')}
                                </AvatarFallback>
                            </Avatar>
                            <span className="hidden max-w-32 truncate text-sm sm:block">
                                {auth.user?.name}
                            </span>
                            <ChevronDown className="hidden size-3.5 text-[var(--learner-muted-text)] sm:block" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className={cn('w-60', mapThemed && 'backdrop-blur-xl')}
                        style={menuStyle}
                    >
                        {auth.user ? (
                            <UserMenuContent user={auth.user} />
                        ) : null}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
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

export function LearnerBrand() {
    const { props } = usePage();

    return (
        <Link className="flex shrink-0 items-center gap-3" href="/home">
            <PlatformLogo
                className="size-8 object-contain"
                aria-hidden="true"
            />
            <span className="hidden text-sm font-semibold tracking-wide text-[var(--learner-heading-text)] sm:block">
                {props.name}
            </span>
        </Link>
    );
}
