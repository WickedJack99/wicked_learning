import { Link } from 'react-router';
import { type ReactNode, useEffect, useState } from 'react';

import type { components } from './api/schema';
import { readLiftedJsonResponse } from './lifted-json-response';
import { LiftedPaginationControls } from './lifted-pagination-controls';
import { usePlatformTranslation } from './original-platform-translation';

type RustReviewQueuePage = components['schemas']['AdminWorldReviewQueuePage'];

type ReviewQueueItem = {
    activity: {
        id: string;
        title: string;
        type: string;
    };
    map: {
        id: string;
        title: string;
    };
    node: {
        id: string;
        title: string;
    };
};

type ReviewQueueResponse = {
    errors?: Record<string, string[]>;
    items: ReviewQueueItem[];
    message?: string;
    pagination: {
        lastPage: number;
        page: number;
        perPage: number;
        total: number;
    };
};

/**
 * Direct Rust transport adapter for the pinned source review queue shape.
 * The backend flattens an item and uses snake_case pagination; presentation
 * stays in the lifted source component below.
 */
function adaptRustReviewQueuePage(page: RustReviewQueuePage): ReviewQueueResponse {
    return {
        items: page.items.map((item) => ({
            activity: {
                id: item.id,
                title: item.title,
                type: item.activity_type,
            },
            map: item.map,
            node: item.node,
        })),
        pagination: {
            lastPage: page.pagination.last_page,
            page: page.pagination.current_page,
            perPage: page.pagination.per_page,
            total: page.pagination.total,
        },
    };
}

type RustNavigationLinkProps = {
    'aria-label'?: string;
    children: ReactNode;
    className?: string;
    onNavigate: () => void;
    to: string;
};

/** React Router replacement for the source Inertia Link boundary. */
function RustNavigationLink({
    'aria-label': ariaLabel,
    children,
    className,
    onNavigate,
    to,
}: RustNavigationLinkProps) {
    return (
        <Link
            aria-label={ariaLabel}
            className={className}
            onClick={(event) => {
                event.preventDefault();
                onNavigate();
            }}
            to={to}
        >
            {children}
        </Link>
    );
}

/**
 * Direct lift of main:resources/js/features/settings/world-builder-settings-panel.tsx
 * `WorldBuilderReviewQueue`. Only the Rust read endpoint and React Router link
 * boundary differ from the pinned source.
 */
export function LiftedWorldBuilderReviewQueue({
    onOpenActivity,
}: {
    onOpenActivity: (mapId: string, nodeId: string, activityId: string) => void;
}) {
    const t = usePlatformTranslation();
    const [page, setPage] = useState(1);
    const [reviewItems, setReviewItems] = useState<ReviewQueueItem[]>([]);
    const [pageCount, setPageCount] = useState(1);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [requestVersion, setRequestVersion] = useState(0);
    const pageSize = 4;

    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams({
            page: String(page),
            per_page: String(pageSize),
        });

        void fetch('/api/v1/admin/world-builder/review-queue?' + params.toString(), {
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            signal: controller.signal,
        })
            .then((response) =>
                readLiftedJsonResponse<
                    RustReviewQueuePage & {
                        errors?: Record<string, string[]>;
                        message?: string;
                    }
                >(
                    response,
                    'The review queue could not be loaded.',
                ),
            )
            .then((payload) => {
                const sourcePayload = adaptRustReviewQueuePage(payload);
                setReviewItems(sourcePayload.items);
                setPageCount(Math.max(1, sourcePayload.pagination.lastPage));
                setTotal(sourcePayload.pagination.total);
                setPage((currentPage) =>
                    Math.min(
                        currentPage,
                        Math.max(1, sourcePayload.pagination.lastPage),
                    ),
                );
            })
            .catch((requestError: unknown) => {
                if (
                    requestError instanceof DOMException &&
                    requestError.name === 'AbortError'
                ) {
                    return;
                }

                setReviewItems([]);
                setTotal(0);
                setError(
                    requestError instanceof Error
                        ? requestError.message
                        : 'The review queue could not be loaded.',
                );
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            });

        return () => controller.abort();
    }, [page, requestVersion]);

    const currentPage = Math.min(page, pageCount);

    return (
        <section
            className="flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-6"
            data-wl-id="authoring.world-builder.review-queue"
        >
            <header className="shrink-0 border-b border-[var(--settings-border-color)] pb-4">
                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                    {t(
                        'settings.world_builder.review_queue.eyebrow',
                        'Authoring',
                    )}
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                    {t(
                        'settings.world_builder.review_queue.title',
                        'Review queue',
                    )}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">
                    {total > 0
                        ? t(
                              total === 1
                                  ? 'settings.world_builder.review_queue.waiting_one'
                                  : 'settings.world_builder.review_queue.waiting_many',
                              total === 1
                                  ? '1 activity is waiting for review.'
                                  : ':count activities are waiting for review.',
                              { count: total },
                          )
                        : t(
                              'settings.world_builder.review_queue.empty',
                              'Everything in this world is up to date.',
                          )}
                </p>
            </header>

            {isLoading ? (
                <div className="grid min-h-0 flex-1 place-items-center p-6 text-center">
                    <p className="text-sm text-[var(--settings-muted-text)]">
                        Loading review queue…
                    </p>
                </div>
            ) : error ? (
                <div className="grid min-h-0 flex-1 place-items-center gap-3 p-6 text-center">
                    <p className="max-w-md text-sm leading-6 text-red-400">
                        {error}
                    </p>
                    <button
                        className="text-sm font-semibold text-[var(--settings-accent)] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none"
                        onClick={() => {
                            setIsLoading(true);
                            setRequestVersion((version) => version + 1);
                        }}
                        type="button"
                    >
                        Try again
                    </button>
                </div>
            ) : total === 0 ? (
                <div className="grid min-h-0 flex-1 place-items-center p-6 text-center">
                    <p className="max-w-md text-sm leading-6 text-[var(--settings-muted-text)]">
                        {t(
                            'settings.world_builder.review_queue.empty_detail',
                            'New or changed activities will appear here after an author saves them.',
                        )}
                    </p>
                </div>
            ) : (
                <>
                    <div className="min-h-0 flex-1 overflow-hidden py-4 pr-1">
                        <div className="grid gap-3 sm:grid-cols-2">
                            {reviewItems.map(({ activity, map, node }) => (
                                <RustNavigationLink
                                    aria-label={`Review ${activity.title}`}
                                    className="group min-w-0 rounded-lg border border-[var(--settings-border-color)] p-3 transition hover:border-[var(--settings-accent)] focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--settings-content-background)] focus-visible:outline-none"
                                    key={activity.id}
                                    onNavigate={() =>
                                        onOpenActivity(
                                            map.id,
                                            node.id,
                                            activity.id,
                                        )
                                    }
                                    to={`/settings?panel=admin-world-builder&worldSection=graph&map=${map.id}&node=${node.id}&worldView=nodes&reviewActivity=${activity.id}`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium tracking-[0.16em] text-[var(--settings-accent)] uppercase">
                                                {map.title}
                                            </p>
                                            <h3 className="mt-1 truncate text-sm font-semibold">
                                                {activity.title}
                                            </h3>
                                            <p className="mt-1 truncate text-xs text-[var(--settings-muted-text)]">
                                                {node.title} · {activity.type}
                                            </p>
                                        </div>
                                        <span className="shrink-0 text-xs font-semibold text-[var(--settings-accent)] group-hover:underline">
                                            {t(
                                                'settings.world_builder.review_queue.open',
                                                'Open',
                                            )}{' '}
                                            <span aria-hidden="true">→</span>
                                        </span>
                                    </div>
                                </RustNavigationLink>
                            ))}
                        </div>
                    </div>

                    <footer className="shrink-0 border-t border-[var(--settings-border-color)] pt-3">
                        <LiftedPaginationControls
                            buttonClassName="text-sm text-[var(--settings-accent)] transition hover:text-[var(--settings-accent-foreground)]"
                            currentPage={currentPage}
                            label={t(
                                'settings.world_builder.review_queue.pagination',
                                'Review queue pagination',
                            )}
                            nextLabel={t(
                                'settings.world_builder.review_queue.next',
                                'Next',
                            )}
                            onPageChange={(nextPage) => {
                                setIsLoading(true);
                                setError(null);
                                setPage(nextPage);
                            }}
                            pageCount={pageCount}
                            previousLabel={t(
                                'settings.world_builder.review_queue.previous',
                                'Previous',
                            )}
                            textClassName="text-xs text-[var(--settings-muted-text)]"
                        />
                    </footer>
                </>
            )}
        </section>
    );
}

/** Direct lift of the source WorldBuilderSectionWorkspace wrapper. */
export function LiftedWorldBuilderSectionWorkspace({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <section className="h-full min-h-0 overflow-hidden">{children}</section>
    );
}
