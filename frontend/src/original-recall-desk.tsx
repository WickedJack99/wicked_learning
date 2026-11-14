import { ArrowRight, Bookmark, BookOpenText, Clock3, Focus, MessageCircle, Pin, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import { useCurrentUser } from './current-user';
import type { components } from './api/schema';
import { OriginalLearningDeskSearch } from './original-learning-desk-search';
import { OriginalPaginatedItems } from './original-paginated-items';
import { OriginalLearnerHeader } from './original-learner-header';
import { usePlatformTranslation } from './original-platform-translation';

type LearnerRecallItem = components['schemas']['LearnerRecallItem'];
type LearnerRecallQueue = components['schemas']['LearnerRecallQueue'];
type RevisitInvitation = components['schemas']['LearnerRevisitInvitation'];
type LearnerWorldSnapshot = components['schemas']['LearnerWorldSnapshot'];
type LearnerActivityStart = components['schemas']['LearnerActivityStart'];
type LearnerBookmarkMap = components['schemas']['LearnerBookmarkMap'];
type LearnerBookmarkPlace = components['schemas']['LearnerBookmarkPlace'];
type LearnerJournalCheckIn = components['schemas']['LearnerJournalCheckIn'];
type LearnerDeskPlanningPreference =
    components['schemas']['LearnerDeskPlanningPreference'];
type LearnerDeskSupportResponse =
    components['schemas']['LearnerDeskSupportResponse'];

type DeskPurposeFilter = LearnerDeskPlanningPreference['purpose_filter'];
type DeskTimeBudget = LearnerDeskPlanningPreference['time_budget'];
type DeskPlanningSelection = {
    purposeFilter: DeskPurposeFilter;
    timeBudget: DeskTimeBudget;
};

const deskLearningPurposes: Exclude<DeskPurposeFilter, 'any'>[] = [
    'apply',
    'explain',
    'participate',
    'reflect',
    'retrieve',
    'review',
    'transfer',
];

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
    imageUrl: string | null;
    mapTitle: string;
    nodeTitle: string;
    start: LearnerActivityStart;
};

type RecentRouteRow = ActiveRouteRow;

type LearningDeskArea =
    | 'connections'
    | 'continue'
    | 'recent'
    | 'recall'
    | 'reflections'
    | 'support'
    | 'revisit';

function routeRows(
    world: LearnerWorldSnapshot | null,
    status: 'in_progress' | 'completed',
): ActiveRouteRow[] {
    if (!world) return [];
    const nodeTitles = new Map(
        world.world.maps.flatMap((map) =>
            map.nodes.map((node) => [
                `${map.slug}/${node.slug}`,
                {
                    imageUrl:
                        map.assets.find((asset) => asset.slug === node.asset_slug)
                            ?.image_url ?? null,
                    mapTitle: map.title,
                    nodeTitle: node.title,
                },
            ] as const),
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
    userSubjectId,
}: {
    onSignedOut: () => void;
    userEmail: string;
    userSubjectId: string;
}) {
    const navigate = useNavigate();
    const t = usePlatformTranslation();
    const { currentUser } = useCurrentUser();
    const firstName =
        currentUser.kind === 'loaded'
            ? currentUser.name.trim().split(/\s+/)[0]
            : '';
    const shouldFocusAreaHeadingRef = useRef(false);
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
    const [checkIns, setCheckIns] = useState<LearnerJournalCheckIn[]>([]);
    const [supportResponses, setSupportResponses] = useState<
        LearnerDeskSupportResponse[]
    >([]);
    const [updatingRevisitId, setUpdatingRevisitId] = useState<string | null>(
        null,
    );
    const [openingReflectionId, setOpeningReflectionId] = useState<
        string | null
    >(null);
    const [error, setError] = useState('');
    const planningPreferenceKey = `wicked-learning:desk-planning:${userSubjectId}`;
    const [savedPlanningPreference, setSavedPlanningPreference] =
        useState<DeskPlanningSelection>(() =>
            readDeskPlanningPreference(planningPreferenceKey),
        );
    const [planningPreferenceSaveState, setPlanningPreferenceSaveState] =
        useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [timeBudget, setTimeBudget] = useState<DeskTimeBudget>(
        savedPlanningPreference.timeBudget,
    );
    const [purposeFilter, setPurposeFilter] = useState<DeskPurposeFilter>(
        savedPlanningPreference.purposeFilter,
    );
    const focusPreferenceKey = `wicked-learning:desk-focus-view:${userSubjectId}`;
    const [focusView, setFocusView] = useState(() =>
        readFocusViewPreference(focusPreferenceKey),
    );

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

        void apiClient.GET('/learner/desk-planning-preference').then(
            ({ data, response }) => {
                if (!active || !response.ok || !data || !data.is_saved) {
                    return;
                }
                const preference = {
                    purposeFilter: data.purpose_filter,
                    timeBudget: data.time_budget,
                };
                setSavedPlanningPreference(preference);
                setPurposeFilter(preference.purposeFilter);
                setTimeBudget(preference.timeBudget);
            },
        ).catch(() => {
            // The local source fallback remains useful when this independent
            // optional account-preference reader is temporarily unavailable.
        });

        return () => {
            active = false;
        };
    }, [planningPreferenceKey]);

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
    const recentCheckIns = useMemo(() => checkIns.slice(0, 4), [checkIns]);
    const learningPurposeOptions = deskLearningPurposes.filter((purpose) =>
        currentRoutes.some((route) => route.start.desk.learning_intent === purpose),
    );
    const hasTimeGuides = currentRoutes.some(
        (route) => route.start.desk.time_guide_minutes !== null,
    );
    const activePurposeFilter = learningPurposeOptions.includes(
        purposeFilter as Exclude<DeskPurposeFilter, 'any'>,
    )
        ? purposeFilter
        : 'any';
    const activeTimeBudget = hasTimeGuides ? timeBudget : 'any';
    const visibleCurrentRoutes = currentRoutes.filter((route) =>
        fitsDeskFilters(
            route.start.desk.time_guide_minutes,
            route.start.desk.learning_intent,
            activeTimeBudget,
            activePurposeFilter,
        ),
    );
    const hasActiveRouteFilter =
        activeTimeBudget !== 'any' || activePurposeFilter !== 'any';
    const areaLabels: Record<LearningDeskArea, string> = {
        connections: t('home.learning_desk.sections.connections', 'Connections'),
        continue: t(
            'home.learning_desk.sections.continue',
            'Continue learning',
        ),
        recent: t('home.learning_desk.sections.recent', 'Recent traces'),
        recall: t('home.learning_desk.sections.recall', 'Recall queue'),
        reflections: t(
            'home.learning_desk.sections.reflections',
            'Recent reflections',
        ),
        revisit: t('home.learning_desk.sections.revisit', 'Return when useful'),
        support: t('home.learning_desk.sections.support', 'Learning Support'),
    };
    const availableAreas: LearningDeskArea[] = [
        'connections',
        ...(recentCheckIns.length ? (['reflections'] as const) : []),
        ...(queue?.items.length ? (['recall'] as const) : []),
        ...(revisitInvitations.length ? (['revisit'] as const) : []),
        ...(recentRoutes.length ? (['recent'] as const) : []),
        ...(supportResponses.length ? (['support'] as const) : []),
        'continue',
    ];
    const defaultArea = availableAreas[0] ?? 'connections';
    const [activeArea, setActiveArea] = useState<LearningDeskArea>(
        () => deskAreaFromUrl() ?? defaultArea,
    );
    const visibleArea = availableAreas.includes(activeArea)
        ? activeArea
        : defaultArea;

    function updateTimeBudget(nextTimeBudget: DeskTimeBudget) {
        setTimeBudget(nextTimeBudget);
        setPlanningPreferenceSaveState('idle');
    }

    function updatePurposeFilter(nextPurposeFilter: DeskPurposeFilter) {
        setPurposeFilter(nextPurposeFilter);
        setPlanningPreferenceSaveState('idle');
    }

    function clearPlanningChoices() {
        updateTimeBudget('any');
        updatePurposeFilter('any');
    }

    function updateFocusView(nextFocusView: boolean) {
        setFocusView(nextFocusView);
        writeFocusViewPreference(focusPreferenceKey, nextFocusView);
    }

    function selectArea(area: LearningDeskArea) {
        if (area === visibleArea) {
            return;
        }
        shouldFocusAreaHeadingRef.current = true;
        setActiveArea(area);

        const url = new URL(window.location.href);
        if (area === 'connections') {
            url.searchParams.delete('area');
        } else {
            url.searchParams.set('area', area);
        }
        window.history.pushState(window.history.state, '', url);
    }

    async function savePlanningChoices(): Promise<void> {
        setPlanningPreferenceSaveState('saving');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH(
                '/learner/desk-planning-preference',
                {
                    body: {
                        purpose_filter: activePurposeFilter,
                        time_budget: activeTimeBudget,
                    },
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );
            if (!response.ok || !data) {
                throw new Error('save failed');
            }
            setSavedPlanningPreference({
                purposeFilter: data.purpose_filter,
                timeBudget: data.time_budget,
            });
            setPlanningPreferenceSaveState('saved');
        } catch {
            setPlanningPreferenceSaveState('error');
        }
    }

    useEffect(() => {
        const handlePopState = () => {
            setActiveArea(deskAreaFromUrl() ?? defaultArea);
        };
        window.addEventListener('popstate', handlePopState);

        return () => window.removeEventListener('popstate', handlePopState);
    }, [defaultArea]);

    useEffect(() => {
        if (!shouldFocusAreaHeadingRef.current) {
            return;
        }
        shouldFocusAreaHeadingRef.current = false;
        document.getElementById(`${visibleArea}-heading`)?.focus();
    }, [visibleArea]);

    useEffect(() => {
        let active = true;
        void apiClient
            .GET('/learner/journal', {
                params: { query: { page: 1, per_page: 1 } },
            })
            .then(({ data, response }) => {
                if (active && response.ok && data) {
                    setCheckIns(data.check_ins);
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
        void apiClient.GET('/learner/desk/support-responses').then(
            ({ data, response }) => {
                if (active && response.ok && data) {
                    setSupportResponses(data);
                }
            },
        ).catch(() => {
            // The remaining Learning Desk sections stay useful while this
            // independent private reader is temporarily unavailable.
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

    async function openReflection(checkIn: LearnerJournalCheckIn): Promise<void> {
        if (openingReflectionId !== null) {
            return;
        }

        setOpeningReflectionId(checkIn.id);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/activities/{activity_slug}/replay',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { activity_slug: checkIn.activity_slug },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('open failed');
            }
            navigate(
                `/learning/nodes/${encodeURIComponent(data.node_slug)}/play?run=${encodeURIComponent(data.play_run_id)}`,
            );
        } catch {
            setError('That reflection activity could not be opened. Try again.');
        } finally {
            setOpeningReflectionId(null);
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
            <div className={[
                'grid min-h-full',
                focusView
                    ? 'lg:grid-cols-1'
                    : 'lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]',
            ].join(' ')}>
            <div className="min-w-0 px-5 py-10 sm:px-8 lg:px-12 lg:py-14 xl:px-[clamp(3rem,7vw,8rem)]">
            <div className="mx-auto max-w-4xl">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-sm font-medium tracking-[0.16em] text-[var(--learner-accent)] uppercase">
                            {t('home.learning_desk.eyebrow', 'Your learning desk')}
                        </p>
                        <h1 className="mt-3 text-3xl font-medium tracking-tight">
                            {greeting(t)}, {firstName}.
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                            {t(
                                'home.learning_desk.prompt',
                                'What would you like to think about next?',
                            )}
                        </p>
                    </div>
                    <button
                        aria-pressed={focusView}
                        className={`${planningChoiceClass(focusView)} inline-flex shrink-0 items-center gap-2`}
                        onClick={() => updateFocusView(!focusView)}
                        type="button"
                    >
                        <Focus aria-hidden="true" className="size-4" />
                        {focusView
                            ? t(
                                  'home.learning_desk.focus.show_rail',
                                  'Show pinned',
                              )
                            : t(
                                  'home.learning_desk.focus.enter',
                                  'Focus view',
                              )}
                    </button>
                </header>

                <OriginalLearningDeskSearch />

                <nav
                    aria-label={t(
                        'home.learning_desk.sections.label',
                        'Learning desk areas',
                    )}
                    className="mt-8 shrink-0 border-y border-[var(--learner-border-color)] py-3"
                >
                    <p className="text-xs font-semibold tracking-[0.18em] text-[var(--learner-muted-text)] uppercase">
                        {t(
                            'home.learning_desk.sections.label',
                            'Learning desk areas',
                        )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {availableAreas.map((area) => (
                            <button
                                aria-controls={`${area}-section`}
                                aria-pressed={visibleArea === area}
                                className={planningChoiceClass(visibleArea === area)}
                                key={area}
                                onClick={() => selectArea(area)}
                                type="button"
                            >
                                {areaLabels[area]}
                            </button>
                        ))}
                    </div>
                </nav>

                {visibleArea === 'connections' ? (
                    <PossibleConnections places={bookmarkConnections} />
                ) : null}

                {visibleArea === 'reflections' && recentCheckIns.length ? (
                    <section
                        aria-labelledby="reflections-heading"
                        className="mt-8"
                        id="reflections-section"
                    >
                        <div className="flex items-center gap-5 pb-3">
                            <h2
                                className="shrink-0 text-xs font-semibold tracking-[0.22em] text-[var(--learner-muted-text)] uppercase focus:outline-none"
                                id="reflections-heading"
                                tabIndex={-1}
                            >
                                Recent reflections
                            </h2>
                        </div>
                        <p className="max-w-2xl border-b border-[var(--learner-border-color)] py-2 text-xs leading-5 text-[var(--learner-muted-text)]">
                            A quiet trail of what you noticed and where you chose to go next. Open an activity whenever the thread feels useful again.
                        </p>
                        <OriginalPaginatedItems
                            className="divide-y divide-[var(--learner-border-color)] border-b border-[var(--learner-border-color)]"
                            items={recentCheckIns}
                            pageSize={1}
                            paginationLabel="Recent reflections"
                            renderItem={(checkIn) => (
                                <RecentReflectionRow
                                    checkIn={checkIn}
                                    key={checkIn.id}
                                    onOpen={openReflection}
                                    opening={
                                        openingReflectionId === checkIn.id
                                    }
                                />
                            )}
                        />
                    </section>
                ) : null}

                {visibleArea === 'continue' ? (
                    <section aria-labelledby="continue-heading" className="mt-8" id="continue-section">
                        <div className="flex items-center gap-5 pb-3">
                            <h2 className="shrink-0 text-xs font-semibold tracking-[0.22em] text-[var(--learner-muted-text)] uppercase focus:outline-none" id="continue-heading" tabIndex={-1}>
                                Continue learning
                            </h2>
                        </div>
                        {currentRoutes.length && (hasTimeGuides || learningPurposeOptions.length) ? (
                            <div className="mt-4 grid gap-4 border-b border-[var(--learner-border-color)] pb-4 md:grid-cols-[minmax(0,1.3fr)_minmax(14rem,0.7fr)]">
                                <p className="text-xs text-[var(--learner-muted-text)] md:col-span-2">
                                    Planning choices are optional and can be remembered for your account.
                                </p>
                                {hasTimeGuides ? (
                                    <fieldset>
                                        <legend className="text-xs font-medium text-[var(--learner-muted-text)]">
                                            Plan by suggested time
                                        </legend>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {([
                                                ['Any time', 'any'],
                                                ['Up to 15 minutes', 15],
                                                ['Up to 30 minutes', 30],
                                            ] as const).map(([label, value]) => (
                                                <button
                                                    aria-pressed={activeTimeBudget === value}
                                                    className={planningChoiceClass(activeTimeBudget === value)}
                                                    key={value}
                                                    onClick={() => updateTimeBudget(value)}
                                                    type="button"
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="mt-2 text-xs leading-5 text-[var(--learner-muted-text)]">
                                            This only narrows routes with an author-provided guide; it is not a deadline.
                                        </p>
                                    </fieldset>
                                ) : null}
                                {learningPurposeOptions.length ? (
                                    <fieldset>
                                        <legend className="text-xs font-medium text-[var(--learner-muted-text)]">
                                            Plan by learning purpose
                                        </legend>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <button
                                                aria-pressed={activePurposeFilter === 'any'}
                                                className={planningChoiceClass(activePurposeFilter === 'any')}
                                                onClick={() => updatePurposeFilter('any')}
                                                type="button"
                                            >
                                                Any purpose
                                            </button>
                                            {learningPurposeOptions.map((purpose) => (
                                                <button
                                                    aria-pressed={activePurposeFilter === purpose}
                                                    className={planningChoiceClass(activePurposeFilter === purpose)}
                                                    key={purpose}
                                                    onClick={() => updatePurposeFilter(purpose)}
                                                    type="button"
                                                >
                                                    {learningPurposeLabel(purpose)}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="mt-2 text-xs leading-5 text-[var(--learner-muted-text)]">
                                            This only narrows routes with an author-provided purpose; it is not a recommendation.
                                        </p>
                                    </fieldset>
                                ) : null}
                                {hasActiveRouteFilter ? (
                                    <button
                                        className="justify-self-start text-sm font-medium text-[var(--learner-action-accent)] hover:text-[var(--learner-heading-text)] md:col-span-2"
                                        onClick={clearPlanningChoices}
                                        type="button"
                                    >
                                        Clear planning choices
                                    </button>
                                ) : null}
                                {activeTimeBudget !== savedPlanningPreference.timeBudget || activePurposeFilter !== savedPlanningPreference.purposeFilter ? (
                                    <button
                                        className="min-h-11 justify-self-start rounded-md border border-[var(--learner-action-accent)] px-3 text-sm font-medium text-[var(--learner-heading-text)] transition hover:bg-[color-mix(in_srgb,var(--learner-action-accent)_14%,transparent)] disabled:opacity-50 md:col-span-2"
                                        disabled={planningPreferenceSaveState === 'saving'}
                                        onClick={() => void savePlanningChoices()}
                                        type="button"
                                    >
                                        {planningPreferenceSaveState === 'saving' ? 'Remembering choices...' : 'Remember these choices'}
                                    </button>
                                ) : null}
                                {planningPreferenceSaveState === 'saved' ? (
                                    <p aria-live="polite" className="text-xs text-[var(--learner-muted-text)] md:col-span-2">
                                        Planning choices remembered for your account.
                                    </p>
                                ) : null}
                                {planningPreferenceSaveState === 'error' ? (
                                    <p aria-live="polite" className="text-xs text-[var(--learner-muted-text)] md:col-span-2">
                                        Could not remember these choices. The current view still works.
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                        {visibleCurrentRoutes.length ? (
                            <div className="mt-4 divide-y divide-[var(--learner-border-color)] border-y border-[var(--learner-border-color)]">
                                {visibleCurrentRoutes.map((route) => <ContinueRouteRow key={route.start.start_id} onContinue={continueRoute} opening={openingItemId === route.start.start_id} route={route} />)}
                            </div>
                        ) : currentRoutes.length ? (
                            <div className="border-b border-[var(--learner-border-color)] py-7">
                                <p className="font-medium">No current routes match these choices yet</p>
                                <p className="mt-1 text-sm leading-6 text-[var(--learner-muted-text)]">
                                    Try another time or purpose, or show every current route again.
                                </p>
                                <button
                                    className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[var(--learner-action-accent)] hover:text-[var(--learner-heading-text)]"
                                    onClick={clearPlanningChoices}
                                    type="button"
                                >
                                    Show all routes
                                </button>
                            </div>
                        ) : (
                            <div className="border-b border-[var(--learner-border-color)] py-7">
                                <p className="font-medium">Nothing is currently in progress</p>
                                <p className="mt-1 text-sm leading-6 text-[var(--learner-muted-text)]">
                                    Start a learning route and it will wait for you here.
                                </p>
                                <Link
                                    className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)] hover:text-[var(--learner-heading-text)]"
                                    to="/topics"
                                >
                                    Browse topics
                                    <ArrowRight className="size-4" />
                                </Link>
                            </div>
                        )}
                    </section>
                ) : null}

                {visibleArea === 'recent' && recentRoutes.length ? (
                    <section aria-labelledby="recent-heading" className="mt-8" id="recent-section">
                        <div className="flex items-center gap-5 pb-3">
                            <h2 className="shrink-0 text-xs font-semibold tracking-[0.22em] text-[var(--learner-muted-text)] uppercase focus:outline-none" id="recent-heading" tabIndex={-1}>
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

                {visibleArea === 'recall' && status === 'ready' && queue?.items.length ? (
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
                {visibleArea === 'support' && supportResponses.length ? (
                    <section
                        aria-labelledby="support-heading"
                        className="mt-8"
                        id="support-section"
                    >
                        <div className="flex items-center gap-5 pb-3">
                            <h2
                                className="shrink-0 text-xs font-semibold tracking-[0.22em] text-[var(--learner-muted-text)] uppercase focus:outline-none"
                                id="support-heading"
                                tabIndex={-1}
                            >
                                Learning Support replies
                            </h2>
                        </div>
                        <p className="max-w-2xl border-b border-[var(--learner-border-color)] py-5 text-sm leading-6 text-[var(--learner-muted-text)]">
                            Private replies to your support requests are kept here so you can return when the guidance is useful.
                        </p>
                        <OriginalPaginatedItems
                            className="divide-y divide-[var(--learner-border-color)] border-b border-[var(--learner-border-color)]"
                            items={supportResponses}
                            pageSize={2}
                            paginationLabel="Learning Support replies"
                            renderItem={(response) => (
                                <SupportResponseRow
                                    key={response.id}
                                    response={response}
                                />
                            )}
                        />
                    </section>
                ) : null}
                {visibleArea === 'revisit' && revisitInvitations.length ? (
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
            {!focusView ? (
                <LearningDeskRail featured={featuredBookmark} places={bookmarkPlaces} />
            ) : null}
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
    const desk = route.start.desk;

    return (
        <article className="group relative grid gap-4 py-6 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:items-center">
            <button
                aria-label={route.start.label}
                className="grid size-12 place-items-center border border-[var(--learner-border-color)] text-[var(--learner-accent)] transition hover:border-[color-mix(in_srgb,var(--learner-accent)_55%,var(--learner-border-color))] disabled:opacity-50"
                disabled={opening}
                onClick={() => void onContinue(route.start)}
                type="button"
            >
                {route.imageUrl ? (
                    <img alt="" className="size-10 object-contain" src={route.imageUrl} />
                ) : (
                    <BookOpenText className="size-5" />
                )}
            </button>
            <div className="min-w-0">
                <button
                    className="block truncate text-left text-sm font-medium hover:text-[var(--learner-accent)] disabled:opacity-50"
                    disabled={opening}
                    onClick={() => void onContinue(route.start)}
                    type="button"
                >
                    {route.start.label}
                </button>
                <span className="mt-1 block text-xs font-medium text-[var(--learner-action-accent)]">
                    {learningPurposeLabel(desk.learning_intent)}
                </span>
                <p className="mt-1 truncate text-sm text-[var(--learner-muted-text)]">
                    <Link className="hover:text-[var(--learner-action-accent)] hover:underline" to={`/world?map=${route.start.map_slug}&focused=${route.start.node_slug}`}>
                        {route.nodeTitle}
                    </Link>{' '}
                    ·{' '}
                    <Link className="hover:text-[var(--learner-action-accent)] hover:underline" to={`/world?map=${route.start.map_slug}`}>
                        {route.mapTitle}
                    </Link>
                </p>
                {desk.topic ? (
                    <Link className="mt-2 inline-block truncate text-xs font-medium text-[var(--learner-accent)] hover:underline" to={desk.topic.href}>
                        {desk.topic.title}
                    </Link>
                ) : null}
                <RouteLearningAreas start={route.start} />
                {desk.current_activity_title ? (
                    <p className="mt-2 truncate text-xs font-medium text-[var(--learner-action-accent)]">
                        Current step: {desk.current_activity_title}
                    </p>
                ) : null}
                {desk.time_guide_minutes ? (
                    <p className="mt-2 text-xs text-[var(--learner-muted-text)]">
                        Suggested time: {desk.time_guide_minutes} minutes
                    </p>
                ) : null}
                <p className="mt-2 text-xs text-[var(--learner-muted-text)]">
                    Why here: this work is still in progress.
                </p>
            </div>
            <span className="flex items-center gap-4 sm:justify-self-end">
                {route.start.progress?.last_entered_at ? (
                    <span className="hidden items-center gap-1.5 text-xs text-[var(--learner-muted-text)] xl:flex">
                        <Clock3 className="size-3.5" />
                        {formatDeskDate(route.start.progress.last_entered_at)}
                    </span>
                ) : null}
                <button className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--learner-accent)] disabled:opacity-50" disabled={opening} onClick={() => void onContinue(route.start)} type="button">
                    {opening ? 'Opening…' : 'Continue'}<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </button>
            </span>
        </article>
    );
}

function RecentReflectionRow({
    checkIn,
    onOpen,
    opening,
}: {
    checkIn: LearnerJournalCheckIn;
    onOpen: (checkIn: LearnerJournalCheckIn) => Promise<void>;
    opening: boolean;
}) {
    const feelingLabel = checkInFeelingLabel(checkIn.feeling);
    const directionLabel = checkIn.next_direction
        ? checkInDirectionLabel(checkIn.next_direction)
        : null;

    return (
        <article className="group grid gap-4 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-start">
            <BookOpenText
                aria-hidden="true"
                className="size-5 text-[var(--learner-action-accent)]"
            />
            <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm font-medium text-[var(--learner-heading-text)]">
                        {feelingLabel}
                    </span>
                    <time
                        className="text-xs text-[var(--learner-muted-text)]"
                        dateTime={checkIn.recorded_at}
                    >
                        {formatDeskDate(checkIn.recorded_at)}
                    </time>
                </div>
                <button
                    className="mt-1 block truncate text-left text-sm text-[var(--learner-action-accent)] hover:text-[var(--learner-heading-text)] hover:underline disabled:opacity-50"
                    disabled={opening}
                    onClick={() => void onOpen(checkIn)}
                    type="button"
                >
                    {checkIn.activity_title} · {checkIn.node_title}
                </button>
                {checkIn.note ? (
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--learner-body-text)]">
                        {checkIn.note}
                    </p>
                ) : null}
                {directionLabel ? (
                    <p className="mt-2 text-xs text-[var(--learner-muted-text)]">
                        Next direction:{' '}
                        <span className="text-[var(--learner-action-accent)]">
                            {directionLabel}
                        </span>
                    </p>
                ) : null}
                {checkIn.next_direction === 'related' && checkIn.topics.length ? (
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="text-[var(--learner-muted-text)]">
                            Explore a connected learning area:
                        </span>
                        {checkIn.topics.map((topic) => (
                            <Link
                                className="underline decoration-[var(--learner-border-color)] underline-offset-2 hover:text-[var(--learner-heading-text)]"
                                key={topic.slug}
                                to={competenceTopicHref(
                                    topic.slug,
                                    checkIn.origin_topic_slug,
                                )}
                            >
                                {topic.name}
                            </Link>
                        ))}
                    </div>
                ) : null}
            </div>
            <button
                aria-busy={opening}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)] disabled:opacity-50 sm:justify-self-end"
                disabled={opening}
                onClick={() => void onOpen(checkIn)}
                type="button"
            >
                {opening ? 'Opening…' : 'Open activity'}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
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
    const desk = route.start.desk;

    return (
        <article className="group grid gap-4 py-5 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:items-center">
            <button aria-label={route.start.label} className="grid size-12 place-items-center border border-[var(--learner-border-color)] text-[var(--learner-action-accent)] hover:border-[color-mix(in_srgb,var(--learner-action-accent)_55%,var(--learner-border-color))] disabled:opacity-50" disabled={opening} onClick={() => void onRevisit(route.start)} type="button">
                {route.imageUrl ? (
                    <img alt="" className="size-10 object-contain" src={route.imageUrl} />
                ) : (
                    <Clock3 className="size-5" />
                )}
            </button>
            <div className="min-w-0">
                <button className="block truncate text-left text-sm font-medium hover:text-[var(--learner-accent)] disabled:opacity-50" disabled={opening} onClick={() => void onRevisit(route.start)} type="button">
                    {route.start.label}
                </button>
                <span className="mt-1 block text-xs font-medium text-[var(--learner-action-accent)]">
                    {learningPurposeLabel(desk.learning_intent)}
                </span>
                <p className="mt-1 truncate text-sm text-[var(--learner-muted-text)]">
                    <Link className="hover:text-[var(--learner-action-accent)] hover:underline" to={`/world?map=${route.start.map_slug}&focused=${route.start.node_slug}`}>
                        {route.nodeTitle}
                    </Link>{' '}
                    ·{' '}
                    <Link className="hover:text-[var(--learner-action-accent)] hover:underline" to={`/world?map=${route.start.map_slug}`}>
                        {route.mapTitle}
                    </Link>
                </p>
                {desk.topic ? (
                    <Link className="mt-2 inline-block truncate text-xs font-medium text-[var(--learner-accent)] hover:underline" to={desk.topic.href}>
                        {desk.topic.title}
                    </Link>
                ) : null}
                <RouteLearningAreas start={route.start} />
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

/** Source-adapted Learning Desk private-reply row. The server determines the
 * map/node destination and never exposes the staff member's identity here. */
function SupportResponseRow({
    response,
}: {
    response: LearnerDeskSupportResponse;
}) {
    return (
        <article className="grid gap-4 py-5 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-start">
            <MessageCircle
                aria-hidden="true"
                className="size-5 text-[var(--learner-action-accent)]"
            />
            <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm font-medium text-[var(--learner-heading-text)]">
                        Private reply from Learning Support
                    </span>
                    <time
                        className="text-xs text-[var(--learner-muted-text)]"
                        dateTime={response.created_at}
                    >
                        {formatDeskDate(response.created_at)}
                    </time>
                </div>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-[var(--learner-body-text)]">
                    {response.body}
                </p>
                <p className="mt-2 text-xs text-[var(--learner-muted-text)]">
                    {response.topic_title} · {response.map_title}
                </p>
            </div>
            <Link
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)] sm:justify-self-end"
                to={`/world?map=${encodeURIComponent(response.map_slug)}&focused=${encodeURIComponent(response.node_slug)}`}
            >
                Return to place
                <ArrowRight className="size-4" />
            </Link>
        </article>
    );
}

function RouteLearningAreas({ start }: { start: LearnerActivityStart }) {
    if (!start.desk.learning_areas.length) {
        return null;
    }

    return (
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--learner-muted-text)]">
            <span>Learning areas:</span>
            {start.desk.learning_areas.map((area) => (
                <Link
                    className="text-[var(--learner-action-accent)] underline decoration-[color-mix(in_srgb,var(--learner-action-accent)_30%,transparent)] underline-offset-2 transition hover:text-[var(--learner-heading-text)]"
                    key={area.slug}
                    to={competenceTopicHref(area.slug, start.desk.topic?.slug ?? null)}
                >
                    {area.name}
                </Link>
            ))}
        </div>
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

function checkInFeelingLabel(value: LearnerJournalCheckIn['feeling']): string {
    if (value === null) {
        return 'A reflection';
    }

    return {
        clearer: 'Something clicked',
        forming: 'Still taking shape',
        stretched: 'It stretched me',
        stuck: 'I got stuck',
    }[value];
}

function checkInDirectionLabel(
    value: NonNullable<LearnerJournalCheckIn['next_direction']>,
): string {
    return (
        {
            revisit: 'Return to this place',
            related: 'Look for something related',
            settle: 'Let it settle',
        }[value] ?? value
    );
}

function competenceTopicHref(
    topicSlug: string,
    originTopicSlug: string | null,
): string {
    const topicQuery = `topic=${encodeURIComponent(topicSlug)}`;

    return originTopicSlug
        ? `/competence?${topicQuery}&from=${encodeURIComponent(originTopicSlug)}`
        : `/competence?${topicQuery}`;
}

function fitsDeskFilters(
    timeGuideMinutes: number | null,
    learningIntent: string,
    timeBudget: DeskTimeBudget,
    purposeFilter: DeskPurposeFilter,
): boolean {
    return (
        (timeBudget === 'any' ||
            (timeGuideMinutes !== null && timeGuideMinutes <= timeBudget)) &&
        (purposeFilter === 'any' || learningIntent === purposeFilter)
    );
}

function planningChoiceClass(selected: boolean): string {
    return [
        'min-h-11 rounded-md border px-3 text-sm transition focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none',
        selected
            ? 'border-[var(--learner-action-accent)] bg-[color-mix(in_srgb,var(--learner-action-accent)_14%,transparent)] text-[var(--learner-heading-text)]'
            : 'border-[var(--learner-border-color)] text-[var(--learner-muted-text)] hover:border-[var(--learner-action-accent)] hover:text-[var(--learner-heading-text)]',
    ].join(' ');
}

function learningPurposeLabel(
    purpose: Exclude<DeskPurposeFilter, 'any'>,
): string {
    return {
        apply: 'Apply',
        explain: 'Explain',
        participate: 'Participate',
        reflect: 'Reflect',
        retrieve: 'Retrieve',
        review: 'Review',
        transfer: 'Transfer',
    }[purpose];
}

function greeting(
    t: ReturnType<typeof usePlatformTranslation>,
): string {
    const hour = new Date().getHours();

    if (hour < 12) {
        return t('home.learning_desk.greeting.morning', 'Good morning');
    }

    if (hour < 18) {
        return t('home.learning_desk.greeting.afternoon', 'Good afternoon');
    }

    return t('home.learning_desk.greeting.evening', 'Good evening');
}

function deskAreaFromUrl(): LearningDeskArea | null {
    const area = new URL(window.location.href).searchParams.get('area');

    return area === 'connections' ||
        area === 'continue' ||
        area === 'recent' ||
        area === 'recall' ||
        area === 'reflections' ||
        area === 'revisit' ||
        area === 'support'
        ? area
        : null;
}

function readFocusViewPreference(key: string): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        return window.localStorage.getItem(key) === 'true';
    } catch {
        return false;
    }
}

function writeFocusViewPreference(key: string, enabled: boolean): void {
    try {
        if (enabled) {
            window.localStorage.setItem(key, 'true');
        } else {
            window.localStorage.removeItem(key);
        }
    } catch {
        // Browser storage may be unavailable; the in-memory toggle still works.
    }
}

function readDeskPlanningPreference(key: string): DeskPlanningSelection {
    const fallback: DeskPlanningSelection = {
        purposeFilter: 'any',
        timeBudget: 'any',
    };

    if (typeof window === 'undefined') {
        return fallback;
    }

    try {
        const value = JSON.parse(window.localStorage.getItem(key) ?? 'null');
        const purposeFilter =
            value?.purposeFilter === 'any' ||
            deskLearningPurposes.includes(value?.purposeFilter)
                ? value.purposeFilter
                : fallback.purposeFilter;
        const timeBudget =
            value?.timeBudget === 'any' ||
            value?.timeBudget === 15 ||
            value?.timeBudget === 30
                ? value.timeBudget
                : fallback.timeBudget;

        return { purposeFilter, timeBudget };
    } catch {
        return fallback;
    }
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
