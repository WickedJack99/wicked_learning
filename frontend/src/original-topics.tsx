import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    BookOpenText,
    FolderTree,
    LoaderCircle,
    Map as MapIcon,
    Route,
    Search,
    Settings2,
    X,
} from 'lucide-react';
import {
    Link,
    Navigate,
    useLocation,
    useNavigate,
    useSearchParams,
} from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { OriginalMarkdownRenderer } from './original-markdown';
import { OriginalLearnerHeader } from './original-learner-header';
import { OriginalPaginationControls } from './original-paginated-items';
import { usePlatformTranslation } from './original-platform-translation';

type TopicDirectory = components['schemas']['LearnerTopicDirectory'];
type TopicHeader = components['schemas']['LearnerTopicDetailHeader'];
export type TopicPath = components['schemas']['LearnerPathSummary'];
type TopicSection = 'trail' | 'routes' | 'maps' | 'overview';
type TopicSectionData =
    | components['schemas']['LearnerTopicTrail']
    | components['schemas']['LearnerPaths']
    | components['schemas']['LearnerTopicMaps']
    | components['schemas']['LearnerTopicOverview'];

export const topicSurfaceStyle = {
    '--learner-action-accent': '#5eead4',
    '--learner-accent': '#5eead4',
    '--learner-border-color': 'rgba(255, 255, 255, 0.1)',
    '--learner-heading-text': '#f8fafc',
    '--learner-body-text': '#e2e8f0',
    '--learner-muted-text': '#cbd5e1',
    '--learner-page-background': '#0b1117',
    '--learner-panel-background': '#111820',
} as React.CSSProperties;

/**
 * Source-adapted from `features/topics/topic-directory.tsx` and
 * `features/topics/topic-detail.tsx`. The server owns topic visibility,
 * pagination, learner history and route start authorization. Source controls
 * that require an unavailable Rust destination are intentionally not rendered
 * rather than replaced with a new interaction. Historical activity replay uses the shared opaque
 * command, so it remains an original learner control without exposing an
 * activity URL from the read model.
 */
export function OriginalTopicsPage({
    isAuthenticationLoading,
    isAuthenticated,
    onSignedOut,
    userEmail,
}: {
    isAuthenticationLoading: boolean;
    isAuthenticated: boolean;
    onSignedOut: () => void;
    userEmail: string;
}) {
    const location = useLocation();
    const topicMatch = location.pathname.match(/^\/topics\/([^/]+)$/);
    const topicSlug = topicMatch ? decodeURIComponent(topicMatch[1]) : null;

    if (isAuthenticationLoading) {
        return <TopicsMessage message="Loading topics…" />;
    }
    if (!isAuthenticated) {
        return <Navigate replace to="/login" />;
    }

    return (
        <div style={topicSurfaceStyle}>
            <OriginalLearnerHeader
                onSignedOut={onSignedOut}
                userEmail={userEmail}
            />
            {topicSlug ? (
                <TopicDetail
                    key={`${topicSlug}:${location.search}`}
                    topicSlug={topicSlug}
                />
            ) : (
                <TopicDirectory />
            )}
        </div>
    );
}

function TopicDirectory() {
    const t = usePlatformTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const area = searchParams.get('area') ?? undefined;
    const page = positiveInteger(searchParams.get('page'));
    const search = searchParams.get('search') ?? undefined;
    const [directory, setDirectory] = useState<TopicDirectory | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
        'loading',
    );
    const [searchTerm, setSearchTerm] = useState(search ?? '');

    useEffect(() => {
        setSearchTerm(search ?? '');
    }, [search]);

    useEffect(() => {
        let current = true;
        setStatus('loading');
        void apiClient
            .GET('/learner/topics', {
                params: {
                    query: {
                        ...(area ? { area } : {}),
                        ...(page ? { page } : {}),
                        ...(search ? { search } : {}),
                    },
                },
            })
            .then(({ data, response }) => {
                if (!current) return;
                if (response.ok && data) {
                    setDirectory(data);
                    setStatus('ready');
                    return;
                }
                setStatus('unavailable');
            })
            .catch(() => current && setStatus('unavailable'));

        return () => {
            current = false;
        };
    }, [area, page, search]);

    function visitTopics(nextArea: string, nextPage = 1, term = searchTerm) {
        const next = new URLSearchParams({ area: nextArea });
        const trimmed = term.trim();
        if (nextPage > 1) next.set('page', String(nextPage));
        if (trimmed) next.set('search', trimmed);
        setSearchParams(next, { replace: true });
    }

    function submitSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (directory?.selected_area) {
            visitTopics(directory.selected_area.slug, 1);
        }
    }

    if (status === 'loading' && !directory) {
        return <TopicsMessage message="Loading topics…" />;
    }
    if (status === 'unavailable' || !directory) {
        return <TopicsMessage message="Topics are temporarily unavailable." />;
    }

    const selectedArea = directory.selected_area;
    return (
        <TopicSurface marker="learner.topics.directory">
            <div className="px-5 py-10 sm:px-8 lg:px-14 lg:py-14">
                <header className="mx-auto flex max-w-7xl items-end justify-between gap-6 border-b border-[var(--learner-border-color)] pb-7">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-accent)] uppercase">
                            {t('topics.eyebrow', 'Knowledge directory')}
                        </p>
                        <h1 className="mt-3 text-3xl font-medium tracking-tight">
                            {t('topics.title', 'Topics')}
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                            {t(
                                'topics.description',
                                'Browse broad areas and open a topic to continue into its subtopics and learning material.',
                            )}
                        </p>
                    </div>
                    {directory.can_manage_topics ? (
                        <Link
                            className="hidden shrink-0 items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--learner-accent)_40%,transparent)] px-4 py-2.5 text-sm font-medium text-[var(--learner-accent)] transition hover:bg-[color-mix(in_srgb,var(--learner-accent)_8%,transparent)] sm:inline-flex"
                            to="/admin/topics"
                        >
                            <Settings2 className="size-4" />
                            {t('topics.manage', 'Manage topics')}
                        </Link>
                    ) : null}
                </header>

                {selectedArea ? (
                    <section
                        className="mx-auto mt-9 max-w-3xl"
                        data-wl-id="topics-directory"
                    >
                        <div className="max-w-xl">
                            <label
                                className="text-sm font-medium text-[var(--learner-body-text)]"
                                htmlFor="topics-area"
                            >
                                {t('topics.area.label', 'Topic area')}
                            </label>
                            <select
                                className="mt-2 h-10 w-full rounded border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] px-3 text-sm text-[var(--learner-body-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)]"
                                data-wl-id="topics-area-selector"
                                id="topics-area"
                                onChange={(event) =>
                                    visitTopics(event.target.value)
                                }
                                value={selectedArea.slug}
                            >
                                {directory.areas.map((candidate) => (
                                    <option
                                        key={candidate.slug}
                                        value={candidate.slug}
                                    >
                                        {candidate.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <form
                            className="mt-5 max-w-xl"
                            data-wl-id="topics-search-form"
                            onSubmit={submitSearch}
                        >
                            <label
                                className="text-sm font-medium text-[var(--learner-body-text)]"
                                htmlFor="topics-search"
                            >
                                {t('topics.search.label', 'Search this area')}
                            </label>
                            <div className="relative mt-2">
                                <Search
                                    aria-hidden="true"
                                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--learner-muted-text)]"
                                />
                                <input
                                    className="h-10 w-full rounded border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] px-10 pr-10 text-sm text-[var(--learner-body-text)] outline-none placeholder:text-[var(--learner-muted-text)] focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)]"
                                    data-wl-id="topics-search-input"
                                    id="topics-search"
                                    onChange={(event) =>
                                        setSearchTerm(event.target.value)
                                    }
                                    placeholder={t(
                                        'topics.search.placeholder',
                                        'Search topic titles or descriptions',
                                    )}
                                    type="search"
                                    value={searchTerm}
                                />
                                {searchTerm ? (
                                    <button
                                        aria-label={t(
                                            'topics.search.clear',
                                            'Clear topic search',
                                        )}
                                        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-[var(--learner-muted-text)] hover:text-[var(--learner-heading-text)] focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)]"
                                        onClick={() => {
                                            setSearchTerm('');
                                            visitTopics(
                                                selectedArea.slug,
                                                1,
                                                '',
                                            );
                                        }}
                                        type="button"
                                    >
                                        <X
                                            aria-hidden="true"
                                            className="size-4"
                                        />
                                    </button>
                                ) : null}
                            </div>
                        </form>
                        <div className="mt-10 border-b border-[var(--learner-border-color)] pb-3">
                            <h2 className="text-sm font-semibold">
                                {selectedArea.title}
                            </h2>
                            {selectedArea.description ? (
                                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--learner-muted-text)]">
                                    {selectedArea.description}
                                </p>
                            ) : null}
                            {directory.search ? (
                                <p className="mt-2 text-sm text-[var(--learner-muted-text)]">
                                    {t(
                                        'topics.search.summary',
                                        'Showing topics matching: :search',
                                        { search: directory.search },
                                    )}
                                </p>
                            ) : null}
                        </div>
                        <div className="divide-y divide-[color-mix(in_srgb,var(--learner-border-color)_70%,transparent)]">
                            {selectedArea.topics.map((topic) => (
                                <Link
                                    className="group flex items-center justify-between gap-4 py-4 pl-0.5 text-sm text-[var(--learner-body-text)] transition hover:text-[var(--learner-accent)]"
                                    key={topic.slug}
                                    to={topic.href}
                                >
                                    <span>
                                        <span>{topic.title}</span>
                                        {topic.map_count ? (
                                            <span className="mt-1 block text-xs text-[var(--learner-action-accent)]">
                                                {topic.map_count === 1
                                                    ? t(
                                                          'topics.directory.map_count.one',
                                                          '1 map available',
                                                      )
                                                    : t(
                                                          'topics.directory.map_count.many',
                                                          ':count maps available',
                                                          {
                                                              count: topic.map_count,
                                                          },
                                                      )}
                                            </span>
                                        ) : null}
                                    </span>
                                    <ArrowRight className="size-4 shrink-0 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
                                </Link>
                            ))}
                        </div>
                        <TopicPagination
                            label={`${selectedArea.title} ${t('topics.title', 'Topics')}`}
                            pagination={directory.pagination}
                            onPageChange={(nextPage) =>
                                visitTopics(selectedArea.slug, nextPage)
                            }
                        />
                    </section>
                ) : (
                    <div className="mx-auto grid min-h-[50svh] max-w-lg place-items-center text-center">
                        <div>
                            <FolderTree className="mx-auto size-8 text-[var(--learner-action-accent)]" />
                            <h2 className="mt-5 text-sm font-semibold">
                                {t(
                                    'topics.empty.title',
                                    'No topics have been published yet',
                                )}
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-[var(--learner-muted-text)]">
                                {t(
                                    'topics.empty.description',
                                    'Topic areas will appear here as soon as an administrator adds their first published topic.',
                                )}
                            </p>
                            {directory.can_manage_topics ? (
                                <Link
                                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-accent)]"
                                    to="/admin/topics"
                                >
                                    {t(
                                        'topics.empty.action',
                                        'Create the first topic area',
                                    )}
                                    <ArrowRight className="size-4" />
                                </Link>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </TopicSurface>
    );
}

function TopicDetail({ topicSlug }: { topicSlug: string }) {
    const t = usePlatformTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [section, setSection] = useState<TopicSection>(() =>
        topicSection(searchParams.get('section')),
    );
    const [data, setData] = useState<TopicSectionData | null>(null);
    const [status, setStatus] = useState<
        'loading' | 'ready' | 'unavailable' | 'not-found'
    >('loading');
    const [startingId, setStartingId] = useState<string | null>(null);
    const [startError, setStartError] = useState<string | null>(null);
    const [openingActivitySlug, setOpeningActivitySlug] = useState<
        string | null
    >(null);

    const routesPage = positiveInteger(searchParams.get('page'));
    const purpose = learningIntent(searchParams.get('purpose'));
    const time = timeBudget(searchParams.get('time'));
    const mapsPage = positiveInteger(searchParams.get('maps_page'));
    const subtopicsPage = positiveInteger(searchParams.get('subtopics_page'));

    useEffect(() => {
        const updateFromBrowserHistory = () => {
            setSection(
                topicSection(
                    new URLSearchParams(window.location.search).get('section'),
                ),
            );
        };

        window.addEventListener('popstate', updateFromBrowserHistory);
        return () =>
            window.removeEventListener('popstate', updateFromBrowserHistory);
    }, []);

    useEffect(() => {
        let current = true;
        setStatus('loading');
        async function load(): Promise<void> {
            try {
                const result =
                    section === 'trail'
                        ? await apiClient.GET(
                              '/learner/topics/{topic_slug}/trail',
                              { params: { path: { topic_slug: topicSlug } } },
                          )
                        : section === 'routes'
                          ? await apiClient.GET('/learner/paths', {
                                params: {
                                    query: {
                                        topic: topicSlug,
                                        ...(routesPage
                                            ? { page: routesPage }
                                            : {}),
                                        ...(purpose ? { purpose } : {}),
                                        ...(time ? { time } : {}),
                                    },
                                },
                            })
                          : section === 'maps'
                            ? await apiClient.GET(
                                  '/learner/topics/{topic_slug}/maps',
                                  {
                                      params: {
                                          path: { topic_slug: topicSlug },
                                          query: mapsPage
                                              ? { maps_page: mapsPage }
                                              : {},
                                      },
                                  },
                              )
                            : await apiClient.GET(
                                  '/learner/topics/{topic_slug}/overview',
                                  {
                                      params: {
                                          path: { topic_slug: topicSlug },
                                          query: subtopicsPage
                                              ? {
                                                    subtopics_page:
                                                        subtopicsPage,
                                                }
                                              : {},
                                      },
                                  },
                              );
                if (!current) return;
                if (result.response.ok && result.data) {
                    setData(result.data as TopicSectionData);
                    setStatus('ready');
                    return;
                }
                setStatus(
                    result.response.status === 404
                        ? 'not-found'
                        : 'unavailable',
                );
            } catch {
                if (current) setStatus('unavailable');
            }
        }
        void load();
        return () => {
            current = false;
        };
    }, [
        topicSlug,
        section,
        routesPage,
        purpose,
        time,
        mapsPage,
        subtopicsPage,
    ]);

    function update(next: URLSearchParams, replace = false) {
        setSearchParams(next, { replace });
    }
    function selectSection(nextSection: TopicSection) {
        setSection(nextSection);
        const next = new URLSearchParams(searchParams);
        if (nextSection === 'trail') next.delete('section');
        else next.set('section', nextSection);
        if (nextSection !== 'routes') {
            next.delete('page');
            next.delete('purpose');
            next.delete('time');
        }
        if (nextSection !== 'maps') next.delete('maps_page');
        if (nextSection !== 'overview') next.delete('subtopics_page');
        update(next);
    }
    function setRouteFilters(
        nextPage: number,
        nextPurpose: typeof purpose,
        nextTime: typeof time,
    ) {
        const next = new URLSearchParams(searchParams);
        next.set('section', 'routes');
        if (nextPage > 1) next.set('page', String(nextPage));
        else next.delete('page');
        if (nextPurpose) next.set('purpose', nextPurpose);
        else next.delete('purpose');
        if (nextTime) next.set('time', String(nextTime));
        else next.delete('time');
        update(next, true);
    }
    async function startPath(path: TopicPath) {
        if (startingId) return;
        setStartingId(path.start_id);
        setStartError(null);
        try {
            const token = await getCsrfToken();
            const { data: result, response } = await apiClient.POST(
                '/learner/activity-starts/{start_id}/start',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { start_id: path.start_id },
                    },
                },
            );
            if (!response.ok || !result) throw new Error('start unavailable');
            navigate(
                `/learning/nodes/${encodeURIComponent(path.node_slug)}/play?run=${encodeURIComponent(result.play_run_id)}`,
            );
        } catch {
            setStartError('This route could not be opened. Please try again.');
        } finally {
            setStartingId(null);
        }
    }

    async function openHistoricalActivity(activitySlug: string): Promise<void> {
        if (openingActivitySlug !== null) return;
        setOpeningActivitySlug(activitySlug);
        try {
            const token = await getCsrfToken();
            const { data: result, response } = await apiClient.POST(
                '/learner/activities/{activity_slug}/replay',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { activity_slug: activitySlug },
                    },
                },
            );
            if (response.ok && result) {
                navigate(
                    `/learning/nodes/${encodeURIComponent(result.node_slug)}/play?run=${encodeURIComponent(result.play_run_id)}`,
                );
            }
        } catch {
            // Keep the lifted source activity control available for a retry.
        } finally {
            setOpeningActivitySlug(null);
        }
    }

    if (status === 'loading' && !data)
        return <TopicsMessage message="Loading this section…" />;
    if (status === 'not-found')
        return <TopicsMessage message="This topic is not available." />;
    if (status === 'unavailable' || !data)
        return (
            <TopicsMessage message="This topic is temporarily unavailable." />
        );

    const header = topicHeader(data, section);
    if (!header) {
        return <TopicsMessage message="This topic is not available." />;
    }
    const sections: { id: TopicSection; label: string }[] = [
        {
            id: 'trail',
            label: t('topics.detail.navigation.trail', 'Trail'),
        },
        {
            id: 'routes',
            label: t('topics.detail.navigation.routes', 'Routes'),
        },
        { id: 'maps', label: t('topics.detail.navigation.maps', 'Maps') },
        {
            id: 'overview',
            label: t('topics.detail.navigation.overview', 'Overview'),
        },
    ];
    return (
        <TopicSurface marker="learner.topic.detail">
            <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
                <Link
                    className="inline-flex items-center gap-2 text-sm text-[var(--learner-muted-text)] transition hover:text-[var(--learner-accent)]"
                    to={header.parent?.href ?? '/topics'}
                >
                    <ArrowLeft className="size-4" />
                    {header.parent?.title ?? t('topics.title', 'Topics')}
                </Link>
                <header className="mt-6 shrink-0 border-b border-[var(--learner-border-color)] pb-6">
                    <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-accent)] uppercase">
                        {header.area_title}
                    </p>
                    <h1 className="mt-3 text-3xl font-medium tracking-tight">
                        {header.title}
                    </h1>
                    {header.description ? (
                        <p className="mt-5 text-sm leading-6 text-[var(--learner-body-text)]">
                            {header.description}
                        </p>
                    ) : null}
                </header>
                <nav
                    aria-label={t(
                        'topics.detail.navigation.label',
                        'Topic sections',
                    )}
                    className="mt-5 flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--learner-border-color)] pb-px"
                    data-wl-id="learner.topic.sections"
                    role="tablist"
                >
                    {sections.map((candidate, index) => (
                        <button
                            aria-controls={`topic-panel-${candidate.id}`}
                            aria-selected={section === candidate.id}
                            className="shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-[var(--learner-muted-text)] transition hover:text-[var(--learner-heading-text)] aria-selected:border-[var(--learner-accent)] aria-selected:text-[var(--learner-heading-text)]"
                            id={`topic-${candidate.id}-tab`}
                            key={candidate.id}
                            onClick={() => selectSection(candidate.id)}
                            onKeyDown={(event) =>
                                handleTopicTabKey(
                                    event,
                                    index,
                                    sections,
                                    selectSection,
                                )
                            }
                            role="tab"
                            tabIndex={section === candidate.id ? 0 : -1}
                            type="button"
                        >
                            {candidate.label}
                        </button>
                    ))}
                </nav>
                <div className="pt-5">
                    {status === 'loading' ? <SectionLoading /> : null}
                    {status === 'ready' && section === 'trail' ? (
                        <TrailPanel
                            data={
                                data as components['schemas']['LearnerTopicTrail']
                            }
                            onOpenActivity={openHistoricalActivity}
                            openingActivitySlug={openingActivitySlug}
                        />
                    ) : null}
                    {status === 'ready' && section === 'routes' ? (
                        <RoutesPanel
                            data={data as components['schemas']['LearnerPaths']}
                            onChange={setRouteFilters}
                            onStart={startPath}
                            startError={startError}
                            startingId={startingId}
                        />
                    ) : null}
                    {status === 'ready' && section === 'maps' ? (
                        <MapsPanel
                            data={
                                data as components['schemas']['LearnerTopicMaps']
                            }
                            onPageChange={(nextPage) => {
                                const next = new URLSearchParams(searchParams);
                                next.set('section', 'maps');
                                if (nextPage > 1)
                                    next.set('maps_page', String(nextPage));
                                else next.delete('maps_page');
                                update(next, true);
                            }}
                        />
                    ) : null}
                    {status === 'ready' && section === 'overview' ? (
                        <OverviewPanel
                            data={
                                data as components['schemas']['LearnerTopicOverview']
                            }
                            onPageChange={(nextPage) => {
                                const next = new URLSearchParams(searchParams);
                                next.set('section', 'overview');
                                if (nextPage > 1)
                                    next.set(
                                        'subtopics_page',
                                        String(nextPage),
                                    );
                                else next.delete('subtopics_page');
                                update(next, true);
                            }}
                        />
                    ) : null}
                </div>
            </div>
        </TopicSurface>
    );
}

function TrailPanel({
    data,
    onOpenActivity,
    openingActivitySlug,
}: {
    data: components['schemas']['LearnerTopicTrail'];
    onOpenActivity: (activitySlug: string) => Promise<void>;
    openingActivitySlug: string | null;
}) {
    const t = usePlatformTranslation();
    const competence = data.competence;
    const connected = data.subtopic_competence.filter(
        (entry) =>
            !data.learning_areas.some((area) => area.slug === entry.slug),
    );
    const focusedCompetenceSlug = competence?.slug ?? connected[0]?.slug;
    return (
        <section
            aria-labelledby="topic-trail-tab"
            id="topic-panel-trail"
            role="tabpanel"
        >
            <section
                aria-labelledby="topic-learning-trail-heading"
                className="mt-8 border-b border-[var(--learner-border-color)] py-7"
            >
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-action-accent)] uppercase">
                            {t(
                                'topics.detail.competence.eyebrow',
                                'Learning trail',
                            )}
                        </p>
                        <h2
                            className="mt-2 text-sm font-semibold"
                            id="topic-learning-trail-heading"
                        >
                            {t(
                                'topics.detail.competence.title',
                                'Your trail in this topic',
                            )}
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                            {competence
                                ? competence.visual.description
                                : connected.length
                                  ? t(
                                        'topics.detail.competence.subtopic_summary',
                                        'Learning is unfolding across connected areas.',
                                    )
                                  : t(
                                        'topics.detail.competence.empty',
                                        'A first light will appear here as you work with this topic.',
                                    )}
                        </p>
                    </div>
                    <Link
                        className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)] transition hover:text-[var(--learner-heading-text)]"
                        to={
                            focusedCompetenceSlug
                                ? competenceTopicHref(
                                      focusedCompetenceSlug,
                                      data.topic.slug,
                                  )
                                : `/competence?from=${encodeURIComponent(data.topic.slug)}`
                        }
                    >
                        {focusedCompetenceSlug
                            ? t(
                                  'topics.detail.competence.open',
                                  'Open focused map',
                              )
                            : t(
                                  'topics.detail.competence.open_all',
                                  'Open competence map',
                              )}
                        <ArrowRight className="size-4" />
                    </Link>
                </div>
                {connected.length ? (
                    <div className="mt-6 border-t border-[var(--learner-border-color)] pt-5">
                        <p className="text-xs font-semibold tracking-[0.16em] text-[var(--learner-muted-text)] uppercase">
                            {t(
                                'topics.detail.competence.connected_areas',
                                'Connected learning areas',
                            )}
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {connected.map((area) => (
                                <CompetenceCard
                                    area={area}
                                    key={area.slug}
                                    topicSlug={data.topic.slug}
                                />
                            ))}
                        </div>
                    </div>
                ) : null}
                {competence ? (
                    <CompetenceDetail
                        competence={competence}
                        onOpenActivity={onOpenActivity}
                        openingActivitySlug={openingActivitySlug}
                    />
                ) : null}
            </section>
            {data.learning_areas.length ? (
                <section
                    aria-labelledby="topic-learning-areas-heading"
                    className="mt-8 border-b border-[var(--learner-border-color)] py-7"
                >
                    <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-action-accent)] uppercase">
                        {t(
                            'topics.detail.learning_areas.eyebrow',
                            'Learning areas',
                        )}
                    </p>
                    <h2
                        className="mt-2 text-sm font-semibold"
                        id="topic-learning-areas-heading"
                    >
                        {t(
                            'topics.detail.learning_areas.title',
                            'What you can practice here',
                        )}
                    </h2>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {data.learning_areas.map((area) => (
                            <div
                                className="flex items-start gap-4 border border-[var(--learner-border-color)] bg-[color-mix(in_srgb,var(--learner-panel-background)_55%,transparent)] p-4"
                                key={area.slug}
                            >
                                <span>
                                    <span className="block font-medium">
                                        {area.name}
                                    </span>
                                    <span className="mt-2 block text-xs leading-5 text-[var(--learner-muted-text)]">
                                        {area.learning_intents
                                            .map((intent) =>
                                                platformIntentLabel(intent, t),
                                            )
                                            .join(' · ')}
                                    </span>
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null}
            {data.learning_pulse.length ? (
                <section
                    aria-labelledby="topic-learning-pulse-heading"
                    className="mt-8 border-b border-[var(--learner-border-color)] py-7"
                >
                    <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-accent)] uppercase">
                        {t(
                            'topics.detail.learning_pulse.eyebrow',
                            'Recent reflections',
                        )}
                    </p>
                    <h2
                        className="mt-2 text-sm font-semibold"
                        id="topic-learning-pulse-heading"
                    >
                        {t(
                            'topics.detail.learning_pulse.title',
                            'Moments you chose to keep',
                        )}
                    </h2>
                    <div className="mt-4 divide-y divide-[var(--learner-border-color)]">
                        {data.learning_pulse.map((entry) => (
                            <button
                                className="flex w-full items-start justify-between gap-4 py-3 text-left transition hover:text-[var(--learner-accent)] disabled:opacity-50"
                                disabled={openingActivitySlug !== null}
                                key={`${entry.activity_title}:${entry.recorded_at}`}
                                onClick={() =>
                                    void onOpenActivity(entry.activity_slug)
                                }
                                type="button"
                            >
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium">
                                        {entry.activity_title}
                                    </span>
                                    <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                                        {pulseLabel(entry.feeling)} ·{' '}
                                        {entry.node_title}
                                    </span>
                                    {entry.note ? (
                                        <span className="mt-1 block text-xs leading-5 text-[var(--learner-body-text)]">
                                            {entry.note}
                                        </span>
                                    ) : null}
                                </span>
                                <time
                                    className="shrink-0 text-xs text-[var(--learner-muted-text)]"
                                    dateTime={entry.recorded_at}
                                >
                                    {formatDate(entry.recorded_at)}
                                </time>
                            </button>
                        ))}
                    </div>
                </section>
            ) : null}
            {data.reflection_narrative ? (
                <ReflectionNarrative narrative={data.reflection_narrative} />
            ) : null}
        </section>
    );
}

function CompetenceCard({
    area,
    topicSlug,
}: {
    area: components['schemas']['LearnerTopicTrailCompetence'];
    topicSlug: string;
}) {
    const t = usePlatformTranslation();
    return (
        <Link
            className="group flex items-start gap-3 border border-[var(--learner-border-color)] bg-[color-mix(in_srgb,var(--learner-panel-background)_45%,transparent)] p-3 transition hover:border-[color-mix(in_srgb,var(--learner-action-accent)_60%,var(--learner-border-color))] hover:bg-[color-mix(in_srgb,var(--learner-action-accent)_8%,var(--learner-panel-background))]"
            to={competenceTopicHref(area.slug, topicSlug)}
        >
            <span
                aria-hidden="true"
                className="mt-1 shrink-0 rounded-full bg-[color-mix(in_srgb,var(--learner-action-accent)_20%,transparent)]"
                style={{
                    boxShadow: `0 0 ${8 + Math.round(area.visual.aura_ratio * 10)}px ${4 + Math.round(area.visual.aura_ratio * 5)}px rgba(103, 232, 249, ${0.2 + area.visual.brightness_ratio * 0.45})`,
                    height: 16 + Math.round(area.visual.size_ratio * 8),
                    width: 16 + Math.round(area.visual.size_ratio * 8),
                }}
            />
            <span className="min-w-0">
                <span className="block text-sm font-medium">{area.name}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--learner-muted-text)]">
                    {area.visual.description}
                </span>
                {area.visual.evidence_types.length ? (
                    <span className="mt-2 block text-xs text-[var(--learner-action-accent)]">
                        {area.visual.evidence_types
                            .map((type) => platformIntentLabel(type, t))
                            .join(' · ')}
                    </span>
                ) : null}
            </span>
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-[var(--learner-action-accent)] transition-transform group-hover:translate-x-1" />
        </Link>
    );
}

function CompetenceDetail({
    competence,
    onOpenActivity,
    openingActivitySlug,
}: {
    competence: components['schemas']['LearnerTopicTrailCompetence'];
    onOpenActivity: (activitySlug: string) => Promise<void>;
    openingActivitySlug: string | null;
}) {
    const t = usePlatformTranslation();
    return (
        <>
            <div className="mt-6 grid gap-5 border-t border-[var(--learner-border-color)] pt-5 sm:grid-cols-2">
                <div>
                    <p className="text-xs font-semibold tracking-[0.16em] text-[var(--learner-muted-text)] uppercase">
                        {t(
                            'topics.detail.competence.ways',
                            'Ways you have been learning',
                        )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {competence.visual.evidence_types.map((type) => (
                            <span
                                className="border border-[color-mix(in_srgb,var(--learner-action-accent)_20%,transparent)] px-2.5 py-1 text-xs text-[var(--learner-action-accent)]"
                                key={type}
                            >
                                {platformIntentLabel(type, t)}
                            </span>
                        ))}
                    </div>
                </div>
                <div>
                    <p className="text-xs font-semibold tracking-[0.16em] text-[var(--learner-muted-text)] uppercase">
                        {t('topics.detail.competence.recent', 'Recently')}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--learner-body-text)]">
                        {competence.visual.recent_description}
                    </p>
                    {competence.visual.learning_periods.length ? (
                        <p className="mt-2 text-xs text-[var(--learner-muted-text)]">
                            {competence.visual.learning_periods.join(' · ')}
                        </p>
                    ) : null}
                </div>
            </div>
            {competence.visual.evidence_ledger.length ? (
                <div className="mt-6 border-t border-[var(--learner-border-color)] pt-5">
                    <p className="text-xs font-semibold tracking-[0.16em] text-[var(--learner-muted-text)] uppercase">
                        {t(
                            'topics.detail.competence.moments',
                            'Recent moments',
                        )}
                    </p>
                    <div className="mt-3 divide-y divide-[var(--learner-border-color)]">
                        {competence.visual.evidence_ledger.map((entry) => (
                            <div key={entry.id}>
                                <button
                                    className="flex w-full items-start justify-between gap-4 py-3 text-left transition hover:text-[var(--learner-accent)] disabled:opacity-50"
                                    disabled={openingActivitySlug !== null}
                                    onClick={() =>
                                        void onOpenActivity(entry.activity_slug)
                                    }
                                    type="button"
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium">
                                            {entry.activity_title ||
                                                'Learning moment'}
                                        </span>
                                        <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                                            {platformIntentLabel(
                                                entry.evidence_type,
                                                t,
                                            )}
                                            {entry.node_title
                                                ? ` · ${entry.node_title}`
                                                : ''}
                                        </span>
                                        {entry.objective ? (
                                            <span className="mt-1 block text-xs text-[var(--learner-action-accent)]/80">
                                                Objective: {entry.objective}
                                            </span>
                                        ) : null}
                                        {entry.concepts.length ? (
                                            <span className="mt-1 block text-xs text-[var(--learner-action-accent)]/80">
                                                Concepts:{' '}
                                                {entry.concepts.join(' · ')}
                                            </span>
                                        ) : null}
                                        {entry.learning_purpose ? (
                                            <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                                                Purpose: {entry.learning_purpose}
                                            </span>
                                        ) : null}
                                        {entry.evidence_criterion ? (
                                            <span className="mt-1 block text-xs text-[var(--learner-action-accent)]/80">
                                                What to notice:{' '}
                                                {entry.evidence_criterion}
                                            </span>
                                        ) : null}
                                        {entry.evidence_rubric.length ? (
                                            <span className="mt-1 block text-xs text-[var(--learner-action-accent)]/80">
                                                Cues:{' '}
                                                {entry.evidence_rubric.join(' · ')}
                                            </span>
                                        ) : null}
                                        {entry.observed_cues.length ? (
                                            <span className="mt-1 block text-xs text-[var(--learner-action-accent)]/80">
                                                {t(
                                                    'learning.reflection.observed_cues_label',
                                                    'Noticed: ',
                                                )}
                                                {entry.observed_cues.join(' · ')}
                                            </span>
                                        ) : null}
                                        <span className="mt-1 block text-xs text-[var(--learner-action-accent)]">
                                            {evidenceClaim(entry.evidence_claim)}
                                        </span>
                                        {entry.independent_check ? (
                                            <span className="mt-1 block text-xs text-[var(--learner-action-accent)]/80">
                                                {t(
                                                    'learning.reflection.independent_check_short',
                                                    'Independent check',
                                                )}
                                            </span>
                                        ) : null}
                                        {entry.outcome ? (
                                            <span className="mt-1 block text-xs text-[var(--learner-action-accent)]/80">
                                                <span className="block">
                                                    {t(
                                                        'learning.review.outcome_signal',
                                                        'Review signal',
                                                    )}
                                                    :{' '}
                                                    {reviewOutcomeLabel(
                                                        entry.outcome,
                                                        t,
                                                    )}
                                                </span>
                                                {reviewOutcomeDescription(
                                                    entry.outcome,
                                                    t,
                                                ) ? (
                                                    <span className="mt-1 block text-[var(--learner-muted-text)]">
                                                        {reviewOutcomeDescription(
                                                            entry.outcome,
                                                            t,
                                                        )}
                                                    </span>
                                                ) : null}
                                            </span>
                                        ) : null}
                                        {entry.confidence ? (
                                            <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                                                {entry.evidence_type ===
                                                    'explain' ||
                                                entry.evidence_type ===
                                                    'transfer'
                                                    ? t(
                                                          'learning.calibration.before_response',
                                                          'Before responding:',
                                                      )
                                                    : t(
                                                          'learning.calibration.before_answer',
                                                          'Before answering:',
                                                      )}{' '}
                                                {confidenceLabel(entry.confidence)}
                                                {entry.attempt_number > 1
                                                    ? ` · attempt ${entry.attempt_number}`
                                                    : ''}
                                            </span>
                                        ) : null}
                                        {entry.confidence_after_feedback ? (
                                            <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                                                {t(
                                                    'learning.calibration.after_guidance',
                                                    'After guidance:',
                                                )}{' '}
                                                {confidenceLabel(
                                                    entry.confidence_after_feedback,
                                                )}
                                            </span>
                                        ) : null}
                                        {entry.assistance_level ? (
                                            <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                                                {assistanceLevelLabel(
                                                    entry.assistance_level,
                                                    t,
                                                )}
                                            </span>
                                        ) : null}
                                    </span>
                                    <time
                                        className="shrink-0 text-xs text-[var(--learner-muted-text)]"
                                        dateTime={entry.recorded_at}
                                    >
                                        {formatDate(entry.recorded_at)}
                                    </time>
                                </button>
                                {entry.sources.length ? (
                                    <div className="border-t border-[var(--learner-border-color)] px-0 pt-2 pb-2 text-xs text-[var(--learner-muted-text)]">
                                        <span className="mr-1">
                                            {t(
                                                'competence.evidence.sources',
                                                'Sources',
                                            )}
                                            :
                                        </span>
                                        {entry.sources.map((source, index) => (
                                            <span key={`${source.url}-${index}`}>
                                                {index ? ', ' : null}
                                                <a
                                                    className="text-[var(--learner-action-accent)] underline decoration-[var(--learner-action-accent)]/30 underline-offset-2 transition hover:text-[var(--learner-heading-text)]"
                                                    href={source.url}
                                                    rel="noreferrer"
                                                    target="_blank"
                                                >
                                                    {source.title}
                                                </a>
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
            {competence.revisit ? (
                <button
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-accent)] transition hover:text-[var(--learner-heading-text)] disabled:opacity-50"
                    disabled={openingActivitySlug !== null}
                    onClick={() =>
                        void onOpenActivity(competence.revisit!.activity_slug)
                    }
                    type="button"
                >
                    {t('topics.detail.competence.revisit', 'Return to')}{' '}
                    {competence.revisit.activity_title}
                    <ArrowRight className="size-4" />
                </button>
            ) : null}
        </>
    );
}

function ReflectionNarrative({
    narrative,
}: {
    narrative: components['schemas']['LearnerTopicReflectionNarrative'];
}) {
    const t = usePlatformTranslation();
    const middle = narrative.entries.filter(
        (entry) =>
            entry.id !== narrative.earlier.id &&
            entry.id !== narrative.later.id,
    );
    return (
        <section
            aria-labelledby="topic-reflection-comparison-heading"
            className="mt-8 border-b border-[var(--learner-border-color)] py-7"
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-accent)] uppercase">
                        {t(
                            'topics.detail.reflection_comparison.eyebrow',
                            'Your reflections over time',
                        )}
                    </p>
                    <h2
                        className="mt-2 text-sm font-semibold"
                        id="topic-reflection-comparison-heading"
                    >
                        {t(
                            'topics.detail.reflection_comparison.title',
                            'Earlier and later',
                        )}
                    </h2>
                </div>
                <Link
                    className="shrink-0 text-sm font-medium text-[var(--learner-action-accent)] transition hover:text-[var(--learner-heading-text)]"
                    to="/journal"
                >
                    {t(
                        'topics.detail.reflection_comparison.open_journal',
                        'Open journal',
                    )}
                </Link>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <ReflectionSnapshot
                    label={t(
                        'topics.detail.reflection_comparison.earlier',
                        'Earlier',
                    )}
                    snapshot={narrative.earlier}
                />
                <ReflectionSnapshot
                    label={t(
                        'topics.detail.reflection_comparison.later',
                        'Later',
                    )}
                    snapshot={narrative.later}
                />
            </div>
            {middle.length ? (
                <div className="mt-6 border-t border-[var(--learner-border-color)] pt-5">
                    <p className="text-xs font-semibold tracking-[0.16em] text-[var(--learner-muted-text)] uppercase">
                        {t(
                            'topics.detail.reflection_comparison.trail',
                            'Reflections along the way',
                        )}
                    </p>
                    <div className="mt-3 divide-y divide-[var(--learner-border-color)]">
                        {middle.map((entry) => (
                            <article className="py-3" key={entry.id}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        {entry.activity_title ? (
                                            <p className="truncate text-sm font-medium text-[var(--learner-body-text)]">
                                                {entry.activity_title}
                                            </p>
                                        ) : null}
                                        <p className="mt-1 line-clamp-3 text-xs leading-5 text-[var(--learner-muted-text)]">
                                            {entry.reflection}
                                        </p>
                                    </div>
                                    <time
                                        className="shrink-0 text-xs text-[var(--learner-muted-text)]"
                                        dateTime={entry.created_at}
                                    >
                                        {formatDate(entry.created_at)}
                                    </time>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            ) : null}
        </section>
    );
}

function competenceTopicHref(topicSlug: string, fromTopicSlug: string): string {
    return `/competence?topic=${encodeURIComponent(topicSlug)}&from=${encodeURIComponent(fromTopicSlug)}`;
}

function ReflectionSnapshot({
    label,
    snapshot,
}: {
    label: string;
    snapshot: components['schemas']['LearnerTopicReflectionSnapshot'];
}) {
    return (
        <article className="border border-[var(--learner-border-color)] bg-[color-mix(in_srgb,var(--learner-panel-background)_55%,transparent)] p-4">
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold tracking-[0.16em] text-[var(--learner-action-accent)] uppercase">
                    {label}
                </p>
                <time
                    className="shrink-0 text-xs text-[var(--learner-muted-text)]"
                    dateTime={snapshot.created_at}
                >
                    {formatDate(snapshot.created_at)}
                </time>
            </div>
            {snapshot.activity_title ? (
                <p className="mt-3 text-xs text-[var(--learner-muted-text)]">
                    {snapshot.activity_title}
                </p>
            ) : null}
            <p className="mt-3 text-xs leading-5 text-[var(--learner-muted-text)] italic">
                {snapshot.question}
            </p>
            <p className="mt-2 line-clamp-6 text-sm leading-6 text-[var(--learner-body-text)]">
                {snapshot.reflection}
            </p>
        </article>
    );
}

function RoutesPanel({
    data,
    onChange,
    onStart,
    startError,
    startingId,
}: {
    data: components['schemas']['LearnerPaths'];
    onChange: (
        page: number,
        purpose: components['schemas']['LearnerPaths']['selected_purpose'],
        time: components['schemas']['LearnerPaths']['selected_time_budget'],
    ) => void;
    onStart: (path: TopicPath) => void;
    startError: string | null;
    startingId: string | null;
}) {
    const t = usePlatformTranslation();
    return (
        <section
            aria-labelledby="topic-routes-tab"
            id="topic-panel-routes"
            role="tabpanel"
        >
            <section
                aria-labelledby="topic-paths-heading"
                className="mt-10 border-b border-[var(--learner-border-color)] py-7"
            >
                <div className="flex items-start gap-3">
                    <Route className="mt-0.5 size-5 shrink-0 text-[var(--learner-accent)]" />
                    <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-accent)] uppercase">
                            {t(
                                'topics.detail.paths.eyebrow',
                                'Optional ways in',
                            )}
                        </p>
                        <h2
                            className="mt-2 text-sm font-semibold"
                            id="topic-paths-heading"
                        >
                            {t(
                                'topics.detail.paths.title',
                                'Start with a route',
                            )}
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                            {t(
                                'topics.detail.paths.description',
                                'A route is a suggested beginning. You can follow it, pause, or explore the map in your own direction.',
                            )}
                        </p>
                    </div>
                </div>
                <div className="mt-5 grid gap-3 sm:max-w-xl sm:grid-cols-2">
                    <div>
                        <label
                            className="text-xs font-medium text-[var(--learner-muted-text)]"
                            htmlFor="topic-paths-purpose"
                        >
                            {t(
                                'topics.detail.paths.filters.purpose.label',
                                'Learning purpose',
                            )}
                        </label>
                        <select
                            className="mt-1 h-9 w-full rounded border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] px-2 text-sm text-[var(--learner-body-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)]"
                            id="topic-paths-purpose"
                            onChange={(event) =>
                                onChange(
                                    1,
                                    learningIntent(event.target.value),
                                    data.selected_time_budget,
                                )
                            }
                            value={data.selected_purpose ?? ''}
                        >
                            <option value="">
                                {t(
                                    'topics.detail.paths.filters.purpose.any',
                                    'Any purpose',
                                )}
                            </option>
                            {learningIntents.map((intent) => (
                                <option key={intent} value={intent}>
                                    {platformIntentLabel(intent, t)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label
                            className="text-xs font-medium text-[var(--learner-muted-text)]"
                            htmlFor="topic-paths-time"
                        >
                            {t(
                                'topics.detail.paths.filters.time.label',
                                'Available time',
                            )}
                        </label>
                        <select
                            className="mt-1 h-9 w-full rounded border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] px-2 text-sm text-[var(--learner-body-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)]"
                            id="topic-paths-time"
                            onChange={(event) =>
                                onChange(
                                    1,
                                    data.selected_purpose,
                                    timeBudget(event.target.value),
                                )
                            }
                            value={data.selected_time_budget ?? ''}
                        >
                            <option value="">
                                {t(
                                    'topics.detail.paths.filters.time.any',
                                    'Any time',
                                )}
                            </option>
                            <option value="15">
                                {t(
                                    'topics.detail.paths.filters.time.short',
                                    'Up to 15 minutes',
                                )}
                            </option>
                            <option value="30">
                                {t(
                                    'topics.detail.paths.filters.time.medium',
                                    'Up to 30 minutes',
                                )}
                            </option>
                        </select>
                    </div>
                </div>
                <p className="mt-3 text-xs text-[var(--learner-muted-text)]">
                    {t(
                        'topics.detail.paths.filters.description',
                        'Narrow these starting points by purpose or the time you have available.',
                    )}
                </p>
                {startError ? (
                    <p className="mt-3 text-sm text-red-300" role="alert">
                        {startError}
                    </p>
                ) : null}
                {data.paths.length ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {data.paths.map((path) => (
                            <TopicPathCard
                                key={path.start_id}
                                path={path}
                                onStart={onStart}
                                starting={startingId === path.start_id}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="mt-8 text-sm leading-6 text-[var(--learner-muted-text)]">
                        {data.selected_purpose || data.selected_time_budget ? (
                            <>
                                <p>
                                    {t(
                                        'topics.detail.paths.filtered_empty',
                                        'No routes match these filters yet.',
                                    )}
                                </p>
                                <button
                                    className="mt-3 block text-sm font-medium text-[var(--learner-action-accent)] underline underline-offset-2"
                                    onClick={() => onChange(1, null, null)}
                                    type="button"
                                >
                                    {t(
                                        'topics.detail.paths.filtered_empty.clear',
                                        'Show all routes',
                                    )}
                                </button>
                            </>
                        ) : (
                            t(
                                'topics.detail.paths.empty',
                                'No routes are available yet.',
                            )
                        )}
                    </div>
                )}
                <TopicPagination
                    label={t('topics.detail.paths.pagination', 'Topic routes')}
                    pagination={data.pagination}
                    onPageChange={(nextPage) =>
                        onChange(
                            nextPage,
                            data.selected_purpose,
                            data.selected_time_budget,
                        )
                    }
                />
            </section>
        </section>
    );
}

export function TopicPathCard({
    path,
    onStart,
    starting,
}: {
    path: TopicPath;
    onStart: (path: TopicPath) => void;
    starting: boolean;
}) {
    const t = usePlatformTranslation();
    const inProgress = path.progress?.status === 'in_progress';
    return (
        <article className="group flex items-start gap-3 border border-[var(--learner-border-color)] bg-[color-mix(in_srgb,var(--learner-panel-background)_55%,transparent)] p-4 transition hover:border-[color-mix(in_srgb,var(--learner-accent)_60%,var(--learner-border-color))] hover:bg-[color-mix(in_srgb,var(--learner-accent)_8%,var(--learner-panel-background))]">
            <span className="grid size-10 shrink-0 place-items-center border border-[color-mix(in_srgb,var(--learner-accent)_25%,transparent)] text-[var(--learner-accent)]">
                {path.image_url ? (
                    <img
                        alt=""
                        className="size-8 object-contain"
                        src={path.image_url}
                    />
                ) : (
                    <Route className="size-4" />
                )}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-medium">{path.label}</span>
                <span className="mt-1 block text-xs font-medium text-[var(--learner-action-accent)]">
                    {platformIntentLabel(path.learning_intent, t)}
                </span>
                {path.time_guide_minutes ? (
                    <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                        {t(
                            'learning.activity.time_guide',
                            'Suggested time: :minutes minutes',
                            { minutes: path.time_guide_minutes },
                        )}
                    </span>
                ) : null}
                {path.route_description ? (
                    <span className="mt-2 line-clamp-2 block text-sm leading-5 text-[var(--learner-body-text)]">
                        {path.route_description}
                    </span>
                ) : null}
                <span className="mt-1 block truncate text-xs text-[var(--learner-muted-text)]">
                    <Link
                        className="underline decoration-[color-mix(in_srgb,var(--learner-muted-text)_60%,transparent)] underline-offset-2 transition hover:text-[var(--learner-action-accent)]"
                        to={path.node_href}
                    >
                        {path.node_title}
                    </Link>{' '}
                    ·{' '}
                    <Link
                        className="underline decoration-[color-mix(in_srgb,var(--learner-muted-text)_60%,transparent)] underline-offset-2 transition hover:text-[var(--learner-action-accent)]"
                        to={path.map_href}
                    >
                        {path.map_title}
                    </Link>
                </span>
                <button
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-[var(--learner-accent)] uppercase disabled:opacity-60"
                    disabled={starting}
                    onClick={() => onStart(path)}
                    type="button"
                >
                    {starting
                        ? 'Opening…'
                        : inProgress
                          ? t('topics.detail.paths.continue', 'Continue')
                          : t('paths.action.enter', 'Enter route')}
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </button>
            </span>
        </article>
    );
}

function MapsPanel({
    data,
    onPageChange,
}: {
    data: components['schemas']['LearnerTopicMaps'];
    onPageChange: (page: number) => void;
}) {
    const t = usePlatformTranslation();
    return (
        <section
            aria-labelledby="topic-maps-tab"
            id="topic-panel-maps"
            role="tabpanel"
        >
            {data.maps.length ? (
                <section
                    aria-labelledby="topic-maps-heading"
                    className="mt-10 border-b border-[var(--learner-border-color)] py-7"
                >
                    <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-action-accent)] uppercase">
                        {t('topics.detail.maps.eyebrow', 'Explore this topic')}
                    </p>
                    <h2
                        className="mt-2 text-sm font-semibold"
                        id="topic-maps-heading"
                    >
                        {t('topics.detail.maps.title', 'Map surfaces')}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                        {t(
                            'topics.detail.maps.description',
                            'Open a map to explore this topic through places, activities and connected paths.',
                        )}
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {data.maps.map((map) => (
                            <Link
                                className="group flex items-start gap-3 border border-[var(--learner-border-color)] bg-[color-mix(in_srgb,var(--learner-panel-background)_55%,transparent)] p-4 transition hover:border-[color-mix(in_srgb,var(--learner-action-accent)_60%,var(--learner-border-color))] hover:bg-[color-mix(in_srgb,var(--learner-action-accent)_8%,var(--learner-panel-background))]"
                                key={map.slug}
                                to={map.href}
                            >
                                <MapIcon className="mt-0.5 size-5 shrink-0 text-[var(--learner-action-accent)]" />
                                <span className="min-w-0 flex-1">
                                    <span className="block font-medium">
                                        {map.title}
                                    </span>
                                    {map.description ? (
                                        <span className="mt-1 line-clamp-2 block text-sm leading-5 text-[var(--learner-muted-text)]">
                                            {map.description}
                                        </span>
                                    ) : null}
                                    <span className="mt-2 block text-xs text-[var(--learner-muted-text)]">
                                        {map.node_count === 1
                                            ? t(
                                                  'topics.detail.maps.place_count.one',
                                                  '1 place to explore',
                                              )
                                            : t(
                                                  'topics.detail.maps.place_count.many',
                                                  ':count places to explore',
                                                  { count: map.node_count },
                                              )}
                                    </span>
                                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-[var(--learner-action-accent)] uppercase">
                                        {t(
                                            'topics.detail.maps.open',
                                            'Open map',
                                        )}
                                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                                    </span>
                                </span>
                            </Link>
                        ))}
                    </div>
                    <TopicPagination
                        label={t('topics.detail.maps.pagination', 'Topic maps')}
                        pagination={data.maps_pagination}
                        onPageChange={onPageChange}
                    />
                </section>
            ) : (
                <p className="mt-8 border-b border-[var(--learner-border-color)] py-7 text-sm leading-6 text-[var(--learner-muted-text)]">
                    {t(
                        'topics.detail.maps.empty',
                        'No maps are available yet.',
                    )}
                </p>
            )}
        </section>
    );
}

function OverviewPanel({
    data,
    onPageChange,
}: {
    data: components['schemas']['LearnerTopicOverview'];
    onPageChange: (page: number) => void;
}) {
    const t = usePlatformTranslation();
    return (
        <section
            aria-labelledby="topic-overview-tab"
            id="topic-panel-overview"
            role="tabpanel"
        >
            <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <article className="min-w-0">
                    {data.topic.content ? (
                        <OriginalMarkdownRenderer
                            inheritColor
                            markdown={data.topic.content}
                        />
                    ) : (
                        <div className="border-b border-[var(--learner-border-color)] py-7">
                            <BookOpenText className="size-5 text-[var(--learner-action-accent)]" />
                            <p className="mt-3 text-sm leading-6 text-[var(--learner-muted-text)]">
                                {t(
                                    'topics.detail.no_content',
                                    'This topic currently serves as an overview. Continue with one of its subtopics.',
                                )}
                            </p>
                        </div>
                    )}
                </article>
                <aside>
                    <h2 className="border-b border-[var(--learner-border-color)] pb-3 text-xs font-semibold tracking-[0.18em] text-[var(--learner-muted-text)] uppercase">
                        {t('topics.detail.subtopics', 'Subtopics')}
                    </h2>
                    {data.subtopics.length ? (
                        <>
                            <div className="divide-y divide-[var(--learner-border-color)]">
                                {data.subtopics.map((topic) => (
                                    <Link
                                        className="group flex items-start justify-between gap-4 py-4 text-sm"
                                        key={topic.slug}
                                        to={topic.href}
                                    >
                                        <span>
                                            <span className="font-medium group-hover:text-[var(--learner-accent)]">
                                                {topic.title}
                                            </span>
                                            {topic.map_count ? (
                                                <span className="mt-1 block text-xs text-[var(--learner-action-accent)]">
                                                    {topic.map_count === 1
                                                        ? t(
                                                              'topics.detail.subtopics.map_count.one',
                                                              '1 map available',
                                                          )
                                                        : t(
                                                              'topics.detail.subtopics.map_count.many',
                                                              ':count maps available',
                                                              {
                                                                  count: topic.map_count,
                                                              },
                                                          )}
                                                </span>
                                            ) : null}
                                            {topic.description ? (
                                                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--learner-muted-text)]">
                                                    {topic.description}
                                                </span>
                                            ) : null}
                                        </span>
                                        <ArrowRight className="mt-0.5 size-4 shrink-0 text-[var(--learner-action-accent)]" />
                                    </Link>
                                ))}
                            </div>
                            <TopicPagination
                                label={t(
                                    'topics.detail.subtopics.pagination',
                                    'Topic subtopics',
                                )}
                                pagination={data.subtopics_pagination}
                                onPageChange={onPageChange}
                            />
                        </>
                    ) : (
                        <p className="py-4 text-sm leading-6 text-[var(--learner-muted-text)]">
                            {t(
                                'topics.detail.no_subtopics',
                                'No subtopics have been published here yet.',
                            )}
                        </p>
                    )}
                </aside>
            </div>
        </section>
    );
}

export function TopicPagination({
    label,
    pagination,
    onPageChange,
}: {
    label: string;
    pagination:
        | components['schemas']['LearnerTopicPagination']
        | components['schemas']['LearnerPathPagination'];
    onPageChange: (page: number) => void;
}) {
    const t = usePlatformTranslation();
    return (
        <OriginalPaginationControls
            buttonClassName="inline-flex items-center gap-1 text-sm text-[var(--learner-action-accent)] transition hover:text-[var(--learner-heading-text)] disabled:pointer-events-none disabled:opacity-40"
            className="mt-5 flex items-center justify-between border-t border-[var(--learner-border-color)] pt-3"
            currentPageLabel={t(
                'common.pagination.current_page',
                'Current page',
            )}
            currentPage={pagination.current_page}
            focusOutlineClassName="focus-visible:outline-[var(--learner-action-accent)]"
            focusRingClassName="focus-visible:ring-[var(--learner-action-accent)]"
            label={label}
            nextLabel={t('common.pagination.next', 'Next items')}
            nextText={t('common.pagination.next_short', 'Next')}
            onPageChange={onPageChange}
            ofText={t('common.pagination.of', 'of')}
            pageCount={pagination.last_page}
            pageText={t('common.pagination.page_label', 'Page')}
            previousLabel={t('common.pagination.previous', 'Previous items')}
            previousText={t('common.pagination.previous_short', 'Previous')}
            textClassName="text-xs text-[var(--learner-muted-text)]"
        />
    );
}

export function TopicSurface({
    children,
    marker,
}: {
    children: React.ReactNode;
    marker: string;
}) {
    return (
        <main
            className="min-h-svh bg-[var(--learner-page-background)] text-[var(--learner-heading-text)]"
            data-wl-id={marker}
            id="learner-main-content"
            style={topicSurfaceStyle}
            tabIndex={-1}
        >
            {children}
        </main>
    );
}
function TopicsMessage({ message }: { message: string }) {
    return (
        <TopicSurface marker="learner.topics.status">
            <section className="grid min-h-svh place-items-center p-6 text-center">
                <div>
                    <LoaderCircle className="mx-auto size-5 animate-spin text-[var(--learner-action-accent)]" />
                    <p
                        className="mt-3 text-sm text-[var(--learner-muted-text)]"
                        role="alert"
                    >
                        {message}
                    </p>
                </div>
            </section>
        </TopicSurface>
    );
}
function SectionLoading() {
    const t = usePlatformTranslation();
    return (
        <section
            className="grid min-h-64 place-items-center border-b border-[var(--learner-border-color)] py-10 text-center"
            data-wl-id="learner.topic.sections.loading"
        >
            <div>
                <LoaderCircle className="mx-auto size-5 animate-spin text-[var(--learner-action-accent)]" />
                <p className="mt-3 text-sm text-[var(--learner-muted-text)]">
                    {t(
                        'topics.detail.navigation.loading',
                        'Loading this section…',
                    )}
                </p>
            </div>
        </section>
    );
}

function topicHeader(
    data: TopicSectionData,
    section: TopicSection,
): TopicHeader | null {
    return section === 'routes'
        ? (data as components['schemas']['LearnerPaths']).topic_context
        : (
              data as Exclude<
                  TopicSectionData,
                  components['schemas']['LearnerPaths']
              >
          ).topic;
}
function topicSection(value: string | null): TopicSection {
    return value === 'routes' || value === 'maps' || value === 'overview'
        ? value
        : 'trail';
}
function positiveInteger(value: string | null): number | undefined {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
const learningIntents = [
    'apply',
    'explain',
    'participate',
    'reflect',
    'retrieve',
    'review',
    'transfer',
] as const;
function learningIntent(
    value: string | null,
): (typeof learningIntents)[number] | null {
    return learningIntents.includes(value as (typeof learningIntents)[number])
        ? (value as (typeof learningIntents)[number])
        : null;
}
function timeBudget(value: string | null): 15 | 30 | null {
    return value === '15' ? 15 : value === '30' ? 30 : null;
}
function platformIntentLabel(
    value: string,
    t: (key: string, fallback?: string) => string,
): string {
    const copy: Record<string, [string, string]> = {
        apply: ['activities.focus.apply', 'Apply an idea'],
        explain: [
            'activities.focus.explain',
            'Explain an idea in your own words',
        ],
        participate: ['activities.focus.participate', 'Participate'],
        reflect: ['activities.focus.reflect', 'Reflect'],
        retrieve: ['activities.focus.retrieve', 'Retrieve an idea'],
        review: ['activities.focus.review', 'Review / revisit'],
        transfer: ['activities.focus.transfer', 'Try an idea in a new context'],
    };
    const translated = copy[value];

    return translated ? t(...translated) : value;
}
function pulseLabel(value: string | null): string {
    return (
        {
            clearer: 'Something clicked',
            forming: 'Still taking shape',
            stretched: 'It stretched me',
            stuck: 'I got stuck',
        }[value ?? ''] ?? 'A reflection'
    );
}
function evidenceClaim(value: string): string {
    return (
        {
            application_attempt: 'An application attempt was recorded.',
            explanation_attempt: 'An explanation attempt was recorded.',
            independent_explanation_attempt:
                'A fresh independent explanation attempt was recorded.',
            independent_recall: 'Successful independent recall recorded.',
            independent_transfer_attempt:
                'A fresh independent transfer attempt was recorded.',
            learning_encounter: 'A learning encounter was recorded.',
            participation: 'Participation was recorded.',
            reflection: 'A reflection was recorded.',
            retrieval_attempt: 'A recall attempt was recorded.',
            review: 'A review was recorded.',
            transfer_attempt: 'A transfer attempt was recorded.',
        }[value] ?? 'A learning encounter was recorded.'
    );
}
function confidenceLabel(value: string): string {
    return (
        {
            exploring: 'exploring',
            leaning: 'I have a hunch',
            settled: 'settled',
        }[value] ?? value
    );
}
function assistanceLevelLabel(
    level: string,
    t: (key: string, fallback?: string) => string,
): string {
    return t(
        `learning.evidence.assistance_${level}`,
        {
            independent: 'Support context: independent',
            supported: 'Support context: supported',
            'ai-off': 'Support context: AI off',
            hints: 'Support context: hints used',
            'post-attempt': 'Support context: post-attempt help',
        }[level] ?? `Support context: ${level}`,
    );
}
function reviewOutcomeLabel(
    outcome: string,
    t: (key: string, fallback?: string) => string,
): string {
    const copy: Record<string, [string, string]> = {
        clearer: ['learning.review.outcome_clearer', 'Clearer now'],
        connected: ['learning.review.outcome_connected', 'More connected'],
        open: ['learning.review.outcome_open', 'Still open'],
        correct: ['learning.review.outcome_correct', 'Useful clue found'],
        incorrect: [
            'learning.review.outcome_incorrect',
            'Adjust the hypothesis',
        ],
    };
    const [key, fallback] = copy[outcome] ?? [
        'learning.review.outcome_unknown',
        'Review completed',
    ];

    return t(key, fallback);
}
function reviewOutcomeDescription(
    outcome: string,
    t: (key: string, fallback?: string) => string,
): string | null {
    const copy: Record<string, [string, string]> = {
        clearer: [
            'learning.review.outcome_clearer_description',
            'The idea feels easier to explain or use now.',
        ],
        connected: [
            'learning.review.outcome_connected_description',
            'A relationship or context is more visible now.',
        ],
        open: [
            'learning.review.outcome_open_description',
            'The idea may need more time, another example, or a different route.',
        ],
        correct: [
            'learning.review.outcome_correct_description',
            'The answer matched the configured response.',
        ],
        incorrect: [
            'learning.review.outcome_incorrect_description',
            'The answer gives you a reason to adjust the hypothesis.',
        ],
    };
    const result = copy[outcome];

    return result ? t(...result) : null;
}
function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
          });
}
function handleTopicTabKey(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    sections: { id: TopicSection; label: string }[],
    selectSection: (section: TopicSection) => void,
) {
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
        next = (index + 1) % sections.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
        next = (index - 1 + sections.length) % sections.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = sections.length - 1;
    if (next === null) return;
    event.preventDefault();
    const selection = sections[next];
    selectSection(selection.id);
    window.setTimeout(
        () => document.getElementById(`topic-${selection.id}-tab`)?.focus(),
        0,
    );
}
