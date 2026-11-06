import {
    Check,
    ChevronLeft,
    ChevronRight,
    MessageSquareText,
} from 'lucide-react';
import { type CSSProperties, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';

type ReviewPage = components['schemas']['AdminPlatformFeedbackPage'];

/** Source-adapted from PlatformFeedbackSection. */
export function OriginalPlatformFeedbackReviewPage({
    appearance,
    canReview,
}: {
    appearance: OriginalAppearance;
    canReview: boolean;
}) {
    const location = useLocation();
    const navigate = useNavigate();
    const requestedPage = Number(
        new URLSearchParams(location.search).get('platform_feedback_page') ?? 1,
    );
    const [page, setPage] = useState<ReviewPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reviewingId, setReviewingId] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const pageNumber =
            Number.isInteger(requestedPage) && requestedPage > 0
                ? requestedPage
                : 1;

        setLoading(true);
        setError('');
        void apiClient
            .GET('/admin/platform-feedback', {
                params: { query: { page: pageNumber } },
            })
            .then(({ data, response }) => {
                if (!response.ok || !data) {
                    throw new Error('platform feedback unavailable');
                }
                if (active) setPage(data);
            })
            .catch(() => {
                if (active) {
                    setPage(null);
                    setError('Platform feedback is temporarily unavailable.');
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [requestedPage]);

    async function markReviewed(feedbackId: string): Promise<void> {
        if (reviewingId) return;

        setReviewingId(feedbackId);
        setError('');
        try {
            const csrfToken = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/platform-feedback/{feedback_id}/review',
                {
                    params: {
                        header: { 'X-CSRF-Token': csrfToken },
                        path: { feedback_id: feedbackId },
                    },
                },
            );
            if (!response.ok) throw new Error('platform feedback unavailable');
            setPage((current) =>
                current === null
                    ? current
                    : {
                          ...current,
                          items: current.items.map((item) =>
                              item.id === feedbackId
                                  ? {
                                        ...item,
                                        reviewed_at: new Date().toISOString(),
                                    }
                                  : item,
                          ),
                      },
            );
        } catch {
            setError('The review status could not be saved yet.');
        } finally {
            setReviewingId(null);
        }
    }

    function changePage(nextPage: number): void {
        const parameters = new URLSearchParams(location.search);
        parameters.set('platform_feedback_page', String(nextPage));
        navigate(`/settings?${parameters.toString()}`);
    }

    return (
        <main
            className="settings-surface min-h-svh bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100"
            style={settingsStyle(appearance)}
        >
            <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[92rem] flex-col">
                <header className="flex shrink-0 items-start justify-between gap-4 pb-5">
                    <div>
                        <Link
                            className="mb-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] transition hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]"
                            to="/home"
                        >
                            <ChevronLeft className="size-4" /> Learning desk
                        </Link>
                        <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                            Settings
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                            Learning Support
                        </h1>
                    </div>
                </header>
                <section className="min-h-0 flex-1 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)]">
                    <div
                        className="flex h-full min-h-0 flex-col"
                        data-wl-id="settings.learning-support.platform-feedback"
                    >
                        <header className="shrink-0 border-b border-[var(--settings-border-color)] px-4 py-4 sm:px-5">
                            <div className="flex items-start gap-3">
                                <MessageSquareText
                                    aria-hidden="true"
                                    className="mt-1 size-5 shrink-0 text-[var(--settings-accent)]"
                                />
                                <div>
                                    <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                        Platform feedback
                                    </p>
                                    <h2 className="mt-2 text-2xl font-semibold">
                                        Shared feedback
                                    </h2>
                                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">
                                        Messages here were deliberately shared
                                        by learners about the platform. They are
                                        separate from journal content and
                                        learning evidence.
                                    </p>
                                </div>
                            </div>
                        </header>
                        <div
                            className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5"
                            data-wl-id="settings.learning-support.platform-feedback.list"
                        >
                            {loading ? (
                                <p className="py-8 text-sm text-[var(--settings-muted-text)]">
                                    Loading platform feedback...
                                </p>
                            ) : null}
                            {error ? (
                                <p
                                    className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            ) : null}
                            {!loading && page?.items.length ? (
                                <div className="grid gap-3">
                                    {page.items.map((item) => (
                                        <article
                                            className="rounded-lg border border-[var(--settings-border-color)] p-4"
                                            data-wl-id={`settings.platform-feedback.item.${item.id}`}
                                            key={item.id}
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold">
                                                        {categoryLabel(
                                                            item.category,
                                                        )}
                                                    </p>
                                                    <p className="mt-1 text-xs text-[var(--settings-muted-text)]">
                                                        {item.user.name ??
                                                            item.user.email ??
                                                            'Unknown'}{' '}
                                                        ·{' '}
                                                        {formatDate(
                                                            item.submitted_at,
                                                        )}
                                                    </p>
                                                </div>
                                                {item.reviewed_at ? (
                                                    <span className="inline-flex items-center gap-1 text-xs text-[var(--settings-muted-text)]">
                                                        <Check className="size-3" />
                                                        Reviewed
                                                    </span>
                                                ) : canReview ? (
                                                    <button
                                                        className="inline-flex items-center rounded-md border border-[var(--settings-border-color)] px-3 py-1.5 text-sm font-medium transition hover:bg-[var(--settings-active-background)] disabled:opacity-50"
                                                        data-wl-id={`settings.platform-feedback.review.${item.id}`}
                                                        disabled={
                                                            reviewingId !== null
                                                        }
                                                        onClick={() =>
                                                            void markReviewed(
                                                                item.id,
                                                            )
                                                        }
                                                        type="button"
                                                    >
                                                        <Check className="mr-1.5 size-3" />
                                                        {reviewingId === item.id
                                                            ? 'Saving...'
                                                            : 'Mark reviewed'}
                                                    </button>
                                                ) : null}
                                            </div>
                                            <p className="mt-4 text-sm leading-6 whitespace-pre-wrap">
                                                {item.message}
                                            </p>
                                        </article>
                                    ))}
                                </div>
                            ) : null}
                            {!loading && page && page.items.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-[var(--settings-border-color)] p-6 text-sm text-[var(--settings-muted-text)]">
                                    No platform feedback has been shared yet.
                                </p>
                            ) : null}
                        </div>
                        {page ? (
                            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--settings-border-color)] px-4 py-3 sm:px-5">
                                <button
                                    aria-label="Previous feedback page"
                                    className="inline-flex items-center rounded-md px-2 py-1.5 text-sm font-medium disabled:opacity-40"
                                    disabled={page.pagination.current_page <= 1}
                                    onClick={() =>
                                        changePage(
                                            page.pagination.current_page - 1,
                                        )
                                    }
                                    type="button"
                                >
                                    <ChevronLeft className="size-4" />
                                    Previous
                                </button>
                                <p className="text-xs text-[var(--settings-muted-text)]">
                                    Page {page.pagination.current_page} of{' '}
                                    {page.pagination.last_page}
                                </p>
                                <button
                                    aria-label="Next feedback page"
                                    className="inline-flex items-center rounded-md px-2 py-1.5 text-sm font-medium disabled:opacity-40"
                                    disabled={
                                        page.pagination.current_page >=
                                        page.pagination.last_page
                                    }
                                    onClick={() =>
                                        changePage(
                                            page.pagination.current_page + 1,
                                        )
                                    }
                                    type="button"
                                >
                                    Next
                                    <ChevronRight className="size-4" />
                                </button>
                            </footer>
                        ) : null}
                    </div>
                </section>
            </div>
        </main>
    );
}

function categoryLabel(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function settingsStyle(appearance: OriginalAppearance): CSSProperties {
    const dark = appearance === 'dark';
    return {
        '--settings-accent': dark ? '#2dd4bf' : '#0f766e',
        '--settings-active-background': dark
            ? 'rgba(45, 212, 191, 0.12)'
            : '#ccfbf1',
        '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0',
        '--settings-content-background': dark ? '#0b1117' : '#f1f5f9',
        '--settings-muted-text': dark ? '#94a3b8' : '#64748b',
        '--settings-panel-background': dark ? '#111820' : '#ffffff',
    } as CSSProperties;
}
