import { ArrowRight, Bookmark, Clock3, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { OriginalPaginatedItems } from './original-paginated-items';
import { OriginalLearnerHeader } from './original-learner-header';

type LearnerRecallItem = components['schemas']['LearnerRecallItem'];
type LearnerRecallQueue = components['schemas']['LearnerRecallQueue'];
type RevisitInvitation = components['schemas']['LearnerRevisitInvitation'];

const learnerStyle = {
    '--learner-action-accent': '#5eead4',
    '--learner-accent': '#5eead4',
    '--learner-border-color': 'rgba(255, 255, 255, 0.1)',
    '--learner-heading-text': '#f8fafc',
    '--learner-body-text': '#e2e8f0',
    '--learner-muted-text': '#cbd5e1',
    '--learner-page-background': '#0b1117',
    '--learner-panel-background': '#111820',
} as CSSProperties;

/**
 * The Recall Queue and Return when useful sections lifted from
 * `features/home/learning-desk.tsx`. This remains a deliberately narrow desk
 * surface until the other source sections have their own completed Rust
 * contracts; it does not add replacement cards or navigation for unavailable
 * work.
 */
export function OriginalRecallDeskPage({
    onSignedOut,
    userEmail,
}: {
    onSignedOut: () => void;
    userEmail: string;
}) {
    const navigate = useNavigate();
    const [queue, setQueue] = useState<LearnerRecallQueue | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
        'loading',
    );
    const [removingItemId, setRemovingItemId] = useState<string | null>(null);
    const [postponingItemId, setPostponingItemId] = useState<string | null>(
        null,
    );
    const [openingItemId, setOpeningItemId] = useState<string | null>(null);
    const [revisitInvitations, setRevisitInvitations] = useState<
        RevisitInvitation[]
    >([]);
    const [updatingRevisitId, setUpdatingRevisitId] = useState<string | null>(
        null,
    );
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        void apiClient
            .GET('/learner/recall-items')
            .then(({ data, response }) => {
                if (!active) return;
                if (!response.ok || !data) {
                    setStatus('unavailable');
                    return;
                }
                setQueue(data);
                setStatus('ready');
            })
            .catch(() => active && setStatus('unavailable'));
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let active = true;
        void apiClient
            .GET('/learner/journal', {
                params: { query: { page: 1, per_page: 1 } },
            })
            .then(({ data, response }) => {
                if (active && response.ok && data) {
                    setRevisitInvitations(data.revisit_invitations);
                }
            })
            .catch(() => {
                // The recall queue stays usable if this independent desk slice
                // is temporarily unavailable.
            });
        return () => {
            active = false;
        };
    }, []);

    async function remove(item: LearnerRecallItem): Promise<void> {
        if (removingItemId || postponingItemId || openingItemId) return;
        setRemovingItemId(item.recall_item_id);
        setError('');
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/learner/recall-items/{recall_item_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { recall_item_id: item.recall_item_id },
                    },
                },
            );
            if (!response.ok) throw new Error('remove failed');
            setQueue((current) =>
                current
                    ? {
                          ...current,
                          items: current.items.filter(
                              (candidate) =>
                                  candidate.recall_item_id !==
                                  item.recall_item_id,
                          ),
                      }
                    : current,
            );
        } catch {
            setError('That recall choice could not be updated. Try again.');
        } finally {
            setRemovingItemId(null);
        }
    }

    async function postpone(item: LearnerRecallItem): Promise<void> {
        if (removingItemId || postponingItemId || openingItemId) return;
        setPostponingItemId(item.recall_item_id);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/recall-items/{recall_item_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { recall_item_id: item.recall_item_id },
                    },
                },
            );
            if (!response.ok || !data) throw new Error('postpone failed');
            setQueue((current) =>
                current
                    ? {
                          ...current,
                          items: current.items.map((candidate) =>
                              candidate.recall_item_id === data.recall_item_id
                                  ? data
                                  : candidate,
                          ),
                      }
                    : current,
            );
        } catch {
            setError('That recall choice could not be updated. Try again.');
        } finally {
            setPostponingItemId(null);
        }
    }

    async function open(item: LearnerRecallItem): Promise<void> {
        if (removingItemId || postponingItemId || openingItemId) return;
        setOpeningItemId(item.recall_item_id);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/recall-items/{recall_item_id}/open',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { recall_item_id: item.recall_item_id },
                    },
                },
            );
            if (!response.ok || !data) throw new Error('open failed');
            navigate(
                `/learning/nodes/${encodeURIComponent(data.node_slug)}/play?run=${encodeURIComponent(data.play_run_id)}`,
            );
        } catch {
            setError('That recall question could not be opened. Try again.');
            setOpeningItemId(null);
        }
    }

    async function updateRevisit(
        invitation: RevisitInvitation,
        action: 'dismiss' | 'snooze',
    ): Promise<void> {
        if (
            removingItemId ||
            postponingItemId ||
            openingItemId ||
            updatingRevisitId !== null
        ) {
            return;
        }

        setUpdatingRevisitId(invitation.check_in_id);
        setError('');
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST(
                '/learner/revisit-invitations/{check_in_id}',
                {
                    body: { action },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { check_in_id: invitation.check_in_id },
                    },
                },
            );
            if (!response.ok) throw new Error('update failed');
            setRevisitInvitations((current) =>
                current.filter(
                    (candidate) =>
                        candidate.check_in_id !== invitation.check_in_id,
                ),
            );
        } catch {
            setError('That return choice could not be updated. Try again.');
        } finally {
            setUpdatingRevisitId(null);
        }
    }

    async function openRevisit(invitation: RevisitInvitation): Promise<void> {
        if (
            removingItemId ||
            postponingItemId ||
            openingItemId ||
            updatingRevisitId !== null
        ) {
            return;
        }

        setUpdatingRevisitId(invitation.check_in_id);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/revisit-invitations/{check_in_id}/open',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { check_in_id: invitation.check_in_id },
                    },
                },
            );
            if (!response.ok || !data) throw new Error('open failed');
            navigate(
                `/learning/nodes/${encodeURIComponent(data.node_slug)}/play?run=${encodeURIComponent(data.play_run_id)}`,
            );
        } catch {
            setError('That return activity could not be opened. Try again.');
            setUpdatingRevisitId(null);
        }
    }

    return (
        <div style={learnerStyle}>
            <OriginalLearnerHeader
                onSignedOut={onSignedOut}
                userEmail={userEmail}
            />
            <main
                className="min-h-svh bg-[var(--learner-page-background)] px-5 py-10 text-[var(--learner-heading-text)] sm:px-8 lg:px-12 lg:py-14 xl:px-[clamp(3rem,7vw,8rem)]"
                id="learner-main-content"
                tabIndex={-1}
            >
            <div className="mx-auto max-w-4xl">
                <header>
                    <p className="text-sm font-medium tracking-[0.16em] text-[var(--learner-accent)] uppercase">
                        Your learning desk
                    </p>
                    <h1 className="mt-3 text-3xl font-medium tracking-tight">
                        Recall queue
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                        Questions you chose to keep nearby for another look.
                        There is no deadline; remove one whenever it no longer
                        helps.
                    </p>
                </header>

                {status === 'ready' && queue?.items.length ? (
                    <section aria-labelledby="recall-heading" className="mt-8">
                        <h2 className="sr-only" id="recall-heading">
                            Recall queue
                        </h2>
                        <OriginalPaginatedItems
                            className="divide-y divide-[var(--learner-border-color)] border-b border-[var(--learner-border-color)]"
                            items={queue.items}
                            pageSize={2}
                            paginationLabel="Recall questions"
                            renderItem={(item) => (
                                <RecallItemRow
                                    item={item}
                                    key={item.recall_item_id}
                                    onOpen={open}
                                    onPostpone={postpone}
                                    onRemove={remove}
                                    opening={openingItemId === item.recall_item_id}
                                    postponing={postponingItemId === item.recall_item_id}
                                    removing={removingItemId === item.recall_item_id}
                                />
                            )}
                        />
                        {error ? (
                            <p aria-live="polite" className="mt-3 text-sm text-red-300" role="status">
                                {error}
                            </p>
                        ) : null}
                    </section>
                ) : null}
                {revisitInvitations.length ? (
                    <section
                        aria-labelledby="revisit-heading"
                        className="mt-8"
                        id="revisit-section"
                    >
                        <h2
                            className="text-xl font-medium tracking-tight"
                            id="revisit-heading"
                        >
                            Return when useful
                        </h2>
                        <p className="max-w-2xl border-b border-[var(--learner-border-color)] py-5 text-sm leading-6 text-[var(--learner-muted-text)]">
                            These are places you chose to return to after some
                            time away.
                        </p>
                        <OriginalPaginatedItems
                            className="divide-y divide-[var(--learner-border-color)] border-b border-[var(--learner-border-color)]"
                            items={revisitInvitations}
                            pageSize={2}
                            paginationLabel="Revisit invitations"
                            renderItem={(invitation) => (
                                <RevisitInvitationRow
                                    invitation={invitation}
                                    key={invitation.check_in_id}
                                    onOpen={openRevisit}
                                    onUpdate={updateRevisit}
                                    updating={
                                        updatingRevisitId ===
                                        invitation.check_in_id
                                    }
                                />
                            )}
                        />
                    </section>
                ) : null}
                {error ? (
                    <p
                        aria-live="polite"
                        className="mt-3 text-sm text-red-300"
                        role="status"
                    >
                        {error}
                    </p>
                ) : null}
            </div>
            </main>
        </div>
    );
}

function RevisitInvitationRow({
    invitation,
    onOpen,
    onUpdate,
    updating,
}: {
    invitation: RevisitInvitation;
    onOpen: (invitation: RevisitInvitation) => Promise<void>;
    onUpdate: (
        invitation: RevisitInvitation,
        action: 'dismiss' | 'snooze',
    ) => Promise<void>;
    updating: boolean;
}) {
    return (
        <div className="group grid gap-4 py-5 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
            <Clock3
                aria-hidden="true"
                className="size-5 text-[var(--learner-action-accent)]"
            />
            <span className="min-w-0">
                <button
                    className="block truncate text-left text-sm font-medium hover:text-[var(--learner-accent)] disabled:opacity-50"
                    disabled={updating}
                    onClick={() => void onOpen(invitation)}
                    type="button"
                >
                    {invitation.activity_title}
                </button>
                <span className="mt-1 block truncate text-sm text-[var(--learner-muted-text)]">
                    {invitation.node_title} · {invitation.map_title}
                </span>
                <span className="mt-2 block text-xs text-[var(--learner-muted-text)]">
                    You chose to return on{' '}
                    {formatRevisitDate(invitation.available_since)}
                </span>
                <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                    Ready since {formatRevisitDate(invitation.available_at)}
                </span>
                <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                    {invitation.revisit_reason === 'later'
                        ? 'You chose to wait longer before returning.'
                        : `Ready after ${invitation.available_after_days} days away.`}
                </span>
            </span>
            <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button
                    className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-medium text-[var(--learner-accent)] disabled:pointer-events-none disabled:opacity-50"
                    disabled={updating}
                    onClick={() => void onOpen(invitation)}
                    type="button"
                >
                    Open activity
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </button>
                <button
                    className="inline-flex min-h-11 items-center px-2 text-sm text-[var(--learner-action-accent)] underline-offset-2 transition hover:text-[var(--learner-heading-text)] hover:underline disabled:pointer-events-none disabled:opacity-50"
                    disabled={updating}
                    onClick={() => void onUpdate(invitation, 'snooze')}
                    type="button"
                >
                    Later
                </button>
                <button
                    className="inline-flex min-h-11 items-center px-2 text-sm text-[var(--learner-muted-text)] underline-offset-2 transition hover:text-[var(--learner-heading-text)] hover:underline disabled:pointer-events-none disabled:opacity-50"
                    disabled={updating}
                    onClick={() => void onUpdate(invitation, 'dismiss')}
                    type="button"
                >
                    Hide
                </button>
            </span>
        </div>
    );
}

function RecallItemRow({
    item,
    onOpen,
    onPostpone,
    onRemove,
    opening,
    postponing,
    removing,
}: {
    item: LearnerRecallItem;
    onOpen: (item: LearnerRecallItem) => Promise<void>;
    onPostpone: (item: LearnerRecallItem) => Promise<void>;
    onRemove: (item: LearnerRecallItem) => Promise<void>;
    opening: boolean;
    postponing: boolean;
    removing: boolean;
}) {
    const confidenceLabel = item.last_confidence
        ? confidenceName(item.last_confidence)
        : null;
    const confidenceAfterFeedbackLabel = item.last_confidence_after_feedback
        ? confidenceName(item.last_confidence_after_feedback)
        : null;
    const busy = opening || postponing || removing;

    return (
        <div className="group grid gap-4 py-5 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
            <Bookmark aria-hidden="true" className="size-5 text-[var(--learner-action-accent)]" />
            <span className="min-w-0">
                <button
                    className="block text-left text-sm font-medium hover:text-[var(--learner-accent)] disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void onOpen(item)}
                    type="button"
                >
                    {item.prompt}
                </button>
                <span className="mt-1 block truncate text-sm text-[var(--learner-muted-text)]">
                    {item.activity_title} · {item.node_title} · {item.map_title}
                </span>
                <span className="mt-1 block text-xs text-[var(--learner-action-accent)]">
                    {item.is_due
                        ? 'Ready to recall'
                        : `Next recall: ${formatRecallDate(item.next_review_at)}`}
                    {item.review_count > 0
                        ? ` · Recalled ${item.review_count} times`
                        : ''}
                </span>
                {item.last_outcome || confidenceLabel || confidenceAfterFeedbackLabel ? (
                    <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                        {item.last_outcome
                            ? `Last result: ${item.last_outcome === 'correct' ? 'correct' : 'not correct'}`
                            : null}
                        {confidenceLabel
                            ? ` · Confidence: ${confidenceLabel}`
                            : null}
                        {confidenceAfterFeedbackLabel
                            ? ` · After feedback: ${confidenceAfterFeedbackLabel}`
                            : null}
                    </span>
                ) : null}
                <span className="mt-2 block text-xs text-[var(--learner-muted-text)]">
                    Why here: you kept this question for another recall attempt.
                </span>
            </span>
            <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button
                    className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-medium text-[var(--learner-accent)] disabled:pointer-events-none disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void onOpen(item)}
                    type="button"
                >
                    Open question
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </button>
                <button
                    aria-busy={postponing}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-[var(--learner-muted-text)] transition hover:text-[var(--learner-heading-text)] disabled:pointer-events-none disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void onPostpone(item)}
                    type="button"
                >
                    <Clock3 aria-hidden="true" className="size-4" />
                    {postponing ? 'Deferring…' : 'Defer one day'}
                </button>
                <button
                    aria-label="Remove question from recall queue"
                    className="inline-flex size-11 items-center justify-center rounded-md text-[var(--learner-muted-text)] transition hover:text-[var(--learner-heading-text)] disabled:pointer-events-none disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void onRemove(item)}
                    type="button"
                >
                    <Trash2 aria-hidden="true" className="size-4" />
                </button>
            </span>
        </div>
    );
}

function confidenceName(value: LearnerRecallItem['last_confidence']): string {
    return value === 'exploring'
        ? 'Exploring'
        : value === 'leaning'
          ? 'I have a hunch'
          : 'Settled';
}

function formatRecallDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
        new Date(value),
    );
}

function formatRevisitDate(value: string): string {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
          });
}
