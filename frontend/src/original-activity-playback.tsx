import { ArrowRight, PlayCircle, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';
import { OriginalLearningCheckIn } from './original-learning-check-in';
import { OriginalItemGrantActivity } from './original-item-grant-activity';
import { OriginalToolGrantActivity } from './original-tool-grant-activity';

type LearnerActivityStart = components['schemas']['LearnerActivityStart'];
type LearnerPlaybackDocument = components['schemas']['LearnerPlaybackDocument'];
type LearnerQuestionAnswerResult =
    components['schemas']['LearnerQuestionAnswerResult'];
type LearnerReflectionResult = components['schemas']['LearnerReflectionResult'];
type CompletionStatus =
    components['schemas']['LearnerPlaybackCompletionResult']['status'];

type PendingLearningCheckIn = {
    activity: LearnerPlaybackDocument['activity'];
    status: CompletionStatus;
    transitionLabel: string | null;
};

const ROUTE_PAGE_SIZE = 3;

/**
 * Source-adapted from `features/world/activity-panel.tsx`. The server supplies
 * the authored start presentation and owns all start/reset authorization.
 */
export function OriginalRouteStartButtons({
    appearance,
    starts,
    onReset,
    onStart,
}: {
    appearance: OriginalAppearance;
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
                        appearance={appearance}
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
                        onClick={() =>
                            setPage((value) => Math.max(1, value - 1))
                        }
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
    appearance,
    onReset,
    onStart,
    start,
}: {
    appearance: OriginalAppearance;
    onReset: () => void;
    onStart: () => void;
    start: LearnerActivityStart;
}) {
    const image =
        appearance === 'light' ? start.image_light : start.image_dark;
    const buttonColor =
        appearance === 'light'
            ? start.button_color_light
            : start.button_color_dark;
    const buttonBorderColor =
        appearance === 'light'
            ? start.button_border_color_light
            : start.button_border_color_dark;
    const routeBorderColor =
        buttonBorderColor ??
        (appearance === 'light' ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)');
    const buttonStyle = {
        ...(buttonColor ? { backgroundColor: buttonColor } : {}),
        backgroundClip: 'padding-box',
        boxShadow: `inset 0 0 0 2px ${routeBorderColor}`,
    };
    const frameStyle = { boxShadow: `inset 0 0 0 2px ${routeBorderColor}` };
    const progressText = routeProgressText(start);

    if (image) {
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
                        src={image}
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
    appearance,
    nodeSlug,
    playRunId,
}: {
    appearance: OriginalAppearance;
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
    const [pendingCheckIn, setPendingCheckIn] =
        useState<PendingLearningCheckIn | null>(null);
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

    function presentCheckIn(
        document: LearnerPlaybackDocument,
        status: CompletionStatus,
        transitionLabel: string | null,
    ): void {
        if (document.run_kind === 'revisit') {
            returnToWorld();
            return;
        }

        setPendingCheckIn({
            activity: document.activity,
            status,
            transitionLabel,
        });
    }

    async function continueAfterCheckIn(
        feeling: 'clearer' | 'forming' | 'stretched' | 'stuck' | null,
        note: string,
        nextDirection: 'revisit' | 'related' | 'settle' | null,
    ): Promise<void> {
        const checkIn = pendingCheckIn;

        if (!checkIn || state.kind !== 'loaded') {
            return;
        }

        if (feeling || note || nextDirection) {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/check-ins',
                {
                    body: {
                        feeling,
                        next_direction: nextDirection,
                        note: note || null,
                    },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: {
                            activity_slug: checkIn.activity.slug,
                            play_run_id: state.document.play_run_id,
                        },
                    },
                },
            );

            if (!response.ok || !data) {
                throw new Error('Your check-in could not be saved.');
            }
        }

        setPendingCheckIn(null);
        if (checkIn.status === 'completed') {
            returnToWorld();
            return;
        }

        await load();
    }

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
            presentCheckIn(
                state.document,
                data.status,
                state.document.activity.completion.label,
            );
        } catch {
            setState({ kind: 'unavailable' });
        } finally {
            setCompleting(false);
        }
    }

    return (
        <main
            className="flex min-h-svh flex-col bg-[#0b1117] p-3 text-slate-100 sm:p-4 md:p-6"
            data-wl-id={
                state.kind === 'loaded'
                    ? `learner.activity.${state.document.activity.activity_type}`
                    : 'learner.activity.playback'
            }
            id="learner-main-content"
            style={learnerSurfaceStyle}
            tabIndex={-1}
        >
            <section className="mx-auto grid w-full max-w-6xl flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 md:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)] md:grid-rows-1">
                {state.kind === 'loading' ? (
                    <p aria-live="polite" className="text-sm text-slate-300">
                        Loading activity…
                    </p>
                ) : null}
                {state.kind === 'unavailable' ? (
                    <div className="rounded-lg border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] p-4">
                        <p
                            role="alert"
                            className="text-sm leading-6 text-[var(--learner-muted-text)]"
                        >
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
                    <PlaybackContext context={state.document.context} />
                ) : null}
                {state.kind === 'loaded' ? (
                    <section className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] p-4">
                        <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--learner-action-accent)_12%,transparent)] text-[var(--learner-action-accent)]">
                                <PlayCircle className="size-4" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-medium tracking-[0.16em] text-[var(--learner-action-accent)] uppercase">
                                    {state.document.activity.activity_type ===
                                    'question'
                                        ? 'Question'
                                        : state.document.activity
                                                .activity_type === 'reflection'
                                          ? 'Reflection'
                                          : state.document.activity
                                                    .activity_type ===
                                              'tool_grant'
                                            ? 'Tool grant'
                                            : state.document.activity
                                                      .activity_type ===
                                                  'item_grant'
                                              ? 'Item grant'
                                          : 'Open practice'}
                                </p>
                                <h3
                                    className="mt-1 scroll-mt-4 rounded-sm text-base font-semibold text-[var(--learner-heading-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--learner-page-background)]"
                                    ref={headingRef}
                                    tabIndex={-1}
                                >
                                    {state.document.activity.title}
                                </h3>
                                {state.document.activity.description ? (
                                    <p className="mt-2 text-sm leading-6 text-[var(--learner-muted-text)]">
                                        {state.document.activity.description}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        {pendingCheckIn ? (
                            <OriginalLearningCheckIn
                                activityTitle={pendingCheckIn.activity.title}
                                checkIn={pendingCheckIn.activity.check_in}
                                onContinue={continueAfterCheckIn}
                                transitionLabel={pendingCheckIn.transitionLabel}
                            />
                        ) : state.document.activity.activity_type ===
                        'question' ? (
                            <QuestionActivity
                                activity={state.document.activity}
                                playRunId={state.document.play_run_id}
                                onContinue={(result) =>
                                    presentCheckIn(
                                        state.document,
                                        result.status,
                                        result.next_transition_label,
                                    )
                                }
                            />
                        ) : state.document.activity.activity_type ===
                          'reflection' ? (
                            <ReflectionActivity
                                activity={state.document.activity}
                                onSaved={(result) => {
                                    presentCheckIn(
                                        state.document,
                                        result.status,
                                        state.document.activity.completion.label,
                                    );
                                }}
                                playRunId={state.document.play_run_id}
                            />
                        ) : state.document.activity.activity_type ===
                          'tool_grant' ? (
                            <OriginalToolGrantActivity
                                activity={state.document.activity}
                                appearance={appearance}
                                onComplete={complete}
                                playRunId={state.document.play_run_id}
                            />
                        ) : state.document.activity.activity_type ===
                          'item_grant' ? (
                            <OriginalItemGrantActivity
                                activity={state.document.activity}
                                appearance={appearance}
                                onComplete={complete}
                                playRunId={state.document.play_run_id}
                            />
                        ) : (
                            <OpenPracticeActivity
                                activity={state.document.activity}
                                completing={completing}
                                onComplete={() => void complete()}
                            />
                        )}
                    </section>
                ) : null}
            </section>
        </main>
    );
}

/**
 * Source-adapted from the base branch of the original ReflectionActivity.
 * The Rust command owns journal selection, private persistence and progression;
 * no journal page or transition can be selected by the browser.
 */
function ReflectionActivity({
    activity,
    onSaved,
    playRunId,
}: {
    activity: LearnerPlaybackDocument['activity'];
    onSaved: (result: LearnerReflectionResult) => void;
    playRunId: string;
}) {
    const config = activity.config as { note?: unknown; prompt?: unknown };
    const prompt = typeof config.prompt === 'string' ? config.prompt : '';
    const note = typeof config.note === 'string' ? config.note : '';
    const [reflection, setReflection] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!prompt) {
        return null;
    }

    async function save(): Promise<void> {
        const response = reflection.trim();
        if (!response || saving) {
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response: apiResponse } = await apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/reflection',
                {
                    body: { reflection: response },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: {
                            activity_slug: activity.slug,
                            play_run_id: playRunId,
                        },
                    },
                },
            );
            if (!apiResponse.ok || !data) {
                setError(
                    'Your private reflection could not be saved. Try again.',
                );
                return;
            }
            onSaved(data);
        } catch {
            setError('Your private reflection could not be saved. Try again.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-cyan-700 uppercase dark:text-teal-200">
                <RotateCcw className="size-3.5" />
                Reflection
            </div>
            <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                {prompt}
            </p>
            <textarea
                className="min-h-32 resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 transition outline-none placeholder:text-slate-400 focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-200/70"
                id="activity-reflection-response"
                onChange={(event) => setReflection(event.currentTarget.value)}
                placeholder="Write a short note for yourself."
                value={reflection}
            />
            {note ? (
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {note}
                </p>
            ) : null}
            {error ? (
                <p className="text-sm text-red-300" role="alert">
                    {error}
                </p>
            ) : null}
            <button
                className="mt-auto inline-flex h-9 items-center justify-center rounded-md bg-[var(--learner-action-accent)] px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                disabled={saving || reflection.trim().length === 0}
                onClick={() => void save()}
                type="button"
            >
                {saving ? 'Keeping reflection…' : 'Keep reflection'}
            </button>
        </div>
    );
}

/** Source-adapted from the original QuestionActivity, with Rust retaining all evaluation and navigation authority. */
function QuestionActivity({
    activity,
    playRunId,
    onContinue,
}: {
    activity: LearnerPlaybackDocument['activity'];
    playRunId: string;
    onContinue: (result: LearnerQuestionAnswerResult) => void;
}) {
    const config = activity.config as {
        allowMultiple?: unknown;
        options?: unknown;
        prompt?: unknown;
    };
    const options = Array.isArray(config.options)
        ? config.options.filter(
              (
                  option,
              ): option is { body: string; key: string; label: string } =>
                  typeof option === 'object' &&
                  option !== null &&
                  typeof (option as { body?: unknown }).body === 'string' &&
                  typeof (option as { key?: unknown }).key === 'string' &&
                  typeof (option as { label?: unknown }).label === 'string',
          )
        : [];
    const allowMultiple = config.allowMultiple === true;
    const prompt = typeof config.prompt === 'string' ? config.prompt : '';
    const [selection, setSelection] = useState<string[]>([]);
    const [confidence, setConfidence] = useState<
        'exploring' | 'leaning' | 'settled' | null
    >(null);
    const [answer, setAnswer] = useState<LearnerQuestionAnswerResult | null>(
        null,
    );
    const [submitting, setSubmitting] = useState(false);

    if (!prompt || options.length === 0) {
        return null;
    }

    const select = (key: string) => {
        if (answer || submitting) return;
        if (!allowMultiple) {
            void submit([key]);
            return;
        }
        setSelection((current) =>
            current.includes(key)
                ? current.filter((selected) => selected !== key)
                : [...current, key],
        );
    };
    async function submit(optionKeys: string[]): Promise<void> {
        if (submitting || optionKeys.length === 0) return;
        setSubmitting(true);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/answer',
                {
                    body: { confidence, option_keys: optionKeys },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: {
                            activity_slug: activity.slug,
                            play_run_id: playRunId,
                        },
                    },
                },
            );
            if (response.ok && data) setAnswer(data);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="flex flex-1 flex-col gap-5">
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/6 dark:text-slate-100">
                {prompt}
            </p>
            {!answer ? (
                <>
                    <div>
                        <p className="text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200">
                            Optional starting sense
                        </p>
                        <div
                            className="mt-2 flex flex-wrap gap-2"
                            role="group"
                            aria-label="How settled your answer feels"
                        >
                            {(['exploring', 'leaning', 'settled'] as const).map(
                                (value) => (
                                    <button
                                        aria-pressed={confidence === value}
                                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-950/32 dark:text-slate-300"
                                        key={value}
                                        onClick={() => setConfidence(value)}
                                        type="button"
                                    >
                                        {value === 'exploring'
                                            ? 'Exploring'
                                            : value === 'leaning'
                                              ? 'I have a hunch'
                                              : 'Settled'}
                                    </button>
                                ),
                            )}
                        </div>
                    </div>
                    <div className="grid gap-3">
                        {options.map((option) => (
                            <button
                                aria-pressed={selection.includes(option.key)}
                                className="rounded-lg border border-slate-200 bg-white p-4 text-left text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-slate-950/32 dark:text-slate-100"
                                disabled={submitting}
                                key={option.key}
                                onClick={() => select(option.key)}
                                type="button"
                            >
                                <span className="mr-2 font-semibold text-cyan-700 dark:text-teal-200">
                                    {option.label}
                                </span>
                                {option.body}
                            </button>
                        ))}
                    </div>
                    {allowMultiple ? (
                        <button
                            className="self-start rounded-md bg-[var(--learner-action-accent)] px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
                            disabled={submitting || selection.length === 0}
                            onClick={() => void submit(selection)}
                            type="button"
                        >
                            {submitting ? 'Checking…' : 'Check answers'}
                            <ArrowRight className="ml-2 inline size-4" />
                        </button>
                    ) : null}
                </>
            ) : (
                <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
                    <p className="text-sm font-medium text-cyan-700 dark:text-teal-100">
                        {answer.is_correct
                            ? 'Useful clue found'
                            : 'Adjust the hypothesis'}
                    </p>
                    {answer.feedback ? (
                        <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                            {answer.feedback}
                        </p>
                    ) : null}
                    {answer.explanation ? (
                        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {answer.explanation}
                        </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-3">
                        <button
                            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-100"
                            onClick={() => {
                                setAnswer(null);
                                setSelection([]);
                                setConfidence(null);
                            }}
                            type="button"
                        >
                            Try again independently
                        </button>
                        <button
                            className="rounded-md bg-[var(--learner-action-accent)] px-4 py-2 text-sm font-medium text-slate-950"
                            onClick={() => onContinue(answer)}
                            type="button"
                        >
                            {answer.next_transition_label || 'Continue'}
                            <ArrowRight className="ml-2 inline size-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Source-adapted from the original NodePlay learning-context aside. */
function PlaybackContext({
    context,
}: {
    context: LearnerPlaybackDocument['context'];
}) {
    const mapHref = `/world?map=${encodeURIComponent(context.map_slug)}&focused=${encodeURIComponent(context.node_slug)}`;

    return (
        <aside
            aria-label="Learning context"
            className="flex min-h-0 flex-col rounded-lg border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] p-4"
        >
            <p className="text-xs font-medium tracking-[0.16em] text-[var(--learner-action-accent)] uppercase">
                Learning context
            </p>
            <h1 className="mt-2 text-base font-semibold text-[var(--learner-heading-text)]">
                {context.node_title}
            </h1>
            <dl className="mt-5 space-y-4 border-t border-[var(--learner-border-color)] pt-4">
                <div>
                    <dt className="text-xs font-medium tracking-[0.12em] text-[var(--learner-muted-text)] uppercase">
                        Map
                    </dt>
                    <dd className="mt-1 text-sm text-[var(--learner-body-text)]">
                        <Link
                            className="transition hover:text-[var(--learner-heading-text)]"
                            to={mapHref}
                        >
                            {context.map_title}
                        </Link>
                    </dd>
                </div>
                {context.route_label ? (
                    <div>
                        <dt className="text-xs font-medium tracking-[0.12em] text-[var(--learner-muted-text)] uppercase">
                            Route
                        </dt>
                        <dd className="mt-1 text-sm text-[var(--learner-action-accent)]">
                            {context.route_label}
                        </dd>
                    </div>
                ) : null}
            </dl>
        </aside>
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
                className="mt-auto inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--learner-action-accent)] px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
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
    '--learner-body-text': '#e2e8f0',
    '--learner-muted-text': '#cbd5e1',
    '--learner-page-background': '#0b1117',
    '--learner-panel-background': '#111820',
} as CSSProperties;
