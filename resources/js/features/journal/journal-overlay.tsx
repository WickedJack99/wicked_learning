import { Download, FilePlus2, Pencil, Save, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    createJournalPage,
    filterJournalPayload,
    getCachedJournalPayload,
    loadJournalPayload,
    updateJournalPage,
} from '@/features/journal/journal-client';
import type {
    JournalPage,
    JournalPayload,
} from '@/features/journal/journal-client';
import {
    DEFAULT_JOURNAL_THEME,
    journalThemeCssVariables,
} from '@/features/journal/theme';
import { MarkdownRenderer } from '@/features/platform-info/markdown-renderer';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';

type JournalDraftMap = Record<number, JournalPage>;

type DirtyJournalPageMap = Record<number, boolean>;

type JournalOverlayProps = {
    onClose: () => void;
};

/** A learner-owned markdown journal that is fetched only after the rail opens. */
export function JournalOverlay({ onClose }: JournalOverlayProps) {
    const { resolvedAppearance } = useAppearance();
    const [payload, setPayload] = useState<JournalPayload | null>(() =>
        getCachedJournalPayload(),
    );
    const [draftsById, setDraftsById] = useState<JournalDraftMap>({});
    const [dirtyById, setDirtyById] = useState<DirtyJournalPageMap>({});
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const isLoading = payload === null;

    const visiblePages = useMemo(
        () =>
            payload
                ? filterJournalPayload(
                      {
                          ...payload,
                          pages: payload.pages.map(
                              (page) => draftsById[page.id] ?? page,
                          ),
                      },
                      search,
                  ).pages
                : [],
        [draftsById, payload, search],
    );

    const selected = useMemo(
        () =>
            selectedId
                ? draftsById[selectedId] ??
                  payload?.pages.find((page) => page.id === selectedId) ??
                  null
                : null,
        [draftsById, payload?.pages, selectedId],
    );
    const themeStyle = useMemo(
        () =>
            journalThemeCssVariables(
                payload?.theme ?? DEFAULT_JOURNAL_THEME,
                resolvedAppearance,
            ),
        [payload, resolvedAppearance],
    );

    useEffect(() => {
        if (payload) {
            return;
        }

        let isActive = true;

        void loadJournalPayload()
            .then((next) => {
                if (!isActive) {
                    return;
                }

                setPayload(next);
                setDraftsById((current) =>
                    mergeServerPagesIntoDrafts(current, next.pages),
                );
                setSelectedId((current) => current ?? next.pages[0]?.id ?? null);
            })
            .catch(() => undefined);

        return () => {
            isActive = false;
        };
    }, [payload]);

    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', closeOnEscape);

        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);

    async function createPage() {
        const page = await createJournalPage();

        setPayload((current) =>
            current
                ? { ...current, pages: [page, ...current.pages] }
                : current,
        );
        setDraftsById((current) => ({
            ...current,
            [page.id]: page,
        }));
        setSelectedId(page.id);
    }

    async function savePage(next: JournalPage) {
        if (isSaving) {
            return;
        }

        setIsSaving(true);

        try {
            const page = await updateJournalPage(next);
            setPayload((current) =>
                current
                    ? {
                          ...current,
                          pages: current.pages.map((candidate) =>
                              candidate.id === page.id
                                  ? page
                                  : candidate,
                          ),
                      }
                    : current,
            );
            setDraftsById((current) => ({
                ...current,
                [page.id]: page,
            }));
            setDirtyById((current) => ({
                ...current,
                [page.id]: false,
            }));
        } finally {
            setIsSaving(false);
        }
    }

    function updateDraft(next: JournalPage) {
        setDraftsById((current) => ({
            ...current,
            [next.id]: next,
        }));
        setDirtyById((current) => ({
            ...current,
            [next.id]: true,
        }));
    }

    return createPortal(
        <div
            aria-modal="true"
            className="fixed inset-0 z-[70] grid place-items-center p-3 sm:p-5 md:p-8"
            onMouseDown={onClose}
            role="dialog"
            style={themeStyle}
        >
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-[image:var(--journal-background-image)] bg-cover bg-center backdrop-blur-md"
            />
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{ background: 'var(--journal-background-overlay)' }}
            />
            <section
                aria-label="Journal"
                className="relative flex h-[calc(100svh-1.5rem)] w-full max-w-[92rem] flex-col overflow-hidden rounded-xl border shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:h-[calc(100svh-2.5rem)] md:h-[calc(100svh-4rem)]"
                onMouseDown={(event) => event.stopPropagation()}
                style={{
                    background: 'var(--journal-panel-background)',
                    borderColor: 'var(--journal-panel-border)',
                    color: 'var(--journal-body-text)',
                }}
            >
                <header
                    className="flex shrink-0 items-center gap-4 border-b p-4"
                    style={{
                        background: 'var(--journal-header-background)',
                        borderColor: 'var(--journal-panel-border)',
                    }}
                >
                    <div className="min-w-0 flex-1">
                        <p
                            className="text-xs font-medium tracking-[0.16em] uppercase"
                            style={{ color: 'var(--journal-accent)' }}
                        >
                            Journal
                        </p>
                        <h2
                            className="text-lg font-semibold"
                            style={{ color: 'var(--journal-heading-text)' }}
                        >
                            Reflections and notes
                        </h2>
                    </div>
                    <Button
                        asChild
                        size="sm"
                        style={{
                            background: 'var(--journal-button-background)',
                            borderColor: 'var(--journal-button-border)',
                            color: 'var(--journal-button-text)',
                        }}
                        variant="outline"
                    >
                        <a href="/learning/journal/export">
                            <Download className="size-4" /> Export
                        </a>
                    </Button>
                    <Button
                        aria-label="Close journal"
                        onClick={onClose}
                        size="icon"
                        style={{ color: 'var(--journal-button-text)' }}
                        variant="ghost"
                    >
                        <X className="size-4" />
                    </Button>
                </header>

                <div className="grid min-h-0 flex-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
                    <aside
                        className="flex min-h-0 flex-col border-b p-3 lg:border-r lg:border-b-0"
                        style={{
                            background: 'var(--journal-sidebar-background)',
                            borderColor: 'var(--journal-panel-border)',
                        }}
                    >
                        <div className="flex gap-2">
                            <div className="relative min-w-0 flex-1">
                                <Search
                                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                                    style={{ color: 'var(--journal-muted-text)' }}
                                />
                                <Input
                                    className="pl-9"
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search pages"
                                    style={{
                                        background:
                                            'var(--journal-input-background)',
                                        borderColor:
                                            'var(--journal-button-border)',
                                        color: 'var(--journal-body-text)',
                                    }}
                                    value={search}
                                />
                            </div>
                            <Button
                                aria-label="Add journal page"
                                disabled={!payload}
                                onClick={() => void createPage()}
                                size="icon"
                                style={{
                                    background: 'var(--journal-accent)',
                                    color: 'var(--journal-accent-text)',
                                }}
                                type="button"
                            >
                                <FilePlus2 className="size-4" />
                            </Button>
                        </div>
                        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                            {isLoading ? <JournalPageListSkeleton /> : null}
                            {visiblePages.map((page) => (
                                <button
                                    className={cn(
                                        'w-full rounded-lg border p-3 text-left transition-none',
                                        selectedId === page.id
                                            ? ''
                                            : 'border-transparent hover:bg-slate-100/70 dark:hover:bg-white/6',
                                    )}
                                    key={page.id}
                                    onClick={() => {
                                        setSelectedId(page.id);
                                    }}
                                    style={
                                        selectedId === page.id
                                            ? {
                                                  background:
                                                      'var(--journal-selected-background)',
                                                  borderColor:
                                                      'var(--journal-selected-border)',
                                                  color: 'var(--journal-selected-text)',
                                              }
                                            : {
                                                  color: 'var(--journal-body-text)',
                                              }
                                    }
                                    type="button"
                                >
                                    <p className="truncate text-sm font-semibold">
                                        {page.title}
                                    </p>
                                    <p
                                        className="mt-1 truncate text-xs"
                                        style={{
                                            color:
                                                selectedId === page.id
                                                    ? 'var(--journal-selected-text)'
                                                    : 'var(--journal-muted-text)',
                                        }}
                                    >
                                        {page.topic}
                                        {page.subtopic
                                            ? ` / ${page.subtopic}`
                                            : ''}
                                    </p>
                                    <p
                                        className="mt-2 text-xs"
                                        style={{
                                            color:
                                                selectedId === page.id
                                                    ? 'var(--journal-selected-text)'
                                                    : 'var(--journal-muted-text)',
                                        }}
                                    >
                                        {page.reflectionCount} reflections
                                    </p>
                                </button>
                            ))}
                            {payload && payload.pages.length === 0 ? (
                                <p
                                    className="p-3 text-sm leading-6"
                                    style={{ color: 'var(--journal-muted-text)' }}
                                >
                                    A reflection activity will add its first
                                    page here. You can also make a free-form
                                    page now.
                                </p>
                            ) : null}
                        </div>
                    </aside>

                    <JournalPageEditor
                        allowExpertAccess={
                            payload?.allowExpertAccessRequests ?? false
                        }
                        isSaving={isSaving}
                        isDirty={
                            selected ? (dirtyById[selected.id] ?? false) : false
                        }
                        isLoading={isLoading}
                        onDraftChange={updateDraft}
                        onSave={savePage}
                        page={selected}
                    />
                </div>
            </section>
        </div>,
        document.body,
    );
}

function mergeServerPagesIntoDrafts(
    current: JournalDraftMap,
    pages: JournalPage[],
): JournalDraftMap {
    return pages.reduce<JournalDraftMap>(
        (next, page) => ({
            ...next,
            [page.id]: next[page.id] ?? page,
        }),
        { ...current },
    );
}

function JournalPageEditor({
    allowExpertAccess,
    isDirty,
    isLoading,
    isSaving,
    onDraftChange,
    onSave,
    page,
}: {
    allowExpertAccess: boolean;
    isDirty: boolean;
    isLoading: boolean;
    isSaving: boolean;
    onDraftChange: (next: JournalPage) => void;
    onSave: (next: JournalPage) => Promise<void>;
    page: JournalPage | null;
}) {
    if (isLoading) {
        return <JournalEditorSkeleton />;
    }

    if (!page) {
        return (
            <div
                className="grid min-h-0 place-items-center p-8 text-center text-sm"
                style={{ color: 'var(--journal-muted-text)' }}
            >
                Select a page or create a new one.
            </div>
        );
    }

    const editing = page.preferredMode === 'edit';
    const updateDraft = (next: JournalPage) => {
        onDraftChange(next);
    };
    const switchMode = (mode: 'edit' | 'view') => {
        updateDraft({ ...page, preferredMode: mode });
    };
    const save = async () => {
        await onSave(page);
    };

    return (
        <main
            className="flex min-h-0 flex-col p-4 md:p-6"
            style={{ background: 'var(--journal-content-background)' }}
        >
            <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
                <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-3">
                    <label
                        className="grid gap-1 text-sm font-medium"
                        style={{ color: 'var(--journal-heading-text)' }}
                    >
                        Title
                        <Input
                            disabled={!editing}
                            style={{
                                background: 'var(--journal-input-background)',
                                borderColor: 'var(--journal-button-border)',
                                color: 'var(--journal-body-text)',
                            }}
                            onChange={(event) =>
                                updateDraft({
                                    ...page,
                                    title: event.target.value,
                                })
                            }
                            value={page.title}
                        />
                    </label>
                    <label
                        className="grid gap-1 text-sm font-medium"
                        style={{ color: 'var(--journal-heading-text)' }}
                    >
                        Topic
                        <Input
                            disabled={!editing}
                            style={{
                                background: 'var(--journal-input-background)',
                                borderColor: 'var(--journal-button-border)',
                                color: 'var(--journal-body-text)',
                            }}
                            onChange={(event) =>
                                updateDraft({
                                    ...page,
                                    topic: event.target.value,
                                })
                            }
                            value={page.topic}
                        />
                    </label>
                    <label
                        className="grid gap-1 text-sm font-medium"
                        style={{ color: 'var(--journal-heading-text)' }}
                    >
                        Subtopic
                        <Input
                            disabled={!editing}
                            style={{
                                background: 'var(--journal-input-background)',
                                borderColor: 'var(--journal-button-border)',
                                color: 'var(--journal-body-text)',
                            }}
                            onChange={(event) =>
                                updateDraft({
                                    ...page,
                                    subtopic: event.target.value,
                                })
                            }
                            value={page.subtopic ?? ''}
                        />
                    </label>
                </div>
                <div
                    className="flex rounded-lg border p-1"
                    style={{ borderColor: 'var(--journal-button-border)' }}
                >
                    <Button
                        className="transition-none"
                        onClick={() => switchMode('view')}
                        size="sm"
                        style={{
                            background: !editing
                                ? 'var(--journal-accent)'
                                : 'transparent',
                            color: !editing
                                ? 'var(--journal-accent-text)'
                                : 'var(--journal-button-text)',
                            transition: 'none',
                        }}
                        type="button"
                        variant={!editing ? 'default' : 'ghost'}
                    >
                        View
                    </Button>
                    <Button
                        className="transition-none"
                        onClick={() => switchMode('edit')}
                        size="sm"
                        style={{
                            background: editing
                                ? 'var(--journal-accent)'
                                : 'transparent',
                            color: editing
                                ? 'var(--journal-accent-text)'
                                : 'var(--journal-button-text)',
                            transition: 'none',
                        }}
                        type="button"
                        variant={editing ? 'default' : 'ghost'}
                    >
                        <Pencil className="size-3.5" /> Edit
                    </Button>
                </div>
                <Button
                    disabled={!isDirty || isSaving}
                    onClick={() => void save()}
                    size="sm"
                    style={{
                        background: 'var(--journal-button-background)',
                        borderColor: 'var(--journal-button-border)',
                        color: 'var(--journal-button-text)',
                    }}
                    type="button"
                >
                    <Save className="size-4" /> Save changes
                </Button>
            </div>
            {allowExpertAccess ? (
                <label
                    className="mt-4 flex items-center gap-2 text-sm"
                    style={{ color: 'var(--journal-body-text)' }}
                >
                    <input
                        checked={page.expertAccessRequested}
                        disabled={!editing}
                        onChange={(event) =>
                            updateDraft({
                                ...page,
                                expertAccessRequested: event.target.checked,
                            })
                        }
                        type="checkbox"
                    />{' '}
                    I welcome informational feedback from an expert.
                </label>
            ) : null}
            <div
                className="mt-4 min-h-0 flex-1 overflow-hidden rounded-lg border"
                style={{
                    background: 'var(--journal-input-background)',
                    borderColor: 'var(--journal-button-border)',
                }}
            >
                {editing ? (
                    <textarea
                        className="size-full resize-none overflow-y-auto bg-transparent p-4 font-mono text-sm leading-6 outline-none"
                        onChange={(event) =>
                            updateDraft({
                                ...page,
                                markdown: event.target.value,
                            })
                        }
                        placeholder="Write in Markdown..."
                        style={{ color: 'var(--journal-body-text)' }}
                        value={page.markdown}
                    />
                ) : (
                    <div className="size-full overflow-y-auto p-5">
                        <MarkdownRenderer
                            headingColor="var(--journal-heading-text)"
                            inheritColor
                            markdown={
                                page.markdown || '*This page is still empty.*'
                            }
                            style={{ color: 'var(--journal-body-text)' }}
                        />
                    </div>
                )}
            </div>
        </main>
    );
}

function JournalPageListSkeleton() {
    return (
        <div className="grid gap-2" aria-label="Loading journal pages">
            {Array.from({ length: 4 }).map((_, index) => (
                <div
                    className="rounded-lg border p-3"
                    key={index}
                    style={{
                        background: 'var(--journal-input-background)',
                        borderColor: 'var(--journal-button-border)',
                    }}
                >
                    <SkeletonLine className="h-3.5 w-3/5" />
                    <SkeletonLine className="mt-3 h-2.5 w-4/5" />
                    <SkeletonLine className="mt-2 h-2.5 w-2/5" />
                </div>
            ))}
        </div>
    );
}

function JournalEditorSkeleton() {
    return (
        <main
            className="flex min-h-0 flex-col p-4 md:p-6"
            style={{ background: 'var(--journal-content-background)' }}
            aria-label="Loading selected journal page"
        >
            <div className="grid shrink-0 gap-3 md:grid-cols-[1fr_10rem_9rem]">
                <SkeletonBlock className="h-16" />
                <SkeletonBlock className="h-10" />
                <SkeletonBlock className="h-10" />
            </div>
            <SkeletonBlock className="mt-4 h-9 w-80 max-w-full" />
            <SkeletonBlock className="mt-4 min-h-0 flex-1" />
        </main>
    );
}

function SkeletonBlock({ className }: { className?: string }) {
    return (
        <div
            className={cn('animate-pulse rounded-lg', className)}
            style={{ background: 'var(--journal-input-background)' }}
        />
    );
}

function SkeletonLine({ className }: { className?: string }) {
    return (
        <div
            className={cn('animate-pulse rounded-full', className)}
            style={{ background: 'var(--journal-muted-text)', opacity: 0.28 }}
        />
    );
}
