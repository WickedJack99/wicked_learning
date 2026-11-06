import { useEffect, useState } from 'react';
import { ArrowRight, Compass, LoaderCircle, Route } from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import {
    TopicPagination,
    TopicPathCard,
    TopicSurface,
    topicSurfaceStyle,
    type TopicPath,
} from './original-topics';
import { OriginalLearnerHeader } from './original-learner-header';

const learningIntents = [
    'apply',
    'explain',
    'participate',
    'reflect',
    'retrieve',
    'review',
    'transfer',
] as const;

/**
 * Source-adapted from `pages/paths.tsx`. The server owns visibility,
 * filtering, pagination and opaque route-run creation. It uses the existing
 * lifted route card rather than inventing a second route-start interaction.
 */
export function OriginalPathsPage({
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
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const page = positiveInteger(searchParams.get('page'));
    const purpose = learningIntent(searchParams.get('purpose'));
    const time = timeBudget(searchParams.get('time'));
    const [paths, setPaths] = useState<components['schemas']['LearnerPaths'] | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
    const [startingId, setStartingId] = useState<string | null>(null);
    const [startError, setStartError] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }
        let current = true;
        setStatus('loading');
        void apiClient
            .GET('/learner/paths', {
                params: {
                    query: {
                        ...(page ? { page } : {}),
                        ...(purpose ? { purpose } : {}),
                        ...(time ? { time } : {}),
                    },
                },
            })
            .then(({ data, response }) => {
                if (!current) return;
                if (response.ok && data) {
                    setPaths(data);
                    setStatus('ready');
                    return;
                }
                setStatus('unavailable');
            })
            .catch(() => current && setStatus('unavailable'));

        return () => {
            current = false;
        };
    }, [isAuthenticated, page, purpose, time]);

    if (isAuthenticationLoading) return <PathsMessage message="Loading paths…" />;
    if (!isAuthenticated) return <Navigate replace to="/login" />;
    if (status === 'loading' && !paths) return <PathsMessage message="Loading paths…" />;
    if (status === 'unavailable' || !paths) {
        return <PathsMessage message="Paths are temporarily unavailable." />;
    }

    const hasActiveFilter = paths.selected_purpose !== null || paths.selected_time_budget !== null;

    function visit(nextPage: number, nextPurpose: typeof purpose, nextTime: typeof time) {
        const next = new URLSearchParams();
        if (nextPage > 1) next.set('page', String(nextPage));
        if (nextPurpose) next.set('purpose', nextPurpose);
        if (nextTime) next.set('time', String(nextTime));
        setSearchParams(next, { replace: true });
    }

    async function startPath(path: TopicPath) {
        if (startingId) return;
        setStartingId(path.start_id);
        setStartError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/activity-starts/{start_id}/start',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { start_id: path.start_id },
                    },
                },
            );
            if (!response.ok || !data) throw new Error('start unavailable');
            navigate(`/learning/nodes/${encodeURIComponent(path.node_slug)}/play?run=${encodeURIComponent(data.play_run_id)}`);
        } catch {
            setStartError('This route could not be opened. Please try again.');
        } finally {
            setStartingId(null);
        }
    }

    return (
        <div style={topicSurfaceStyle}>
            <OriginalLearnerHeader
                onSignedOut={onSignedOut}
                userEmail={userEmail}
            />
            <TopicSurface marker="learner.paths">
                <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
                <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-accent)] uppercase">Ways into the world</p>
                <h1 className="mt-3 text-3xl font-medium tracking-tight">Paths</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                    Choose a prepared route into a place on the learning map. The route is a starting point; what you notice and where you go next can remain open.
                </p>
                {paths.paths.length > 0 || hasActiveFilter ? (
                    <section className="mt-12" aria-labelledby="paths-heading">
                        <div className="flex flex-col gap-4 border-b border-[var(--learner-border-color)] pb-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex items-center gap-4">
                                <Route className="size-5 text-[var(--learner-action-accent)]" />
                                <h2 className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-muted-text)] uppercase" id="paths-heading">Available routes</h2>
                            </div>
                            <div className="grid w-full gap-3 sm:w-[32rem] sm:max-w-full sm:grid-cols-2">
                                <div>
                                    <label className="text-xs font-medium text-[var(--learner-muted-text)]" htmlFor="paths-purpose">Learning purpose</label>
                                    <select className="mt-1 h-9 w-full rounded border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] px-2 text-sm text-[var(--learner-body-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)]" id="paths-purpose" onChange={(event) => visit(1, learningIntent(event.target.value), paths.selected_time_budget)} value={paths.selected_purpose ?? ''}>
                                        <option value="">Any purpose</option>
                                        {learningIntents.map((intent) => <option key={intent} value={intent}>{intentLabel(intent)}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-[var(--learner-muted-text)]" htmlFor="paths-time">Available time</label>
                                    <select className="mt-1 h-9 w-full rounded border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] px-2 text-sm text-[var(--learner-body-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)]" id="paths-time" onChange={(event) => visit(1, paths.selected_purpose, timeBudget(event.target.value))} value={paths.selected_time_budget ?? ''}>
                                        <option value="">Any time</option>
                                        <option value="15">Up to 15 minutes</option>
                                        <option value="30">Up to 30 minutes</option>
                                    </select>
                                </div>
                                <p className="text-xs text-[var(--learner-muted-text)] sm:col-span-2">Narrow the starting points by purpose or the time you have available.</p>
                            </div>
                        </div>
                        {startError ? <p className="mt-3 text-sm text-red-300" role="alert">{startError}</p> : null}
                        {paths.paths.length ? (
                            <>
                                <div className="mt-6 grid min-h-[89rem] gap-4 md:min-h-[44rem] md:grid-cols-2">
                                    {paths.paths.map((path) => <TopicPathCard key={path.start_id} path={path} onStart={startPath} starting={startingId === path.start_id} />)}
                                </div>
                                <TopicPagination label="Learning paths" pagination={paths.pagination} onPageChange={(nextPage) => visit(nextPage, paths.selected_purpose, paths.selected_time_budget)} />
                            </>
                        ) : (
                            <div className="border-b border-[var(--learner-border-color)] py-10">
                                <Compass className="size-7 text-[var(--learner-action-accent)]" />
                                <h3 className="mt-5 text-sm font-semibold">No routes match these filters yet</h3>
                                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--learner-muted-text)]">Try another purpose or time range, or return to all available routes.</p>
                                <button className="mt-5 text-sm font-medium text-[var(--learner-action-accent)] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--learner-action-accent)]" onClick={() => visit(1, null, null)} type="button">Show all routes</button>
                            </div>
                        )}
                    </section>
                ) : (
                    <section className="mt-12 border-y border-[var(--learner-border-color)] py-10">
                        <Compass className="size-7 text-[var(--learner-action-accent)]" />
                        <h2 className="mt-5 text-sm font-semibold">No routes are available yet</h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--learner-muted-text)]">You can enter through a topic or open a map directly when a route is added.</p>
                        <div className="mt-5 flex flex-wrap gap-4 text-sm font-medium">
                            <Link className="inline-flex items-center gap-2 text-[var(--learner-accent)]" to="/topics">Browse topics<ArrowRight className="size-4" /></Link>
                            <Link className="inline-flex items-center gap-2 text-[var(--learner-action-accent)]" to="/world">Open the map<ArrowRight className="size-4" /></Link>
                        </div>
                    </section>
                )}
                </div>
            </TopicSurface>
        </div>
    );
}

function PathsMessage({ message }: { message: string }) {
    return <TopicSurface marker="learner.paths.status"><section className="grid min-h-svh place-items-center p-6 text-center"><div><LoaderCircle className="mx-auto size-5 animate-spin text-[var(--learner-action-accent)]" /><p className="mt-3 text-sm text-[var(--learner-muted-text)]" role="alert">{message}</p></div></section></TopicSurface>;
}

function positiveInteger(value: string | null): number | undefined {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function learningIntent(value: string | null): (typeof learningIntents)[number] | null {
    return learningIntents.includes(value as (typeof learningIntents)[number])
        ? (value as (typeof learningIntents)[number])
        : null;
}

function timeBudget(value: string | null): 15 | 30 | null {
    return value === '15' ? 15 : value === '30' ? 30 : null;
}

function intentLabel(value: string): string {
    return ({ apply: 'Apply', explain: 'Explain', participate: 'Participate', reflect: 'Reflect', retrieve: 'Retrieve', review: 'Review', transfer: 'Transfer' }[value] ?? value);
}
