import { ArrowRight, Bookmark, BookOpenText, Clock3, Pin, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { OriginalPaginatedItems } from './original-paginated-items';
import { OriginalLearnerHeader } from './original-learner-header';

type LearnerRecallItem = components['schemas']['LearnerRecallItem'];
type LearnerRecallQueue = components['schemas']['LearnerRecallQueue'];
type RevisitInvitation = components['schemas']['LearnerRevisitInvitation'];
type LearnerWorldSnapshot = components['schemas']['LearnerWorldSnapshot'];
type LearnerActivityStart = components['schemas']['LearnerActivityStart'];
type LearnerBookmarkMap = components['schemas']['LearnerBookmarkMap'];
type LearnerBookmarkPlace = components['schemas']['LearnerBookmarkPlace'];

const learnerStyle = {
    '--learner-action-accent': '#5eead4',
    '--learner-accent': '#5eead4',
    '--learner-border-color': 'rgba(255, 255, 255, 0.1)',
    '--learner-heading-text': '#f8fafc',
    '--learner-body-text': '#e2e8f0',
    '--learner-muted-text': '#cbd5e1',
    '--learner-page-background': '#0b1117',
    '--learner-panel-background': '#111820',
    '--learner-panel-muted-background': '#0e151d',
} as CSSProperties;

type ActiveRouteRow = {
    mapTitle: string;
    nodeTitle: string;
    start: LearnerActivityStart;
};

type RecentRouteRow = ActiveRouteRow;

function routeRows(
    world: LearnerWorldSnapshot | null,
    status: 'in_progress' | 'completed',
): ActiveRouteRow[] {
    if (!world) return [];
    const nodeTitles = new Map(
        world.world.maps.flatMap((map) =>
            map.nodes.map((node) => [`${map.slug}/${node.slug}`, { mapTitle: map.title, nodeTitle: node.title }] as const),
        ),
    );
    return world.start_routes
        .filter((start) => start.progress?.status === status)
        .sort((first, second) => {
            const firstDate = status === 'in_progress'
                ? first.progress?.last_entered_at
                : first.progress?.last_completed_at;
            const secondDate = status === 'in_progress'
                ? second.progress?.last_entered_at
                : second.progress?.last_completed_at;

            return (secondDate ?? '').localeCompare(firstDate ?? '');
        })
        .slice(0, 3)
        .flatMap((start) => {
            const node = nodeTitles.get(`${start.map_slug}/${start.node_slug}`);
            return node ? [{ start, ...node }] : [];
        });
}

function activeRouteRows(world: LearnerWorldSnapshot | null): ActiveRouteRow[] {
    return routeRows(world, 'in_progress');
}

function recentRouteRows(world: LearnerWorldSnapshot | null): RecentRouteRow[] {
    const activePlaces = new Set(
        activeRouteRows(world).map((route) => `${route.start.map_slug}/${route.start.node_slug}`),
    );

    return routeRows(world, 'completed').filter(
        (route) => !activePlaces.has(`${route.start.map_slug}/${route.start.node_slug}`),
    );
}

/**
 * Source-adapted Learning Desk sections from `features/home/learning-desk.tsx`.
 * Active-route continuation reuses the existing World snapshot and its opaque
 * route-start command; the browser never constructs a play-run identity.
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
    const [world, setWorld] = useState<LearnerWorldSnapshot | null>(null);
    const [bookmarkMap, setBookmarkMap] = useState<LearnerBookmarkMap | null>(null);
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
        void apiClient.GET('/learner/world').then(({ data, response }) => {
            if (active && response.ok && data) {
                setWorld(data);
            }
        }).catch(() => {
            // Recall and revisit remain usable when this independent source
            // section is temporarily unavailable.
        });
        return () => {
            active = false;
        };
    }, []);

    const currentRoutes = useMemo(() => activeRouteRows(world), [world]);
    const recentRoutes = useMemo(() => recentRouteRows(world), [world]);
    const bookmarkPlaces = bookmarkMap?.places ?? [];
    const featuredBookmark = useMemo(
        () =>
            currentRoutes
                .map((route) =>
                    bookmarkPlaces.find(
                        (place) =>
                            place.map_slug === route.start.map_slug &&
                            place.node_slug === route.start.node_slug,
                    ),
                )
                .find((place): place is LearnerBookmarkPlace => place !== undefined) ??
            bookmarkPlaces[0] ??
            null,
        [bookmarkPlaces, currentRoutes],
    );
    const bookmarkConnections = useMemo(
        () =>
            bookmarkPlaces
                .filter(
                    (place) =>
                        featuredBookmark === null ||
                        bookmarkPlaceKey(place) !== bookmarkPlaceKey(featuredBookmark),
                )
                .slice(0, 3),
        [bookmarkPlaces, featuredBookmark],
    );

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

    useEffect(() => {
        let active = true;

        void apiClient.GET('/learner/bookmarks').then(({ data, response }) => {
            if (active && response.ok && data) {
                setBookmarkMap(data);
            }
        }).catch(() => {
            // The rest of the desk remains useful while saved places are
            // temporarily unavailable.
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

    async function continueRoute(start: LearnerActivityStart): Promise<void> {
        if (openingItemId) return;
        setOpeningItemId(start.start_id);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/activity-starts/{start_id}/start',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { start_id: start.start_id },
                    },
                },
            );
            if (!response.ok || !data) throw new Error('resume failed');
            navigate(
                `/learning/nodes/${encodeURIComponent(data.node_slug)}/play?run=${encodeURIComponent(data.play_run_id)}`,
            );
        } catch {
            setError('That route could not be continued. Try again.');
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
                className="min-h-svh bg-[var(--learner-page-background)] text-[var(--learner-heading-text)]"
                id="learner-main-content"
                tabIndex={-1}
            >
            <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
            <div className="min-w-0 px-5 py-10 sm:px-8 lg:px-12 lg:py-14 xl:px-[clamp(3rem,7vw,8rem)]">
            <div className="mx-auto max-w-4xl">
                <header>
                    <p className="text-sm font-medium tracking-[0.16em] text-[var(--learner-accent)] uppercase">
                        Your learning desk
                    </p>
                    <h1 className="mt-3 text-3xl font-medium tracking-tight">What would you like to think about next?</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                        Continue a route, return to a question you kept nearby, or revisit a place when it becomes useful.
                    </p>
                </header>

                <PossibleConnections places={bookmarkConnections} />

                {currentRoutes.length ? (
                    <section aria-labelledby="continue-learning-heading" className="mt-8">
                        <div className="flex items-center gap-5 pb-3">
                            <h2 className="shrink-0 text-xs font-semibold tracking-[0.22em] text-[var(--learner-muted-text)] uppercase focus:outline-none" id="continue-learning-heading" tabIndex={-1}>
                                Continue learning
                            </h2>
                        </div>
                        <div className="mt-4 divide-y divide-[var(--learner-border-color)] border-y border-[var(--learner-border-color)]">
                            {currentRoutes.map((route) => <ContinueRouteRow key={route.start.start_id} onContinue={continueRoute} opening={openingItemId === route.start.start_id} route={route} />)}
                        </div>
                    </section>
                ) : null}

                {recentRoutes.length ? (
                    <section aria-labelledby="recent-traces-heading" className="mt-8" id="recent-section">
                        <div className="flex items-center gap-5 pb-3">
                            <h2 className="shrink-0 text-xs font-semibold tracking-[0.22em] text-[var(--learner-muted-text)] uppercase focus:outline-none" id="recent-traces-heading" tabIndex={-1}>
                                Recent traces
                            </h2>
                        </div>
                        <OriginalPaginatedItems
                            className="divide-y divide-[var(--learner-border-color)] border-b border-[var(--learner-border-color)]"
                            items={recentRoutes}
                            pageSize={2}
                            paginationLabel="Recent traces"
                            renderItem={(route) => (
                                <RecentRouteRow key={route.start.start_id} onRevisit={continueRoute} opening={openingItemId === route.start.start_id} route={route} />
                            )}
                        />
                    </section>
                ) : null}

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
            </div>
            <LearningDeskRail featured={featuredBookmark} places={bookmarkPlaces} />
            </div>
            </main>
        </div>
    );
}

function ContinueRouteRow({
    onContinue,
    opening,
    route,
}: {
    onContinue: (start: LearnerActivityStart) => Promise<void>;
    opening: boolean;
    route: ActiveRouteRow;
}) {
    return (
        <article className="group grid gap-4 py-5 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:items-center">
            <div className="grid size-12 place-items-center border border-[var(--learner-border-color)] text-[var(--learner-accent)]">
                <BookOpenText className="size-5" />
            </div>
            <div className="min-w-0">
                <p className="truncate text-sm font-medium">{route.start.label}</p>
                <p className="mt-1 truncate text-sm text-[var(--learner-muted-text)]">{route.nodeTitle} · {route.mapTitle}</p>
            </div>
            <button className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--learner-accent)] disabled:opacity-50 sm:justify-self-end" disabled={opening} onClick={() => void onContinue(route.start)} type="button">
                {opening ? 'Opening…' : 'Continue'}<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </button>
        </article>
    );
}

function RecentRouteRow({
    onRevisit,
    opening,
    route,
}: {
    onRevisit: (start: LearnerActivityStart) => Promise<void>;
    opening: boolean;
    route: RecentRouteRow;
}) {
    const completedAt = route.start.progress?.last_completed_at;

    return (
        <article className="group grid gap-4 py-5 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:items-center">
            <button aria-label={route.start.label} className="grid size-12 place-items-center border border-[var(--learner-border-color)] text-[var(--learner-action-accent)] hover:border-[color-mix(in_srgb,var(--learner-action-accent)_55%,var(--learner-border-color))] disabled:opacity-50" disabled={opening} onClick={() => void onRevisit(route.start)} type="button">
                <Clock3 className="size-5" />
            </button>
            <div className="min-w-0">
                <button className="block truncate text-left text-sm font-medium hover:text-[var(--learner-accent)] disabled:opacity-50" disabled={opening} onClick={() => void onRevisit(route.start)} type="button">
                    {route.start.label}
                </button>
                <p className="mt-1 truncate text-sm text-[var(--learner-muted-text)]">{route.nodeTitle} · {route.mapTitle}</p>
                <p className="mt-2 text-xs text-[var(--learner-muted-text)]">Why here: you completed this route recently.</p>
            </div>
            <span className="flex items-center gap-4 sm:justify-self-end">
                {completedAt ? <span className="hidden text-xs text-[var(--learner-muted-text)] xl:inline">{formatDeskDate(completedAt)}</span> : null}
                <button className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)] disabled:opacity-50" disabled={opening} onClick={() => void onRevisit(route.start)} type="button">
                    {opening ? 'Opening…' : 'Revisit'}<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </button>
            </span>
        </article>
    );
}

function LearningDeskRail({
    featured,
    places,
}: {
    featured: LearnerBookmarkPlace | null;
    places: LearnerBookmarkPlace[];
}) {
    return (
        <aside className="border-t border-[var(--learner-border-color)] bg-[var(--learner-panel-muted-background)] px-5 py-9 sm:px-8 lg:border-t-0 lg:border-l lg:px-7">
            <p className="text-xs font-semibold tracking-[0.22em] text-[var(--learner-muted-text)] uppercase">
                Pinned for later
            </p>

            {featured ? (
                <FeaturedBookmark bookmark={featured} />
            ) : (
                <div className="mt-7 border-y border-[var(--learner-border-color)] py-6">
                    <Pin className="size-5 text-[var(--learner-action-accent)]" />
                    <p className="mt-4 font-medium">Pin a place to your desk</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--learner-muted-text)]">
                        Your most recently visited bookmarked place will appear here.
                    </p>
                </div>
            )}

            <div className="mt-8">
                <p className="text-xs font-semibold tracking-[0.18em] text-[var(--learner-action-accent)] uppercase">
                    Saved places
                </p>
                <div className="mt-4 divide-y divide-[var(--learner-border-color)] border-y border-[var(--learner-border-color)]">
                    {places.length ? (
                        places.slice(0, 5).map((place) => (
                            <Link
                                className="group flex items-start gap-3 py-4 text-sm"
                                key={bookmarkPlaceKey(place)}
                                to={bookmarkWorldHref(place)}
                            >
                                <Bookmark className="mt-0.5 size-4 shrink-0 text-[var(--learner-action-accent)] transition group-hover:fill-current" />
                                <span>
                                    <span className="block font-medium text-[var(--learner-heading-text)] group-hover:text-[var(--learner-accent)]">
                                        {place.title}
                                    </span>
                                    <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                                        {place.map_title}
                                    </span>
                                </span>
                            </Link>
                        ))
                    ) : (
                        <p className="py-5 text-sm text-[var(--learner-muted-text)]">
                            No saved places yet.
                        </p>
                    )}
                </div>
                <Link
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)] hover:text-[var(--learner-heading-text)]"
                    to="/bookmarks"
                >
                    View all bookmarks
                    <ArrowRight className="size-4" />
                </Link>
            </div>
        </aside>
    );
}

function PossibleConnections({ places }: { places: LearnerBookmarkPlace[] }) {
    return (
        <section aria-labelledby="connections-heading" className="mt-8" id="connections-section">
            <div className="flex items-center gap-5 pb-3">
                <h2 className="shrink-0 text-xs font-semibold tracking-[0.22em] text-[var(--learner-muted-text)] uppercase" id="connections-heading">
                    Possible connections
                </h2>
            </div>
            {places.length ? (
                <div className="border-b border-[var(--learner-border-color)] py-6">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
                        {places.map((place, index) => (
                            <div className="flex items-center gap-4" key={bookmarkPlaceKey(place)}>
                                {index > 0 ? <ArrowRight className="size-4 text-[var(--learner-action-accent)]" /> : null}
                                <Link
                                    className="underline decoration-transparent underline-offset-4 transition hover:text-[var(--learner-accent)] hover:decoration-[var(--learner-accent)]"
                                    to={bookmarkWorldHref(place)}
                                >
                                    {place.title}
                                </Link>
                            </div>
                        ))}
                    </div>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                        Drawn from places you saved for later. Tutor and AI suggestions can join this space as separate, clearly labelled sources.
                    </p>
                </div>
            ) : (
                <div className="border-b border-[var(--learner-border-color)] py-6">
                    <p className="font-medium">Connections need a little context</p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                        Save interesting places and this area can reveal useful paths between them.
                    </p>
                    <Link
                        className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)] hover:text-[var(--learner-heading-text)]"
                        to="/world"
                    >
                        Open the map
                        <ArrowRight className="size-4" />
                    </Link>
                </div>
            )}
        </section>
    );
}

function FeaturedBookmark({ bookmark }: { bookmark: LearnerBookmarkPlace }) {
    return (
        <article className="mt-7 border-b border-[var(--learner-border-color)] pb-8">
            {bookmark.asset?.image_url ? (
                <div className="mb-5 flex h-28 items-center justify-center overflow-hidden bg-[var(--learner-panel-background)]">
                    <img alt="" className="h-full w-full object-contain" src={bookmark.asset.image_url} />
                </div>
            ) : null}
            <p className="text-xs font-medium tracking-[0.16em] text-[var(--learner-accent)] uppercase">
                Pinned place
            </p>
            <h2 className="mt-3 text-sm font-semibold">{bookmark.title}</h2>
            <p className="mt-1 text-xs text-[var(--learner-muted-text)]">
                {bookmark.map_title}
            </p>
            {bookmark.description ? (
                <p className="mt-4 line-clamp-5 text-sm leading-6 text-[var(--learner-body-text)]">
                    {bookmark.description}
                </p>
            ) : null}
            <Link
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-accent)] hover:text-[var(--learner-heading-text)]"
                to={bookmarkWorldHref(bookmark)}
            >
                Open place
                <ArrowRight className="size-4" />
            </Link>
        </article>
    );
}

function bookmarkPlaceKey(place: LearnerBookmarkPlace): string {
    return `${place.map_slug}/${place.node_slug}`;
}

function bookmarkWorldHref(place: LearnerBookmarkPlace): string {
    return `/world?map=${encodeURIComponent(place.map_slug)}&focused=${encodeURIComponent(place.node_slug)}`;
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

function formatDeskDate(value: string): string {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
