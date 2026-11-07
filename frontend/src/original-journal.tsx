import {
    Download,
    FilePlus2,
    MessageSquareText,
    Pencil,
    Save,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { OriginalMarkdownRenderer } from './original-markdown';
import { OriginalPaginatedItems } from './original-paginated-items';
import {
    journalThemeImageUrl,
    journalThemeMode,
    journalThemeStyle,
} from './original-journal-theme';

type JournalDocument = components['schemas']['LearnerJournalDocument'];
type JournalPage = components['schemas']['LearnerJournalPage'];
type JournalCheckIn = components['schemas']['LearnerJournalCheckIn'];
type RevisitInvitation = components['schemas']['LearnerRevisitInvitation'];
type JournalFeedbackDomain = components['schemas']['LearnerJournalFeedbackDomain'];

const journalStyle = {
    '--journal-accent': '#2dd4bf',
    '--journal-accent-text': '#020617',
    '--journal-background-position': '50% 50%',
    '--journal-background-zoom': '1',
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

/** Source-adapted from the original JournalOverlay. Fuller check-in-history
 * affordances remain unavailable until their source-defined contracts exist. */
export function OriginalJournalOverlay({ onClose }: { onClose: () => void }) {
    const navigate = useNavigate();
    const [journal, setJournal] = useState<JournalDocument | null>(null);
    const [draftsById, setDraftsById] = useState<Record<string, JournalPage>>(
        {},
    );
    const [dirtyById, setDirtyById] = useState<Record<string, boolean>>({});
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
        'loading',
    );
    const [isSaving, setIsSaving] = useState(false);
    const [deletingPageId, setDeletingPageId] = useState<string | null>(null);
    const [saveError, setSaveError] = useState('');
    const [updatingRevisitId, setUpdatingRevisitId] = useState<string | null>(
        null,
    );
    const [openingActivitySlug, setOpeningActivitySlug] = useState<string | null>(
        null,
    );
    const [requestingFeedbackForId, setRequestingFeedbackForId] = useState<
        string | null
    >(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const [appearance, setAppearance] = useState<'dark' | 'light'>(() =>
        document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    );

    useEffect(() => {
        const root = document.documentElement;
        const updateAppearance = () =>
            setAppearance(root.classList.contains('dark') ? 'dark' : 'light');
        const observer = new MutationObserver(updateAppearance);

        observer.observe(root, { attributeFilter: ['class'], attributes: true });
        return () => observer.disconnect();
    }, []);
    const activeTheme = useMemo(
        () => (journal ? journalThemeMode(journal.theme, appearance) : null),
        [appearance, journal],
    );
    const overlayStyle = useMemo(
        () =>
            journal
                ? journalThemeStyle(journal.theme, appearance)
                : journalStyle,
        [appearance, journal],
    );

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
                        setDraftsById((current) =>
                            Object.fromEntries(
                                data.pages.map((journalPage) => [
                                    journalPage.id,
                                    current[journalPage.id] ?? journalPage,
                                ]),
                            ),
                        );
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

    const pages = journal?.pages.map(
        (journalPage) => draftsById[journalPage.id] ?? journalPage,
    );
    const selected = pages?.find((item) => item.id === selectedId) ?? null;

    function updateDraft(next: JournalPage) {
        setDraftsById((current) => ({ ...current, [next.id]: next }));
        setDirtyById((current) => ({ ...current, [next.id]: true }));
    }

    async function createPage() {
        setSaveError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST('/learner/journal/pages', {
                body: {
                    markdown: '',
                    preferred_mode: 'edit',
                    subtopic: '',
                    title: 'Untitled page',
                    topic: 'General',
                },
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (!response.ok || !data) throw new Error('create failed');
            setSearch('');
            setPage(1);
            setJournal((current) =>
                current
                    ? {
                          ...current,
                          pages: [data.page, ...current.pages].slice(
                              0,
                              current.pagination.per_page,
                          ),
                          pagination: {
                              ...current.pagination,
                              current_page: 1,
                              last_page: Math.max(
                                  1,
                                  Math.ceil(
                                      (current.pagination.total + 1) /
                                          current.pagination.per_page,
                                  ),
                              ),
                              total: current.pagination.total + 1,
                          },
                      }
                    : current,
            );
            setDraftsById((current) => ({ ...current, [data.page.id]: data.page }));
            setDirtyById((current) => ({ ...current, [data.page.id]: false }));
            setSelectedId(data.page.id);
        } catch {
            setSaveError('Your page could not be created. Please try again.');
        }
    }

    const savePage = useCallback(async (next: JournalPage) => {
        if (isSaving) return;
        setIsSaving(true);
        setSaveError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH(
                '/learner/journal/pages/{page_id}',
                {
                    body: {
                        markdown: next.markdown,
                        preferred_mode: next.preferred_mode,
                        subtopic: next.subtopic ?? '',
                        title: next.title,
                        topic: next.topic,
                    },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { page_id: next.id },
                    },
                },
            );
            if (!response.ok || !data) throw new Error('save failed');
            setJournal((current) =>
                current
                    ? {
                          ...current,
                          pages: current.pages.map((candidate) =>
                              candidate.id === data.page.id
                                  ? data.page
                                  : candidate,
                          ),
                      }
                    : current,
            );
            setDraftsById((current) => ({ ...current, [data.page.id]: data.page }));
            setDirtyById((current) => ({ ...current, [data.page.id]: false }));
        } catch {
            setSaveError(
                'Your changes are still here. Saving will retry when you continue editing.',
            );
        } finally {
            setIsSaving(false);
        }
    }, [isSaving]);

    async function deletePage(journalPage: JournalPage) {
        if (
            deletingPageId !== null ||
            !window.confirm(`Delete \"${journalPage.title}\"? This cannot be undone.`)
        ) {
            return;
        }
        setDeletingPageId(journalPage.id);
        setSaveError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.DELETE(
                '/learner/journal/pages/{page_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { page_id: journalPage.id },
                    },
                },
            );
            if (!response.ok || !data) throw new Error('delete failed');
            setJournal((current) => {
                if (!current) return current;
                const remaining = current.pages.filter(
                    (candidate) => candidate.id !== data.deleted_page_id,
                );
                setSelectedId((currentId) =>
                    currentId === data.deleted_page_id
                        ? (remaining[0]?.id ?? null)
                        : currentId,
                );
                return {
                    ...current,
                    pages: remaining,
                    pagination: {
                        ...current.pagination,
                        total: Math.max(0, current.pagination.total - 1),
                    },
                };
            });
            setDraftsById((current) => {
                const next = { ...current };
                delete next[data.deleted_page_id];
                return next;
            });
            setDirtyById((current) => {
                const next = { ...current };
                delete next[data.deleted_page_id];
                return next;
            });
        } catch {
            setSaveError('Your page could not be deleted. Please try again.');
        } finally {
            setDeletingPageId(null);
        }
    }

    async function requestFeedback(
        journalPage: JournalPage,
        domainKey: string,
    ): Promise<void> {
        if (
            journalPage.feedback_request !== null ||
            requestingFeedbackForId !== null
        ) {
            return;
        }
        setRequestingFeedbackForId(journalPage.id);
        setSaveError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/journal/pages/{page_id}/feedback-request',
                {
                    body: { domain_key: domainKey },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { page_id: journalPage.id },
                    },
                },
            );
            if (!response.ok || !data) throw new Error('request failed');
            setJournal((current) =>
                current
                    ? {
                          ...current,
                          pages: current.pages.map((candidate) =>
                              candidate.id === data.page.id
                                  ? data.page
                                  : candidate,
                          ),
                      }
                    : current,
            );
            setDraftsById((current) => ({
                ...current,
                [data.page.id]: data.page,
            }));
            setDirtyById((current) => ({
                ...current,
                [data.page.id]: false,
            }));
        } catch {
            setSaveError('Your review request could not be sent. Please try again.');
        } finally {
            setRequestingFeedbackForId(null);
        }
    }

    async function updateRevisit(
        checkInId: string,
        action: 'dismiss' | 'snooze',
    ): Promise<void> {
        if (updatingRevisitId !== null) {
            return;
        }

        setUpdatingRevisitId(checkInId);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST(
                '/learner/revisit-invitations/{check_in_id}',
                {
                    body: { action },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { check_in_id: checkInId },
                    },
                },
            );

            if (!response.ok) {
                return;
            }

            setJournal((current) =>
                current
                    ? {
                          ...current,
                          revisit_invitations:
                              current.revisit_invitations.filter(
                                  (invitation) =>
                                      invitation.check_in_id !== checkInId,
                              ),
                      }
                    : current,
            );
        } catch {
            // Keep the invitation visible so the original action can be retried.
        } finally {
            setUpdatingRevisitId(null);
        }
    }

    async function openRevisit(checkInId: string): Promise<void> {
        if (updatingRevisitId !== null) {
            return;
        }

        setUpdatingRevisitId(checkInId);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/revisit-invitations/{check_in_id}/open',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { check_in_id: checkInId },
                    },
                },
            );

            if (!response.ok || !data) {
                return;
            }

            onClose();
            navigate(
                `/learning/nodes/${encodeURIComponent(data.node_slug)}/play?run=${encodeURIComponent(data.play_run_id)}`,
            );
        } catch {
            // The source link remains available if the server rejects a stale invite.
        } finally {
            setUpdatingRevisitId(null);
        }
    }

    async function openHistoricalActivity(activitySlug: string): Promise<void> {
        if (openingActivitySlug !== null) {
            return;
        }

        setOpeningActivitySlug(activitySlug);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/activities/{activity_slug}/replay',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { activity_slug: activitySlug },
                    },
                },
            );

            if (!response.ok || !data) {
                return;
            }

            onClose();
            navigate(
                `/learning/nodes/${encodeURIComponent(data.node_slug)}/play?run=${encodeURIComponent(data.play_run_id)}`,
            );
        } catch {
            // Leave the source-derived trail visible so a transient failure can be retried.
        } finally {
            setOpeningActivitySlug(null);
        }
    }

    useEffect(() => {
        if (!selected || !dirtyById[selected.id] || isSaving) {
            return;
        }
        const timeout = window.setTimeout(() => {
            void savePage(selected);
        }, 900);
        return () => window.clearTimeout(timeout);
    }, [dirtyById, isSaving, savePage, selected]);

    return createPortal(
        <div
            aria-modal="true"
            className="fixed inset-0 z-[90] grid place-items-center p-3 sm:p-5 md:p-8"
            onMouseDown={onClose}
            role="dialog"
            style={overlayStyle}
        >
            <section
                aria-label="Journal"
                className="relative flex h-[calc(100svh-1.5rem)] w-full max-w-[112rem] flex-col overflow-hidden rounded-xl border shadow-2xl sm:h-[calc(100svh-2.5rem)] md:h-[calc(100svh-4rem)]"
                id="learning-journal-panel"
                onMouseDown={(event) => event.stopPropagation()}
                style={{
                    backgroundColor: 'var(--journal-panel-background)',
                    borderColor: 'var(--journal-panel-border)',
                    color: 'var(--journal-body-text)',
                }}
            >
                <JournalBackgroundImage
                    source={
                        activeTheme
                            ? journalThemeImageUrl(activeTheme.background_image)
                            : '/images/themes/journal-paper-leather-background.png'
                    }
                />
                <JournalBackgroundAssets
                    assets={activeTheme?.background_assets ?? []}
                />
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
                    <a
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-white/10"
                        href="/api/v1/learner/journal/export"
                        style={{
                            background: 'var(--journal-button-background)',
                            borderColor: 'var(--journal-button-border)',
                            color: 'var(--journal-button-text)',
                        }}
                    >
                        <Download className="size-4" />
                        <span className="hidden sm:inline">Export</span>
                    </a>
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
                        className="flex min-h-0 flex-col overflow-y-auto border-b p-3 lg:overflow-visible lg:border-r lg:border-b-0"
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
                            <button
                                aria-label="Add journal page"
                                className="grid size-10 shrink-0 place-items-center rounded-md"
                                disabled={!journal || status !== 'ready'}
                                onClick={() => void createPage()}
                                style={{
                                    background: 'var(--journal-accent)',
                                    color: 'var(--journal-accent-text)',
                                }}
                                type="button"
                            >
                                <FilePlus2 className="size-4" />
                            </button>
                        </div>
                        {journal?.check_ins.length ? (
                            <LearningTrail
                                checkIns={journal.check_ins}
                                onOpen={openHistoricalActivity}
                                openingActivitySlug={openingActivitySlug}
                                onSeeMap={() => {
                                    onClose();
                                    navigate('/competence');
                                }}
                            />
                        ) : null}
                        {journal?.revisit_invitations.length ? (
                            <RevisitInvitations
                                invitations={journal.revisit_invitations}
                                onOpen={openRevisit}
                                onUpdate={updateRevisit}
                                updatingRevisitId={updatingRevisitId}
                            />
                        ) : null}
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
                                pages?.map((item) => (
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
                                        : 'A reflection activity will add its first page here. You can also make a free-form page now.'}
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
                    <JournalPageEditor
                        allowExpertAccess={journal?.allow_expert_access_requests ?? false}
                        deletingPageId={deletingPageId}
                        feedbackDomains={journal?.feedback_domains ?? []}
                        isDirty={selected ? (dirtyById[selected.id] ?? false) : false}
                        isRequestingFeedback={requestingFeedbackForId === selected?.id}
                        isSaving={isSaving}
                        onDelete={deletePage}
                        onDraftChange={updateDraft}
                        onRequestFeedback={requestFeedback}
                        onSave={savePage}
                        page={selected}
                        saveError={saveError}
                        status={status}
                    />
                </div>
            </section>
        </div>,
        document.body,
    );
}

function LearningTrail({
    checkIns,
    onOpen,
    onSeeMap,
    openingActivitySlug,
}: {
    checkIns: JournalCheckIn[];
    onOpen: (activitySlug: string) => Promise<void>;
    onSeeMap: () => void;
    openingActivitySlug: string | null;
}) {
    return (
        <section
            aria-label="Recent learning check-ins"
            className="mt-3 rounded-lg border p-3"
            data-wl-id="learner.journal.learning-trail"
            style={{
                background: 'var(--journal-content-background)',
                borderColor: 'var(--journal-button-border)',
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p
                        className="text-xs font-semibold tracking-[0.12em] uppercase"
                        style={{ color: 'var(--journal-accent)' }}
                    >
                        Learning trail
                    </p>
                    <p
                        className="mt-1 text-xs leading-5"
                        style={{ color: 'var(--journal-muted-text)' }}
                    >
                        Your recent check-ins, kept as observations.
                    </p>
                </div>
                <button
                    className="shrink-0 text-xs font-semibold underline-offset-2 hover:underline"
                    onClick={onSeeMap}
                    style={{ color: 'var(--journal-accent)' }}
                    type="button"
                >
                    See map
                </button>
            </div>
            <div className="mt-2 space-y-1">
                {checkIns.slice(0, 4).map((checkIn) => (
                    <button
                        className="block w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-[var(--journal-content-background)] disabled:opacity-60"
                        disabled={openingActivitySlug !== null}
                        key={checkIn.id}
                        onClick={() => void onOpen(checkIn.activity_slug)}
                        type="button"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-semibold">
                                {checkInFeelingLabel(checkIn.feeling)}
                            </span>
                            <time
                                className="shrink-0 text-xs"
                                dateTime={checkIn.recorded_at}
                                style={{ color: 'var(--journal-muted-text)' }}
                            >
                                {formatCheckInDate(checkIn.recorded_at)}
                            </time>
                        </div>
                        <p
                            className="mt-1 truncate text-xs"
                            style={{ color: 'var(--journal-muted-text)' }}
                        >
                            {checkIn.activity_title} · {checkIn.node_title}
                        </p>
                        {checkIn.note ? (
                            <p className="mt-2 text-xs leading-5">
                                {checkIn.note}
                            </p>
                        ) : null}
                        {checkIn.next_direction ? (
                            <p
                                className="mt-2 text-xs"
                                style={{ color: 'var(--journal-accent)' }}
                            >
                                Next direction:{' '}
                                {checkInDirectionLabel(checkIn.next_direction)}
                            </p>
                        ) : null}
                    </button>
                ))}
            </div>
        </section>
    );
}

function RevisitInvitations({
    invitations,
    onOpen,
    onUpdate,
    updatingRevisitId,
}: {
    invitations: RevisitInvitation[];
    onOpen: (checkInId: string) => Promise<void>;
    onUpdate: (
        checkInId: string,
        action: 'dismiss' | 'snooze',
    ) => Promise<void>;
    updatingRevisitId: string | null;
}) {
    return (
        <section
            aria-label="Revisit invitations"
            className="mt-3 rounded-lg border p-3"
            style={{
                background: 'var(--journal-content-background)',
                borderColor: 'var(--journal-button-border)',
            }}
        >
            <p
                className="text-xs font-semibold tracking-[0.12em] uppercase"
                style={{ color: 'var(--journal-accent)' }}
            >
                Revisit when ready
            </p>
            <p
                className="mt-1 text-xs leading-5"
                style={{ color: 'var(--journal-muted-text)' }}
            >
                A few places you chose to return to after some time away.
            </p>
            <OriginalPaginatedItems
                className="mt-2 grid gap-2"
                items={invitations}
                pageSize={1}
                paginationButtonClassName="inline-flex items-center gap-1 text-sm text-[var(--journal-accent)] transition hover:text-[var(--journal-heading-text)] disabled:pointer-events-none disabled:opacity-40"
                paginationClassName="mt-3 flex items-center justify-between border-t border-[var(--journal-button-border)] pt-3"
                paginationLabel="Revisit invitations"
                paginationTextClassName="text-xs text-[var(--journal-muted-text)]"
                renderItem={(invitation) => (
                    <article
                        className="rounded-md border px-2 py-2"
                        key={invitation.check_in_id}
                        style={{ borderColor: 'var(--journal-button-border)' }}
                    >
                        <button
                            className="block text-left"
                            disabled={updatingRevisitId !== null}
                            onClick={() => void onOpen(invitation.check_in_id)}
                            type="button"
                        >
                            <p className="text-xs font-semibold">
                                {invitation.activity_title}
                            </p>
                            <p
                                className="mt-1 text-xs"
                                style={{ color: 'var(--journal-muted-text)' }}
                            >
                                {invitation.node_title} · {invitation.map_title}
                            </p>
                            <p
                                className="mt-1 text-xs"
                                style={{ color: 'var(--journal-muted-text)' }}
                            >
                                You chose to return on{' '}
                                {formatCheckInDate(invitation.available_since)}
                            </p>
                            <p
                                className="mt-1 text-xs"
                                style={{ color: 'var(--journal-muted-text)' }}
                            >
                                Ready since {formatCheckInDate(invitation.available_at)}
                            </p>
                            <p
                                className="mt-1 text-xs"
                                style={{ color: 'var(--journal-muted-text)' }}
                            >
                                {invitation.revisit_reason === 'later'
                                    ? 'You chose to wait longer before returning.'
                                    : `Ready after ${invitation.available_after_days} days away.`}
                            </p>
                        </button>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <button
                                className="text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-50"
                                disabled={updatingRevisitId !== null}
                                onClick={() => void onOpen(invitation.check_in_id)}
                                style={{ color: 'var(--journal-accent)' }}
                                type="button"
                            >
                                Open activity
                            </button>
                            <button
                                className="text-xs underline-offset-2 hover:underline disabled:opacity-50"
                                disabled={updatingRevisitId !== null}
                                onClick={() =>
                                    void onUpdate(invitation.check_in_id, 'snooze')
                                }
                                type="button"
                            >
                                Later
                            </button>
                            <button
                                className="text-xs underline-offset-2 hover:underline disabled:opacity-50"
                                disabled={updatingRevisitId !== null}
                                onClick={() =>
                                    void onUpdate(invitation.check_in_id, 'dismiss')
                                }
                                type="button"
                            >
                                Hide
                            </button>
                        </div>
                    </article>
                )}
            />
        </section>
    );
}

function formatCheckInDate(value: string): string {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
          });
}

function checkInFeelingLabel(value: string | null): string {
    return (
        {
            clearer: 'Felt clearer',
            forming: 'Still forming',
            stretched: 'Felt stretched',
            stuck: 'Felt stuck',
        }[value ?? ''] ?? 'A reflection'
    );
}

function checkInDirectionLabel(value: string): string {
    return (
        {
            revisit: 'Return to this place',
            related: 'Look for something related',
            settle: 'Let it settle',
        }[value] ?? value
    );
}

function JournalBackgroundImage({ source }: { source?: string }) {
    if (!source) return null;

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        >
            <img
                alt=""
                className="size-full max-w-none object-cover"
                draggable={false}
                src={source}
                style={{
                    objectPosition: 'var(--journal-background-position)',
                    transform: 'scale(var(--journal-background-zoom))',
                    transformOrigin: 'var(--journal-background-position)',
                }}
            />
        </div>
    );
}

function JournalBackgroundAssets({
    assets,
}: {
    assets: components['schemas']['LearnerJournalBackgroundAsset'][];
}) {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        >
            {assets.map((asset) => {
                const source = journalThemeImageUrl(asset.image);

                return source ? (
                    <img
                        alt=""
                        className="absolute max-w-none"
                        draggable={false}
                        key={asset.id}
                        src={source}
                        style={{
                            left: `${asset.position_x}%`,
                            top: `${asset.position_y}%`,
                            transform: 'translate(-50%, -50%)',
                            width: `${asset.zoom}%`,
                        }}
                    />
                ) : null;
            })}
        </div>
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

function JournalPageEditor({
    allowExpertAccess,
    deletingPageId,
    feedbackDomains,
    isDirty,
    isRequestingFeedback,
    isSaving,
    onDelete,
    onDraftChange,
    onRequestFeedback,
    onSave,
    page,
    saveError,
    status,
}: {
    allowExpertAccess: boolean;
    deletingPageId: string | null;
    feedbackDomains: JournalFeedbackDomain[];
    isDirty: boolean;
    isRequestingFeedback: boolean;
    isSaving: boolean;
    onDelete: (page: JournalPage) => Promise<void>;
    onDraftChange: (page: JournalPage) => void;
    onRequestFeedback: (page: JournalPage, domainKey: string) => Promise<void>;
    onSave: (page: JournalPage) => Promise<void>;
    page: JournalPage | null;
    saveError: string;
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
                Select a page or create a new one.
            </main>
        );
    const editing = page.preferred_mode === 'edit';
    const context = page.learning_context;
    return (
        <main
            className="flex min-h-0 flex-col p-3 sm:p-4 md:p-6"
            style={{ background: 'var(--journal-content-background)' }}
        >
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                <div className="grid w-full gap-3 sm:min-w-0 sm:flex-1 sm:grid-cols-3">
                    <JournalField
                        disabled={!editing}
                        label="Title"
                        onChange={(title) => onDraftChange({ ...page, title })}
                        value={page.title}
                    />
                    <JournalField
                        disabled={!editing}
                        label="Topic"
                        onChange={(topic) => onDraftChange({ ...page, topic })}
                        value={page.topic}
                    />
                    <JournalField
                        disabled={!editing}
                        label="Subtopic"
                        onChange={(subtopic) =>
                            onDraftChange({ ...page, subtopic })
                        }
                        value={page.subtopic ?? ''}
                    />
                </div>
                <div
                    className="flex rounded-lg border p-1"
                    style={{ borderColor: 'var(--journal-button-border)' }}
                >
                    <button
                        className="rounded-md px-3 py-1.5 text-sm"
                        onClick={() =>
                            onDraftChange({ ...page, preferred_mode: 'view' })
                        }
                        style={{
                            background: !editing
                                ? 'var(--journal-accent)'
                                : 'transparent',
                            color: !editing
                                ? 'var(--journal-accent-text)'
                                : 'var(--journal-button-text)',
                        }}
                        type="button"
                    >
                        View
                    </button>
                    <button
                        className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm"
                        onClick={() =>
                            onDraftChange({ ...page, preferred_mode: 'edit' })
                        }
                        style={{
                            background: editing
                                ? 'var(--journal-accent)'
                                : 'transparent',
                            color: editing
                                ? 'var(--journal-accent-text)'
                                : 'var(--journal-button-text)',
                        }}
                        type="button"
                    >
                        <Pencil className="size-3.5" /> Edit
                    </button>
                </div>
                <button
                    className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                    disabled={!isDirty || isSaving}
                    onClick={() => void onSave(page)}
                    style={{
                        background: 'var(--journal-button-background)',
                        borderColor: 'var(--journal-button-border)',
                        color: 'var(--journal-button-text)',
                    }}
                    type="button"
                >
                    <Save className="size-4" /> Save changes
                </button>
                <button
                    aria-label="Delete journal page"
                    className="grid size-9 place-items-center rounded-md border disabled:opacity-50"
                    disabled={deletingPageId === page.id || isSaving}
                    onClick={() => void onDelete(page)}
                    style={{
                        borderColor: 'var(--journal-button-border)',
                        color: 'var(--journal-button-text)',
                    }}
                    title="Delete page"
                    type="button"
                >
                    <Trash2 className="size-4" />
                </button>
            </div>
            <div
                aria-live="polite"
                className="mt-2 min-h-5 text-xs"
                style={{
                    color: saveError ? '#dc2626' : 'var(--journal-muted-text)',
                }}
            >
                {saveError
                    ? saveError
                    : isSaving
                      ? 'Saving your draft…'
                      : isDirty
                        ? 'Saving your draft…'
                        : 'All changes saved.'}
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
                            onDraftChange({ ...page, markdown: event.target.value })
                        }
                        placeholder="Write in Markdown..."
                        style={{ color: 'var(--journal-body-text)' }}
                        value={page.markdown}
                    />
                ) : (
                    <div className="size-full overflow-y-auto p-5">
                        <OriginalMarkdownRenderer
                            headingColor="var(--journal-heading-text)"
                            inheritColor
                            markdown={page.markdown || '*This page is still empty.*'}
                            style={{ color: 'var(--journal-body-text)' }}
                        />
                    </div>
                )}
            </div>
            <JournalFeedbackPanel
                allowExpertAccess={allowExpertAccess}
                domains={feedbackDomains}
                isDirty={isDirty}
                isRequestingFeedback={isRequestingFeedback}
                onRequestFeedback={onRequestFeedback}
                page={page}
            />
        </main>
    );
}

/** Source-adapted from JournalFeedbackPanel. The policy and destination list
 * are server-owned, so this control never grants access by itself. */
function JournalFeedbackPanel({
    allowExpertAccess,
    domains,
    isDirty,
    isRequestingFeedback,
    onRequestFeedback,
    page,
}: {
    allowExpertAccess: boolean;
    domains: JournalFeedbackDomain[];
    isDirty: boolean;
    isRequestingFeedback: boolean;
    onRequestFeedback: (page: JournalPage, domainKey: string) => Promise<void>;
    page: JournalPage;
}) {
    const [selectedDomainKey, setSelectedDomainKey] = useState(
        domains[0]?.key ?? 'journal',
    );
    const selectedDomainExists = domains.some(
        (domain) => domain.key === selectedDomainKey,
    );
    const domainKey = selectedDomainExists
        ? selectedDomainKey
        : (domains[0]?.key ?? 'journal');
    const requestDisabled =
        !allowExpertAccess ||
        isDirty ||
        page.feedback_request !== null ||
        isRequestingFeedback ||
        domains.length === 0;

    return (
        <div
            className="mt-4 rounded-lg border p-3 text-sm"
            style={{
                background: 'var(--journal-input-background)',
                borderColor: 'var(--journal-button-border)',
                color: 'var(--journal-body-text)',
            }}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p
                        className="font-semibold"
                        style={{ color: 'var(--journal-heading-text)' }}
                    >
                        {feedbackPanelTitle({ allowExpertAccess, isDirty, page })}
                    </p>
                    {page.feedback_request ? (
                        <p
                            className="mt-1 text-xs"
                            style={{ color: 'var(--journal-muted-text)' }}
                        >
                            {page.feedback_request.domain.label}
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {!page.feedback_request ? (
                        <select
                            aria-label="Feedback destination"
                            className="h-9 rounded-md border bg-transparent px-3 text-sm outline-none"
                            disabled={
                                !allowExpertAccess ||
                                isDirty ||
                                isRequestingFeedback
                            }
                            onChange={(event) =>
                                setSelectedDomainKey(event.target.value)
                            }
                            style={{
                                borderColor: 'var(--journal-button-border)',
                                color: 'var(--journal-button-text)',
                            }}
                            value={domainKey}
                        >
                            {domains.map((domain) => (
                                <option key={domain.key} value={domain.key}>
                                    {domain.label}
                                </option>
                            ))}
                        </select>
                    ) : null}
                    <button
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                        disabled={requestDisabled}
                        onClick={() => void onRequestFeedback(page, domainKey)}
                        style={{
                            background: 'var(--journal-button-background)',
                            borderColor: 'var(--journal-button-border)',
                            color: 'var(--journal-button-text)',
                        }}
                        type="button"
                    >
                        <MessageSquareText className="size-4" />
                        {feedbackButtonLabel({ isRequestingFeedback, page })}
                    </button>
                </div>
            </div>
            <FeedbackPanelBody
                allowExpertAccess={allowExpertAccess}
                isDirty={isDirty}
                page={page}
            />
        </div>
    );
}

function FeedbackPanelBody({
    allowExpertAccess,
    isDirty,
    page,
}: {
    allowExpertAccess: boolean;
    isDirty: boolean;
    page: JournalPage;
}) {
    if (page.feedback_request?.feedback) {
        return (
            <p className="mt-3 leading-6 whitespace-pre-wrap">
                {page.feedback_request.feedback}
            </p>
        );
    }
    if (page.feedback_request) {
        return (
            <p className="mt-2" style={{ color: 'var(--journal-muted-text)' }}>
                Review request sent. This page is waiting for feedback.
            </p>
        );
    }
    if (!allowExpertAccess) {
        return (
            <p className="mt-2" style={{ color: 'var(--journal-muted-text)' }}>
                Review requests are turned off in journal settings.
            </p>
        );
    }
    if (isDirty) {
        return (
            <p className="mt-2" style={{ color: 'var(--journal-muted-text)' }}>
                Save your changes before requesting review so the reviewer sees the latest page.
            </p>
        );
    }
    return null;
}

function feedbackPanelTitle({
    allowExpertAccess,
    isDirty,
    page,
}: {
    allowExpertAccess: boolean;
    isDirty: boolean;
    page: JournalPage;
}): string {
    if (page.feedback_request?.feedback) return 'Page review';
    if (page.feedback_request) return 'Review requested';
    if (!allowExpertAccess) return 'Page review unavailable';
    if (isDirty) return 'Save before review';
    return 'You can request feedback for this page once.';
}

function feedbackButtonLabel({
    isRequestingFeedback,
    page,
}: {
    isRequestingFeedback: boolean;
    page: JournalPage;
}): string {
    if (isRequestingFeedback) return 'Requesting...';
    if (page.feedback_request?.responded_at) return 'Review received';
    if (page.feedback_request) return 'Review requested';
    return 'Request review';
}

function JournalField({
    disabled,
    label,
    onChange,
    value,
}: {
    disabled: boolean;
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    return (
        <label
            className="grid gap-1 text-sm font-medium"
            style={{ color: 'var(--journal-heading-text)' }}
        >
            {label}
            <input
                className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--journal-accent)]"
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                style={{
                    background: 'var(--journal-input-background)',
                    borderColor: 'var(--journal-button-border)',
                    color: 'var(--journal-body-text)',
                }}
                value={value}
            />
        </label>
    );
}
