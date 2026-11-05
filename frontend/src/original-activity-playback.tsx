import { ArrowRight, PlayCircle, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';

type LearnerActivityStart = components['schemas']['LearnerActivityStart'];
type LearnerPlaybackDocument = components['schemas']['LearnerPlaybackDocument'];

const ROUTE_PAGE_SIZE = 3;

/**
 * Source-adapted from `features/world/activity-panel.tsx`. The server supplies
 * the authored start presentation and owns all start/reset authorization.
 */
export function OriginalRouteStartButtons({
    starts,
    onReset,
    onStart,
}: {
    starts: LearnerActivityStart[];
    onReset: (start: LearnerActivityStart) => void;
    onStart: (start: LearnerActivityStart) => void;
}) {
    const [page, setPage] = useState(1);
    const pageCount = Math.max(1, Math.ceil(starts.length / ROUTE_PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const visibleStarts = starts.slice(
        (currentPage - 1) * ROUTE_PAGE_SIZE,
        currentPage * ROUTE_PAGE_SIZE,
    );

    if (starts.length === 0) {
        return null;
    }

    return (
        <div
            className="relative mt-auto flex shrink-0 flex-col pb-12 md:pb-14"
            data-wl-id="learner.world.route-starts"
        >
            <div className="grid gap-2 px-1 pt-2 pb-1">
                {visibleStarts.map((start) => (
                    <RouteStartOption
                        key={start.start_id}
                        onReset={() => onReset(start)}
                        onStart={() => onStart(start)}
                        start={start}
                    />
                ))}
            </div>
            {pageCount > 1 ? (
                <nav
                    aria-label="Activity routes"
                    className="mt-2 flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400"
                >
                    <button
                        className="rounded-md px-2 py-1 font-medium hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-white/10"
                        disabled={currentPage === 1}
                        onClick={() => setPage((value) => Math.max(1, value - 1))}
                        type="button"
                    >
                        Previous
                    </button>
                    <span>{`${currentPage} / ${pageCount}`}</span>
                    <button
                        className="rounded-md px-2 py-1 font-medium hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-white/10"
                        disabled={currentPage === pageCount}
                        onClick={() =>
                            setPage((value) => Math.min(pageCount, value + 1))
                        }
                        type="button"
                    >
                        Next
                    </button>
                </nav>
            ) : null}
        </div>
    );
}

function RouteStartOption({
    onReset,
    onStart,
    start,
}: {
    onReset: () => void;
    onStart: () => void;
    start: LearnerActivityStart;
}) {
    const routeBorderColor =
        start.button_border_color_dark ?? 'rgba(255, 255, 255, 0.1)';
    const buttonStyle = {
        ...(start.button_color_dark
            ? { backgroundColor: start.button_color_dark }
            : {}),
        backgroundClip: 'padding-box',
        boxShadow: `inset 0 0 0 2px ${routeBorderColor}`,
    };
    const frameStyle = { boxShadow: `inset 0 0 0 2px ${routeBorderColor}` };
    const progressText = routeProgressText(start);

    if (start.image_dark) {
        return (
            <div className="grid gap-1.5">
                <button
                    className="group relative overflow-hidden rounded-lg bg-slate-950 text-left transition duration-200 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:focus-visible:ring-teal-200"
                    onClick={onStart}
                    type="button"
                >
                    <img
                        alt=""
                        className="h-32 w-full object-cover"
                        decoding="async"
                        loading="lazy"
                        src={start.image_dark}
                    />
                    <span
                        className="absolute inset-x-0 top-0 z-[1] flex min-h-10 items-center justify-between gap-3 rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold text-slate-950 backdrop-blur-md dark:bg-slate-950/82 dark:text-white"
                        style={buttonStyle}
                    >
                        <span className="inline-flex min-w-0 items-center gap-2">
                            <PlayCircle className="size-4 shrink-0 text-cyan-700 dark:text-teal-200" />
                            <span className="truncate">{start.label}</span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-cyan-700 transition group-hover:translate-x-0.5 dark:text-teal-200" />
                    </span>
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-[2] rounded-lg"
                        style={frameStyle}
                    />
                </button>
                <RouteProgressActions
                    onReset={onReset}
                    progressText={progressText}
                    start={start}
                />
                {start.description ? (
                    <p className="px-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {start.description}
                    </p>
                ) : null}
            </div>
        );
    }

    return (
        <div className="grid gap-1.5">
            <button
                className="flex h-10 items-center justify-between gap-2 rounded-md border border-transparent bg-white/90 px-4 py-2 text-sm font-medium text-slate-950 shadow-none transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900 dark:hover:text-white dark:focus-visible:ring-teal-200"
                onClick={onStart}
                style={buttonStyle}
                type="button"
            >
                <span className="inline-flex min-w-0 items-center gap-2">
                    <PlayCircle className="size-4 shrink-0 text-cyan-700 dark:text-teal-200" />
                    <span className="truncate">{start.label}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-cyan-700 dark:text-teal-200" />
            </button>
            <RouteProgressActions
                onReset={onReset}
                progressText={progressText}
                start={start}
            />
            {start.description ? (
                <p className="px-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {start.description}
                </p>
            ) : null}
        </div>
    );
}

function RouteProgressActions({
    onReset,
    progressText,
    start,
}: {
    onReset: () => void;
    progressText: string | null;
    start: LearnerActivityStart;
}) {
    if (!progressText && !start.progress) {
        return null;
    }

    return (
        <div className="flex items-center justify-between gap-2 px-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="min-w-0 truncate">{progressText}</span>
            <button
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-semibold text-cyan-700 transition hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:text-teal-200 dark:hover:bg-teal-200/10 dark:focus-visible:ring-teal-200"
                onClick={onReset}
                type="button"
            >
                <RotateCcw className="size-3" />
                Reset
            </button>
        </div>
    );
}

function routeProgressText(start: LearnerActivityStart): string | null {
    const progress = start.progress;
    if (!progress) {
        return null;
    }
    if (progress.completion_count > 0) {
        const date = progress.last_completed_at
            ? ` · ${new Date(progress.last_completed_at).toLocaleDateString()}`
            : '';
        return `Completed ${progress.completion_count}×${date}`;
    }
    return progress.status === 'in_progress' ? 'In progress' : null;
}

/**
 * The open-practice content and activity-frame hierarchy are lifted from the
 * existing `ActivityPlayer` and `OpenPracticeActivity`. The query parameter is
 * never used as API authority: Rust authorizes the play run on every request.
 */
export function OriginalOpenPracticePage({
    nodeSlug,
    playRunId,
}: {
    nodeSlug: string;
    playRunId: string | null;
}) {
    const navigate = useNavigate();
    const [state, setState] = useState<
        | { kind: 'loading' }
        | { kind: 'loaded'; document: LearnerPlaybackDocument }
        | { kind: 'unavailable' }
    >({ kind: 'loading' });
    const [completing, setCompleting] = useState(false);
    const headingRef = useRef<HTMLHeadingElement>(null);

    const returnToWorld = () => {
        navigate(`/world?focused=${encodeURIComponent(nodeSlug)}`, {
            replace: true,
        });
    };

    const load = async (): Promise<void> => {
        if (!playRunId) {
            setState({ kind: 'unavailable' });
            return;
        }
        setState({ kind: 'loading' });
        try {
            const { data, response } = await apiClient.GET(
                '/learner/play-runs/{play_run_id}',
                { params: { path: { play_run_id: playRunId } } },
            );
            setState(
                response.ok && data
                    ? { kind: 'loaded', document: data }
                    : { kind: 'unavailable' },
            );
        } catch {
            setState({ kind: 'unavailable' });
        }
    };

    useEffect(() => {
        void load();
    }, [playRunId]);

    useEffect(() => {
        if (state.kind === 'loaded') {
            headingRef.current?.focus();
        }
    }, [state]);

    async function complete(): Promise<void> {
        if (state.kind !== 'loaded' || completing) {
            return;
        }
        setCompleting(true);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/complete',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: {
                            activity_slug: state.document.activity.slug,
                            play_run_id: state.document.play_run_id,
                        },
                    },
                },
            );
            if (!response.ok || !data) {
                setState({ kind: 'unavailable' });
                return;
            }
            if (data.status === 'completed') {
                returnToWorld();
                return;
            }
            await load();
        } catch {
            setState({ kind: 'unavailable' });
        } finally {
            setCompleting(false);
        }
    }

    return (
        <main
            className="flex min-h-svh flex-col bg-[#0b1117] p-3 text-slate-100 sm:p-4 md:p-6"
            data-wl-id="learner.activity.open-practice"
            id="learner-main-content"
            style={learnerSurfaceStyle}
            tabIndex={-1}
        >
            <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
                {state.kind === 'loading' ? (
                    <p aria-live="polite" className="text-sm text-slate-300">
                        Loading activity…
                    </p>
                ) : null}
                {state.kind === 'unavailable' ? (
                    <div className="rounded-lg border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] p-4">
                        <p role="alert" className="text-sm leading-6 text-[var(--learner-muted-text)]">
                            This activity is no longer available.
                        </p>
                        <Link
                            className="mt-4 inline-flex text-sm font-medium text-[var(--learner-action-accent)] underline-offset-4 hover:underline"
                            to={`/world?focused=${encodeURIComponent(nodeSlug)}`}
                        >
                            Return to the map
                        </Link>
                    </div>
                ) : null}
                {state.kind === 'loaded' ? (
                    <section className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] p-4">
                        <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--learner-action-accent)_12%,transparent)] text-[var(--learner-action-accent)]">
                                <PlayCircle className="size-4" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-medium tracking-[0.16em] text-[var(--learner-action-accent)] uppercase">
                                    Open practice
                                </p>
                                <h1
                                    className="mt-1 scroll-mt-4 rounded-sm text-base font-semibold text-[var(--learner-heading-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--learner-page-background)]"
                                    ref={headingRef}
                                    tabIndex={-1}
                                >
                                    {state.document.activity.title}
                                </h1>
                                {state.document.activity.description ? (
                                    <p className="mt-2 text-sm leading-6 text-[var(--learner-muted-text)]">
                                        {state.document.activity.description}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        <OpenPracticeActivity
                            activity={state.document.activity}
                            completing={completing}
                            onComplete={() => void complete()}
                        />
                    </section>
                ) : null}
            </section>
        </main>
    );
}

function OpenPracticeActivity({
    activity,
    completing,
    onComplete,
}: {
    activity: LearnerPlaybackDocument['activity'];
    completing: boolean;
    onComplete: () => void;
}) {
    const config = activity.config as Record<string, unknown>;
    const nextStep =
        typeof config.nextStep === 'string'
            ? config.nextStep
            : 'Choose a useful next step, then continue when you are ready.';
    const actionLabel = activity.completion.label?.trim() || 'Continue';

    return (
        <div className="flex flex-1 flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {nextStep}
            </p>
            <button
                className="mt-auto inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--learner-action-accent)] px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none"
                disabled={completing}
                onClick={onComplete}
                type="button"
            >
                {actionLabel}
                <ArrowRight className="ml-2 size-4" />
            </button>
        </div>
    );
}

const learnerSurfaceStyle = {
    '--learner-action-accent': '#5eead4',
    '--learner-border-color': 'rgba(255, 255, 255, 0.1)',
    '--learner-heading-text': '#f8fafc',
    '--learner-muted-text': '#cbd5e1',
    '--learner-page-background': '#0b1117',
    '--learner-panel-background': '#111820',
} as CSSProperties;
