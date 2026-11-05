import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';

import { apiClient } from './api/client';
import type { components } from './api/schema';
import { OriginalMarkdownRenderer } from './original-markdown';

type JournalDocument = components['schemas']['LearnerJournalDocument'];
type JournalPage = components['schemas']['LearnerJournalPage'];

const journalStyle = {
    '--journal-accent': '#2dd4bf',
    '--journal-accent-text': '#020617',
    '--journal-background-overlay': 'rgba(2, 6, 23, 0.72)',
    '--journal-body-text': 'rgba(226, 232, 240, 0.92)',
    '--journal-button-background': 'rgba(15, 23, 42, 0.86)',
    '--journal-button-border': 'rgba(255, 255, 255, 0.14)',
    '--journal-button-text': '#f8fafc',
    '--journal-content-background': 'rgba(15, 23, 42, 0.4)',
    '--journal-header-background': 'rgba(15, 23, 42, 0.24)',
    '--journal-heading-text': '#f8fafc',
    '--journal-input-background': 'rgba(2, 6, 23, 0.72)',
    '--journal-muted-text': '#94a3b8',
    '--journal-panel-background': 'rgba(11, 17, 23, 0.96)',
    '--journal-panel-border': 'rgba(255, 255, 255, 0.12)',
    '--journal-selected-background': 'rgba(19, 78, 74, 0.36)',
    '--journal-selected-border': '#5eead4',
    '--journal-selected-text': '#f8fafc',
    '--journal-sidebar-background': 'rgba(17, 24, 39, 0.64)',
} as CSSProperties;

/** Source-adapted from the original JournalOverlay. The Rust contract exposes
 * only safe, private reads, so writer/review/export controls are absent. */
export function OriginalJournalOverlay({ onClose }: { onClose: () => void }) {
    const [journal, setJournal] = useState<JournalDocument | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
        'loading',
    );
    const searchRef = useRef<HTMLInputElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        previousFocusRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
        searchRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            previousFocusRef.current?.focus();
        };
    }, [onClose]);

    useEffect(() => {
        let active = true;
        const timeout = window.setTimeout(
            () => {
                void apiClient
                    .GET('/learner/journal', {
                        params: {
                            query: {
                                page,
                                per_page: 4,
                                ...(search.trim()
                                    ? { search: search.trim() }
                                    : {}),
                            },
                        },
                    })
                    .then(({ data, response }) => {
                        if (!active) return;
                        if (!response.ok || !data) {
                            setStatus('unavailable');
                            return;
                        }
                        setJournal(data);
                        setSelectedId((current) =>
                            data.pages.some(
                                (candidate) => candidate.id === current,
                            )
                                ? current
                                : (data.pages[0]?.id ?? null),
                        );
                        setStatus('ready');
                    })
                    .catch(() => active && setStatus('unavailable'));
            },
            search.trim() ? 250 : 0,
        );
        return () => {
            active = false;
            window.clearTimeout(timeout);
        };
    }, [page, search]);

    const selected =
        journal?.pages.find((item) => item.id === selectedId) ?? null;
    return createPortal(
        <div
            aria-modal="true"
            className="fixed inset-0 z-[90] grid place-items-center p-3 sm:p-5 md:p-8"
            onMouseDown={onClose}
            role="dialog"
            style={journalStyle}
        >
            <section
                aria-label="Journal"
                className="relative flex h-[calc(100svh-1.5rem)] w-full max-w-[112rem] flex-col overflow-hidden rounded-xl border bg-[url('/images/themes/journal-paper-leather-background.png')] bg-cover bg-center shadow-2xl sm:h-[calc(100svh-2.5rem)] md:h-[calc(100svh-4rem)]"
                id="learning-journal-panel"
                onMouseDown={(event) => event.stopPropagation()}
                style={{
                    backgroundColor: 'var(--journal-panel-background)',
                    borderColor: 'var(--journal-panel-border)',
                    color: 'var(--journal-body-text)',
                }}
            >
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{ background: 'var(--journal-background-overlay)' }}
                />
                <header
                    className="relative z-10 flex shrink-0 items-center gap-2 border-b p-3 sm:gap-4 sm:p-4"
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
                    <button
                        aria-label="Close journal"
                        className="grid size-9 place-items-center rounded-md hover:bg-white/10"
                        onClick={onClose}
                        style={{ color: 'var(--journal-button-text)' }}
                        type="button"
                    >
                        <X className="size-4" />
                    </button>
                </header>
                <div className="relative z-10 grid min-h-0 flex-1 grid-rows-[minmax(11rem,32svh)_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-none">
                    <aside
                        className="flex min-h-0 flex-col border-b p-3 lg:border-r lg:border-b-0"
                        style={{
                            background: 'var(--journal-sidebar-background)',
                            borderColor: 'var(--journal-panel-border)',
                        }}
                    >
                        <div className="relative">
                            <Search
                                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                                style={{ color: 'var(--journal-muted-text)' }}
                            />
                            <input
                                aria-label="Search journal pages"
                                className="w-full rounded-md border py-2 pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-[var(--journal-accent)]"
                                onChange={(event) => {
                                    setSearch(event.target.value);
                                    setPage(1);
                                    setStatus('loading');
                                }}
                                placeholder="Search pages"
                                ref={searchRef}
                                style={{
                                    background:
                                        'var(--journal-input-background)',
                                    borderColor: 'var(--journal-button-border)',
                                    color: 'var(--journal-body-text)',
                                }}
                                value={search}
                            />
                        </div>
                        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                            {status === 'loading' ? (
                                <p
                                    className="p-3 text-sm"
                                    style={{
                                        color: 'var(--journal-muted-text)',
                                    }}
                                >
                                    Loading private journal…
                                </p>
                            ) : null}
                            {status === 'unavailable' ? (
                                <p
                                    className="p-3 text-sm"
                                    role="alert"
                                    style={{
                                        color: 'var(--journal-muted-text)',
                                    }}
                                >
                                    Your journal is temporarily unavailable.
                                </p>
                            ) : null}
                            {status === 'ready' &&
                                journal?.pages.map((item) => (
                                    <JournalListItem
                                        item={item}
                                        key={item.id}
                                        onSelect={setSelectedId}
                                        selected={item.id === selectedId}
                                    />
                                ))}
                            {status === 'ready' &&
                            journal?.pagination.total === 0 ? (
                                <p
                                    className="p-3 text-sm leading-6"
                                    style={{
                                        color: 'var(--journal-muted-text)',
                                    }}
                                >
                                    {search.trim()
                                        ? `No pages match “${search.trim()}”.`
                                        : 'A reflection activity will add its first page here.'}
                                </p>
                            ) : null}
                        </div>
                        {journal && journal.pagination.last_page > 1 ? (
                            <div
                                className="mt-3 flex items-center justify-between border-t pt-3 text-xs"
                                style={{
                                    borderColor: 'var(--journal-panel-border)',
                                    color: 'var(--journal-muted-text)',
                                }}
                            >
                                <button
                                    disabled={page === 1}
                                    onClick={() =>
                                        setPage((value) => value - 1)
                                    }
                                    type="button"
                                >
                                    Previous
                                </button>
                                <span>
                                    {page} / {journal.pagination.last_page}
                                </span>
                                <button
                                    disabled={
                                        page === journal.pagination.last_page
                                    }
                                    onClick={() =>
                                        setPage((value) => value + 1)
                                    }
                                    type="button"
                                >
                                    Next
                                </button>
                            </div>
                        ) : null}
                    </aside>
                    <JournalPageReadView page={selected} status={status} />
                </div>
            </section>
        </div>,
        document.body,
    );
}

function JournalListItem({
    item,
    onSelect,
    selected,
}: {
    item: JournalPage;
    onSelect: (id: string) => void;
    selected: boolean;
}) {
    return (
        <button
            className="mb-2 w-full rounded-lg border p-3 text-left focus-visible:ring-2 focus-visible:ring-[var(--journal-accent)] focus-visible:outline-none"
            onClick={() => onSelect(item.id)}
            style={
                selected
                    ? {
                          background: 'var(--journal-selected-background)',
                          borderColor: 'var(--journal-selected-border)',
                          color: 'var(--journal-selected-text)',
                      }
                    : {
                          borderColor: 'transparent',
                          color: 'var(--journal-body-text)',
                      }
            }
            type="button"
        >
            <p className="truncate text-sm font-semibold">{item.title}</p>
            <p
                className="mt-1 truncate text-xs"
                style={{
                    color: selected
                        ? 'var(--journal-selected-text)'
                        : 'var(--journal-muted-text)',
                }}
            >
                {item.topic}
                {item.subtopic ? ` / ${item.subtopic}` : ''}
            </p>
            <p
                className="mt-2 text-xs"
                style={{
                    color: selected
                        ? 'var(--journal-selected-text)'
                        : 'var(--journal-muted-text)',
                }}
            >
                {item.reflection_count} reflections
            </p>
        </button>
    );
}

function JournalPageReadView({
    page,
    status,
}: {
    page: JournalPage | null;
    status: 'loading' | 'ready' | 'unavailable';
}) {
    if (status === 'loading')
        return (
            <main
                className="grid place-items-center p-8 text-sm"
                style={{
                    background: 'var(--journal-content-background)',
                    color: 'var(--journal-muted-text)',
                }}
            >
                Loading page…
            </main>
        );
    if (!page)
        return (
            <main
                className="grid place-items-center p-8 text-center text-sm"
                style={{
                    background: 'var(--journal-content-background)',
                    color: 'var(--journal-muted-text)',
                }}
            >
                Select a page when your private journal has entries.
            </main>
        );
    const context = page.learning_context;
    return (
        <main
            className="min-h-0 overflow-y-auto p-4 sm:p-6"
            style={{ background: 'var(--journal-content-background)' }}
        >
            <div
                className="border-b pb-3"
                style={{ borderColor: 'var(--journal-button-border)' }}
            >
                <p
                    className="text-xs font-semibold tracking-[0.12em] uppercase"
                    style={{ color: 'var(--journal-accent)' }}
                >
                    {page.topic}
                    {page.subtopic ? ` / ${page.subtopic}` : ''}
                </p>
                <h3
                    className="mt-1 text-xl font-semibold"
                    style={{ color: 'var(--journal-heading-text)' }}
                >
                    {page.title}
                </h3>
            </div>
            {context ? (
                <section
                    aria-label="Learning context"
                    className="mt-3 rounded-lg border p-3 text-sm"
                    style={{
                        background: 'var(--journal-input-background)',
                        borderColor: 'var(--journal-button-border)',
                    }}
                >
                    <p
                        className="text-xs font-semibold tracking-[0.12em] uppercase"
                        style={{ color: 'var(--journal-accent)' }}
                    >
                        Keep the connection
                    </p>
                    <p className="mt-1 leading-6">
                        This reflection came from{' '}
                        {context.activity_title ?? 'a learning activity'} in{' '}
                        {context.node_title}.
                    </p>
                    <Link
                        className="mt-2 inline-block text-xs font-semibold underline-offset-2 hover:underline"
                        style={{ color: 'var(--journal-accent)' }}
                        to={`/world?map=${encodeURIComponent(context.map_slug)}&focused=${encodeURIComponent(context.node_slug)}`}
                    >
                        Open {context.map_title}
                    </Link>
                </section>
            ) : null}
            <div
                className="mt-4 rounded-lg border p-5"
                style={{
                    background: 'var(--journal-input-background)',
                    borderColor: 'var(--journal-button-border)',
                }}
            >
                <OriginalMarkdownRenderer
                    headingColor="var(--journal-heading-text)"
                    inheritColor
                    markdown={page.markdown || '*This page is still empty.*'}
                    style={{ color: 'var(--journal-body-text)' }}
                />
            </div>
        </main>
    );
}
