import {
    ArrowRight,
    Bookmark,
    CheckCircle2,
    PlayCircle,
    RotateCcw,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';
import { OriginalLearningCheckIn } from './original-learning-check-in';
import { OriginalItemGrantActivity } from './original-item-grant-activity';
import { OriginalItemObstacleActivity } from './original-item-obstacle-activity';
import { OriginalMarkdownActivity } from './original-markdown-activity';
import { OriginalNpcDialogueActivity } from './original-npc-dialogue-activity';
import { OriginalObstacleActivity } from './original-obstacle-activity';
import { OriginalLearningSupportRequest } from './original-learning-support-request';
import { OriginalToolGrantActivity } from './original-tool-grant-activity';
import { OriginalToolBelt } from './original-tool-belt';

type LearnerActivityStart = components['schemas']['LearnerActivityStart'];
type LearnerPlaybackDocument = components['schemas']['LearnerPlaybackDocument'];
type LearnerQuestionAnswerResult =
    components['schemas']['LearnerQuestionAnswerResult'];
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
    const image = appearance === 'light' ? start.image_light : start.image_dark;
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
    const [inventory, setInventory] = useState<
        components['schemas']['LearnerItem'][]
    >([]);
    const [selectedTool, setSelectedTool] = useState<
        components['schemas']['LearnerTool'] | null
    >(null);
    const [pendingCheckIn, setPendingCheckIn] =
        useState<PendingLearningCheckIn | null>(null);
    const [hiddenCheckInActivitySlug, setHiddenCheckInActivitySlug] =
        useState<string | null>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const showConclusionButtonRef = useRef<HTMLButtonElement>(null);

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
            if (response.ok && data) {
                // Existing cached/mocked documents from before inventory was
                // added remain safe to render while the shared contract rolls
                // out; live API documents always include this bounded array.
                setInventory(data.items ?? []);
                setSelectedTool(null);
                setState({ kind: 'loaded', document: data });
            } else {
                setInventory([]);
                setSelectedTool(null);
                setState({ kind: 'unavailable' });
            }
        } catch {
            setInventory([]);
            setSelectedTool(null);
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

    useEffect(() => {
        if (
            pendingCheckIn &&
            hiddenCheckInActivitySlug === pendingCheckIn.activity.slug
        ) {
            showConclusionButtonRef.current?.focus();
        }
    }, [hiddenCheckInActivitySlug, pendingCheckIn]);

    function presentCheckIn(
        document: LearnerPlaybackDocument,
        status: CompletionStatus,
        transitionLabel: string | null,
    ): void {
        if (document.run_kind !== 'route') {
            returnToWorld();
            return;
        }

        setPendingCheckIn({
            activity: document.activity,
            status,
            transitionLabel,
        });
        setHiddenCheckInActivitySlug(null);
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
        setHiddenCheckInActivitySlug(null);
        if (checkIn.status === 'completed') {
            returnToWorld();
            return;
        }

        await load();
    }

    async function complete(
        transitionLabel?: string | null,
        confidenceAfterFeedback?:
            | 'exploring'
            | 'leaning'
            | 'settled'
            | null,
    ): Promise<void> {
        if (state.kind !== 'loaded' || completing) {
            return;
        }
        setCompleting(true);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/complete',
                {
                    body: {
                        confidence_after_feedback:
                            confidenceAfterFeedback ?? null,
                    },
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
                transitionLabel ?? state.document.activity.completion.label,
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
                    <section className="relative flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] p-4">
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
                                                .activity_type === 'review'
                                          ? 'Review'
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
                                              : state.document.activity
                                                      .activity_type ===
                                                  'item_obstacle'
                                                ? 'Item obstacle'
                                                : state.document.activity
                                                        .activity_type ===
                                                    'obstacle'
                                                  ? 'Obstacle'
                                                  : state.document.activity
                                                          .activity_type ===
                                                      'markdown'
                                                    ? 'Reading'
                                                    : state.document.activity
                                                              .activity_type ===
                                                      'message_prompt'
                                                    ? 'Learning Support'
                                                    : state.document.activity
                                                              .activity_type ===
                                                          'npc_dialogue'
                                                      ? 'Dialogue'
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
                        {state.document.activity.activity_type ===
                          'question' ? (
                            <QuestionActivity
                                activity={state.document.activity}
                                key={`${state.document.play_run_id}:${state.document.activity.slug}`}
                                playRunId={state.document.play_run_id}
                                onComplete={(result, confidenceAfterFeedback) =>
                                    complete(
                                        result.next_transition_label,
                                        confidenceAfterFeedback,
                                    )
                                }
                            />
                        ) : state.document.activity.activity_type ===
                          'reflection' ||
                          state.document.activity.activity_type === 'review' ? (
                            <ReflectionActivity
                                activity={state.document.activity}
                                onSaved={(status) => {
                                    presentCheckIn(
                                        state.document,
                                        status,
                                        state.document.activity.completion
                                            .label,
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
                        ) : state.document.activity.activity_type ===
                          'item_obstacle' ? (
                            <OriginalItemObstacleActivity
                                activity={state.document.activity}
                                appearance={appearance}
                                inventory={inventory}
                                onComplete={complete}
                                onInventoryChange={setInventory}
                                playRunId={state.document.play_run_id}
                            />
                        ) : state.document.activity.activity_type ===
                          'obstacle' ? (
                            <OriginalObstacleActivity
                                activity={state.document.activity}
                                appearance={appearance}
                                onComplete={complete}
                                onSelectTool={setSelectedTool}
                                playRunId={state.document.play_run_id}
                                selectedTool={selectedTool}
                            />
                        ) : state.document.activity.activity_type ===
                          'markdown' ? (
                            <OriginalMarkdownActivity
                                activity={state.document.activity}
                                appearance={appearance}
                                onComplete={complete}
                            />
                        ) : state.document.activity.activity_type ===
                          'message_prompt' ? (
                            <OriginalLearningSupportRequest
                                activity={state.document.activity}
                                appearance={appearance}
                                onComplete={complete}
                                playRunId={state.document.play_run_id}
                            />
                        ) : state.document.activity.activity_type ===
                          'npc_dialogue' ? (
                            <OriginalNpcDialogueActivity
                                activity={state.document.activity}
                                appearance={appearance}
                                onComplete={complete}
                                onRefresh={load}
                                playRunId={state.document.play_run_id}
                            />
                        ) : (
                            <OpenPracticeActivity
                                activity={state.document.activity}
                                completing={completing}
                                onComplete={() => void complete()}
                            />
                        )}
                        {pendingCheckIn &&
                        hiddenCheckInActivitySlug !==
                            pendingCheckIn.activity.slug ? (
                            <div className="absolute inset-0 z-30 overflow-hidden rounded-lg shadow-2xl">
                                <OriginalLearningCheckIn
                                    activityTitle={pendingCheckIn.activity.title}
                                    checkIn={pendingCheckIn.activity.check_in}
                                    onContinue={continueAfterCheckIn}
                                    onHide={() =>
                                        setHiddenCheckInActivitySlug(
                                            pendingCheckIn.activity.slug,
                                        )
                                    }
                                    transitionLabel={pendingCheckIn.transitionLabel}
                                />
                            </div>
                        ) : null}
                        {pendingCheckIn &&
                        hiddenCheckInActivitySlug ===
                            pendingCheckIn.activity.slug ? (
                            <button
                                className="absolute top-3 right-3 z-30 rounded-md border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] px-3 py-2 text-sm font-medium text-[var(--learner-body-text)] shadow-lg transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none"
                                onClick={() => setHiddenCheckInActivitySlug(null)}
                                ref={showConclusionButtonRef}
                                type="button"
                            >
                                Show conclusion
                            </button>
                        ) : null}
                    </section>
                ) : null}
            </section>
            {state.kind === 'loaded' ? (
                <OriginalToolBelt
                    appearance={appearance}
                    draggableItems={
                        state.document.activity.activity_type ===
                        'item_obstacle'
                    }
                    items={inventory}
                    onSelectTool={setSelectedTool}
                    selectedTool={selectedTool}
                    showTools={
                        state.document.activity.activity_type === 'obstacle'
                    }
                    tools={state.document.tools ?? []}
                />
            ) : null}
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
    onSaved: (status: CompletionStatus) => void;
    playRunId: string;
}) {
    const config = activity.config as {
        feedbackGuidance?: unknown;
        learningIntent?: unknown;
        note?: unknown;
        prompt?: unknown;
    };
    const guidance = asReflectionGuidance(config.feedbackGuidance);
    const prompt = typeof config.prompt === 'string' ? config.prompt : '';
    const note = typeof config.note === 'string' ? config.note : '';
    const responseType =
        config.learningIntent === 'explain' || config.learningIntent === 'transfer'
            ? config.learningIntent
            : null;
    const isReview =
        activity.activity_type === 'review' || config.learningIntent === 'review';
    const isTransfer = responseType === 'transfer';
    const independentCheckPrompt =
        responseType && guidance?.independentCheckPrompt
            ? guidance.independentCheckPrompt
            : null;
    const hasPostResponseGuidance = Boolean(
        (responseType || isReview) &&
            guidance &&
            (guidance.purpose ||
                guidance.evidence ||
                guidance.responseFeedback ||
                guidance.nextAction ||
                guidance.independentCheckPrompt ||
                guidance.rubric.length),
    );
    const [reflection, setReflection] = useState('');
    const [responseContext, setResponseContext] = useState('');
    const [observedCues, setObservedCues] = useState<string[]>([]);
    const [confidence, setConfidence] = useState<
        'exploring' | 'leaning' | 'settled' | null
    >(null);
    const [confidenceAfterFeedback, setConfidenceAfterFeedback] = useState<
        'exploring' | 'leaning' | 'settled' | null
    >(null);
    const [outcome, setOutcome] = useState<
        'clearer' | 'connected' | 'open' | null
    >(null);
    const [reflectionSaved, setReflectionSaved] = useState(false);
    const [independentResponse, setIndependentResponse] = useState('');
    const [independentResponseContext, setIndependentResponseContext] =
        useState('');
    const [independentResponseSaved, setIndependentResponseSaved] =
        useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const postResponseContinueRef = useRef<HTMLButtonElement>(null);
    const independentComparisonRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        if (reflectionSaved) {
            postResponseContinueRef.current?.focus();
        }
    }, [reflectionSaved]);

    useEffect(() => {
        if (independentResponseSaved) {
            independentComparisonRef.current?.focus();
        }
    }, [independentResponseSaved]);

    if (!prompt) {
        return null;
    }

    async function complete(): Promise<void> {
        const token = await getCsrfToken();
        const completion = await apiClient.POST(
            '/learner/play-runs/{play_run_id}/activities/{activity_slug}/complete',
            {
                ...(confidence || confidenceAfterFeedback || outcome
                    ? {
                          body: {
                              ...(confidence ? { confidence } : {}),
                              ...(confidenceAfterFeedback
                                  ? { confidence_after_feedback: confidenceAfterFeedback }
                                  : {}),
                              ...(outcome ? { outcome } : {}),
                          },
                      }
                    : {}),
                params: {
                    header: { 'X-CSRF-Token': token },
                    path: {
                        activity_slug: activity.slug,
                        play_run_id: playRunId,
                    },
                },
            },
        );
        if (!completion.response.ok || !completion.data) {
            throw new Error('complete reflection');
        }
        onSaved(completion.data.status);
    }

    async function save(independentCheck = false): Promise<void> {
        const response = independentCheck
            ? independentResponse.trim()
            : reflection.trim();
        const context = independentCheck
            ? independentResponseContext.trim()
            : responseContext.trim();
        if (
            !response ||
            saving ||
            (isTransfer && !context) ||
            (independentCheck && !independentCheckPrompt)
        ) {
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response: apiResponse } = await apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/reflection',
                {
                    body: {
                        reflection: response,
                        ...(isTransfer ? { response_context: context } : {}),
                        ...(!independentCheck && observedCues.length > 0
                            ? { observed_cues: observedCues }
                            : {}),
                        ...(independentCheck
                            ? { independent_check: true }
                            : {}),
                    },
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
            if (independentCheck) {
                setIndependentResponseSaved(true);
                return;
            }
            if (hasPostResponseGuidance) {
                setReflectionSaved(true);
                return;
            }
            await complete();
        } catch {
            setError('Your private reflection could not be saved. Try again.');
        } finally {
            setSaving(false);
        }
    }

    if (reflectionSaved) {
        return (
            <div className="flex flex-1 flex-col gap-4 rounded-lg border border-cyan-500/25 bg-cyan-50/60 p-4 dark:border-teal-200/20 dark:bg-teal-100/6">
                <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-cyan-700 dark:text-teal-200" />
                    <div>
                        <p className="text-xs font-medium tracking-[0.14em] text-cyan-800 uppercase dark:text-teal-100">
                            Response saved privately
                        </p>
                        <p className="mt-1 text-sm leading-6 text-cyan-950/80 dark:text-teal-50/80">
                            Take a moment to compare your response with the observation guidance before you continue.
                        </p>
                    </div>
                </div>
                {guidance ? <ReflectionGuidance guidance={guidance} /> : null}
                {independentCheckPrompt ? (
                    <div className="rounded-md border border-cyan-500/20 bg-white/60 p-3 dark:border-teal-100/15 dark:bg-slate-950/20">
                        <p className="text-xs font-medium tracking-[0.12em] text-cyan-800 uppercase dark:text-teal-100">
                            Independent check (optional)
                        </p>
                        <p className="mt-1 text-sm leading-6 text-cyan-950/80 dark:text-teal-50/80">
                            {independentCheckPrompt}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-cyan-950/70 dark:text-teal-50/70">
                            Try a fresh response without looking back. This stays private and is recorded separately; you can continue without it.
                        </p>
                        <label
                            className="mt-3 block text-xs font-medium tracking-[0.12em] text-cyan-800 uppercase dark:text-teal-100"
                            htmlFor="activity-independent-response"
                        >
                            Fresh response
                        </label>
                        <textarea
                            className="mt-2 min-h-24 w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 transition outline-none placeholder:text-slate-400 focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-200/70"
                            disabled={independentResponseSaved}
                            id="activity-independent-response"
                            onChange={(event) =>
                                setIndependentResponse(event.currentTarget.value)
                            }
                            placeholder="Write what you can explain or apply on your own now."
                            value={independentResponse}
                        />
                        {isTransfer ? (
                            <>
                                <label
                                    className="mt-3 block text-xs font-medium tracking-[0.12em] text-cyan-800 uppercase dark:text-teal-100"
                                    htmlFor="activity-independent-context"
                                >
                                    Changed context
                                </label>
                                <textarea
                                    className="mt-2 min-h-20 w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 transition outline-none placeholder:text-slate-400 focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-200/70"
                                    disabled={independentResponseSaved}
                                    id="activity-independent-context"
                                    onChange={(event) =>
                                        setIndependentResponseContext(
                                            event.currentTarget.value,
                                        )
                                    }
                                    placeholder="Where would this idea work in a new situation?"
                                    value={independentResponseContext}
                                />
                            </>
                        ) : null}
                        <button
                            className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-[var(--learner-action-accent)] px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                            disabled={
                                independentResponseSaved ||
                                saving ||
                                !independentResponse.trim() ||
                                (isTransfer && !independentResponseContext.trim())
                            }
                            onClick={() => void save(true)}
                            type="button"
                        >
                            {independentResponseSaved
                                ? 'Independent response saved'
                                : 'Save independent response'}
                        </button>
                    </div>
                ) : null}
                {independentResponseSaved ? (
                    <section
                        aria-labelledby="activity-independent-comparison"
                        className="rounded-md border border-cyan-500/20 bg-white/60 p-3 dark:border-teal-100/15 dark:bg-slate-950/20"
                    >
                        <h3
                            className="text-xs font-medium tracking-[0.12em] text-cyan-800 uppercase outline-none focus:ring-2 focus:ring-cyan-500 dark:text-teal-100 dark:focus:ring-teal-200"
                            id="activity-independent-comparison"
                            ref={independentComparisonRef}
                            tabIndex={-1}
                        >
                            Compare your responses
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-cyan-950/70 dark:text-teal-50/70">
                            Notice what changed or stayed consistent. Both responses remain private.
                        </p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <ReflectionResponseComparison
                                context={responseContext}
                                isTransfer={isTransfer}
                                label="First response"
                                response={reflection}
                            />
                            <ReflectionResponseComparison
                                context={independentResponseContext}
                                isTransfer={isTransfer}
                                label="Fresh response"
                                response={independentResponse}
                            />
                        </div>
                    </section>
                ) : null}
                {independentResponseSaved && guidance?.independentCheckFeedback ? (
                    <div className="rounded-md border border-cyan-500/20 bg-white/60 p-3 dark:border-teal-100/15 dark:bg-slate-950/20">
                        <p className="text-xs font-medium tracking-[0.12em] text-cyan-800 uppercase dark:text-teal-100">
                            After your independent check
                        </p>
                        <p className="mt-1 text-sm leading-6 text-cyan-950/80 dark:text-teal-50/80">
                            {guidance.independentCheckFeedback}
                        </p>
                    </div>
                ) : null}
                {responseType || isReview ? (
                    <fieldset className="rounded-md border border-cyan-500/20 bg-white/60 p-3 dark:border-teal-100/15 dark:bg-slate-950/20">
                        <legend className="px-1 text-xs font-medium tracking-[0.12em] text-cyan-800 uppercase dark:text-teal-100">
                            After comparing, how settled does this feel now? (optional)
                        </legend>
                        <p className="mt-1 text-xs leading-5 text-cyan-950/70 dark:text-teal-50/70">
                            This is a reflection on your understanding, not a grade.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {reflectionConfidenceOptions.map((option) => (
                                <button
                                    aria-pressed={confidenceAfterFeedback === option.value}
                                    className="min-h-11 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-950/32 dark:text-slate-300"
                                    key={option.value}
                                    onClick={() => setConfidenceAfterFeedback(option.value)}
                                    type="button"
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                ) : null}
                {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
                <p className="text-xs leading-5 text-cyan-900/70 dark:text-teal-100/70">
                    This response stays in your private journal.
                </p>
                <button
                    className="mt-auto inline-flex h-9 items-center justify-center rounded-md bg-[var(--learner-action-accent)] px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                    disabled={saving}
                    onClick={() => void complete().catch(() => setError('The activity could not continue. Try again.'))}
                    ref={postResponseContinueRef}
                    type="button"
                >
                    Continue
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-cyan-700 uppercase dark:text-teal-200">
                <RotateCcw className="size-3.5" />
                {isReview ? 'Review / revisit' : 'Reflection'}
            </div>
            {isReview ? (
                <p className="rounded-lg border border-cyan-500/20 bg-cyan-50 p-3 text-xs leading-5 text-cyan-900 dark:border-teal-200/20 dark:bg-teal-100/8 dark:text-teal-100">
                    Return to the idea and notice what feels clearer, more connected, or still open.
                </p>
            ) : null}
            {isReview && activity.review_context.length ? (
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-50/60 p-3 dark:border-teal-200/20 dark:bg-teal-100/6">
                    <p className="text-xs font-medium tracking-[0.14em] text-cyan-900 uppercase dark:text-teal-100">
                        Earlier notes from you
                    </p>
                    <p className="mt-1 text-xs leading-5 text-cyan-900/75 dark:text-teal-100/75">
                        Look back if it helps. You can also write without comparing.
                    </p>
                    <div className="mt-2 grid gap-2">
                        {activity.review_context.map((entry) => (
                            <details
                                className="rounded-md border border-cyan-500/15 bg-white/60 px-2.5 py-2 dark:border-teal-100/15 dark:bg-black/10"
                                key={entry.id}
                            >
                                <summary className="cursor-pointer text-xs font-medium text-cyan-900 dark:text-teal-100">
                                    {formatReviewDate(entry.created_at)} · {entry.question}
                                </summary>
                                <p className="mt-2 text-xs leading-5 whitespace-pre-wrap text-cyan-950/80 dark:text-teal-50/80">
                                    {entry.reflection}
                                </p>
                            </details>
                        ))}
                    </div>
                </div>
            ) : null}
            {responseType ? (
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-50/60 p-3 dark:border-teal-200/20 dark:bg-teal-100/6">
                    <p className="text-xs font-medium tracking-[0.14em] text-cyan-900 uppercase dark:text-teal-100">
                        Response focus
                    </p>
                    <p className="mt-1 text-xs leading-5 text-cyan-900/75 dark:text-teal-100/75">
                        {isTransfer
                            ? 'Name the changed context and explain how the idea worked there.'
                            : 'Explain the idea in your own words and connect it to a reason or example.'}
                    </p>
                </div>
            ) : null}
            <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                {prompt}
            </p>
            {responseType ? (
                <fieldset className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                    <legend className="px-1 text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200">
                        How settled does your starting understanding feel? (optional)
                    </legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {reflectionConfidenceOptions.map((option) => (
                            <button
                                aria-pressed={confidence === option.value}
                                className="min-h-11 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-950/32 dark:text-slate-300"
                                key={option.value}
                                onClick={() => setConfidence(option.value)}
                                type="button"
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </fieldset>
            ) : null}
            {responseType ? (
                <label
                    className="text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200"
                    htmlFor="activity-reflection-response"
                >
                    Your explanation
                </label>
            ) : null}
            <textarea
                aria-describedby={responseType ? 'activity-response-help' : undefined}
                className="min-h-32 resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 transition outline-none placeholder:text-slate-400 focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-200/70"
                id="activity-reflection-response"
                onChange={(event) => setReflection(event.currentTarget.value)}
                placeholder={
                    isTransfer
                        ? 'Explain how the idea worked in the changed context.'
                        : responseType
                          ? 'Write the idea in your own words.'
                          : isReview
                            ? 'Write what feels clearer or still open.'
                          : 'Write a short note for yourself.'
                }
                value={reflection}
            />
            {isTransfer ? (
                <div>
                    <label
                        className="text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200"
                        htmlFor="activity-reflection-context"
                    >
                        Changed context
                    </label>
                    <textarea
                        aria-describedby="activity-response-help"
                        className="mt-2 min-h-20 w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 transition outline-none placeholder:text-slate-400 focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-200/70"
                        id="activity-reflection-context"
                        onChange={(event) =>
                            setResponseContext(event.currentTarget.value)
                        }
                        placeholder="Where did you try the idea?"
                        required
                        value={responseContext}
                    />
                </div>
            ) : null}
            {(responseType || isReview) && guidance?.rubric.length ? (
                <fieldset className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                    <legend className="px-1 text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200">
                        What did you notice in your response? (optional)
                    </legend>
                    <p
                        className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400"
                        id="activity-response-help"
                    >
                        {isReview
                            ? 'Select any cues that feel visible in your response. This records your observation, not a grade.'
                            : 'Select any cues that feel visible in your explanation. This records your observation, not a grade.'}
                    </p>
                    <div className="mt-2 grid gap-2">
                        {guidance.rubric.map((cue) => {
                            const checked = observedCues.includes(cue);
                            return (
                                <label className="flex min-h-11 items-start gap-2 rounded-md border border-slate-200 bg-white/60 px-2.5 py-2 text-xs leading-5 text-slate-600 dark:border-white/10 dark:bg-slate-950/20 dark:text-slate-300" key={cue}>
                                    <input checked={checked} onChange={() => setObservedCues((current) => checked ? current.filter((value) => value !== cue) : [...current, cue])} type="checkbox" />
                                    <span>{cue}</span>
                                </label>
                            );
                        })}
                    </div>
                </fieldset>
            ) : null}
            {isReview ? (
                <fieldset className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                    <legend className="px-1 text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200">
                        After your response, how settled does this feel before comparing with the guidance? (optional)
                    </legend>
                    <div
                        aria-label="After your response, how settled does this feel before comparing with the guidance? (optional)"
                        className="mt-2 flex flex-wrap gap-2"
                        role="group"
                    >
                        {reflectionConfidenceOptions.map((option) => (
                            <button
                                aria-pressed={confidence === option.value}
                                className={`min-h-11 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-cyan-500/60 hover:text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/32 dark:text-slate-300 dark:hover:border-teal-200/60 dark:hover:text-teal-100 dark:focus-visible:ring-teal-200 ${confidence === option.value ? 'border-cyan-500/80 bg-cyan-50 text-cyan-700 dark:border-teal-200/80 dark:bg-teal-100/12 dark:text-teal-100' : ''}`}
                                key={option.value}
                                onClick={() => setConfidence(option.value)}
                                type="button"
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </fieldset>
            ) : null}
            {isReview ? (
                <fieldset className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                    <legend className="px-1 text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200">
                        What changed for you? (optional)
                    </legend>
                    <div
                        aria-label="What changed for you? (optional)"
                        aria-describedby="activity-review-outcome-help"
                        className="mt-2 flex flex-wrap gap-2"
                        role="group"
                    >
                        {reviewOutcomeOptions.map((option) => (
                            <button
                                aria-pressed={outcome === option.value}
                                className={`min-h-11 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-cyan-500/60 hover:text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/32 dark:text-slate-300 dark:hover:border-teal-200/60 dark:hover:text-teal-100 dark:focus-visible:ring-teal-200 ${outcome === option.value ? 'border-cyan-500/80 bg-cyan-50 text-cyan-700 dark:border-teal-200/80 dark:bg-teal-100/12 dark:text-teal-100' : ''}`}
                                key={option.value}
                                onClick={() => setOutcome(option.value)}
                                type="button"
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <p
                        className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400"
                        id="activity-review-outcome-help"
                    >
                        {outcome
                            ? reviewOutcomeDescription(outcome)
                            : 'Choose only if one of these descriptions fits. No choice is required, and none is a grade.'}
                    </p>
                </fieldset>
            ) : null}
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
                disabled={saving || reflection.trim().length === 0 || (isTransfer && !responseContext.trim())}
                onClick={() => void save()}
                type="button"
            >
                {saving
                    ? 'Keeping reflection…'
                    : isReview
                      ? 'Save review note'
                      : 'Keep reflection'}
            </button>
        </div>
    );
}

type ReflectionGuidance = {
    evidence: string | null;
    independentCheckFeedback: string | null;
    independentCheckPrompt: string | null;
    nextAction: string | null;
    purpose: string | null;
    responseFeedback: string | null;
    rubric: string[];
};

const reflectionConfidenceOptions: Array<{
    label: string;
    value: 'exploring' | 'leaning' | 'settled';
}> = [
    { label: 'Exploring', value: 'exploring' },
    { label: 'I have a hunch', value: 'leaning' },
    { label: 'Settled', value: 'settled' },
];

const reviewOutcomeOptions: Array<{
    label: string;
    value: 'clearer' | 'connected' | 'open';
}> = [
    { label: 'Clearer now', value: 'clearer' },
    { label: 'More connected', value: 'connected' },
    { label: 'Still open', value: 'open' },
];

function reviewOutcomeDescription(outcome: 'clearer' | 'connected' | 'open'): string {
    return {
        clearer: 'The idea feels easier to explain or use now.',
        connected: 'A relationship or context is more visible now.',
        open: 'The idea may need more time, another example, or a different route.',
    }[outcome];
}

function formatReviewDate(value: string): string {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? 'Earlier'
        : date.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
          });
}

function asReflectionGuidance(value: unknown): ReflectionGuidance | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const guidance = value as Record<string, unknown>;
    const text = (key: string): string | null =>
        typeof guidance[key] === 'string' && guidance[key].trim()
            ? guidance[key]
            : null;
    const rubric = Array.isArray(guidance.rubric)
        ? guidance.rubric.filter(
              (cue): cue is string =>
                  typeof cue === 'string' && cue.trim().length > 0,
          )
        : [];
    const normalized = {
        evidence: text('evidence'),
        independentCheckFeedback: text('independentCheckFeedback'),
        independentCheckPrompt: text('independentCheckPrompt'),
        nextAction: text('nextAction'),
        purpose: text('purpose'),
        responseFeedback: text('responseFeedback'),
        rubric,
    };
    return Object.values(normalized).some(
        (entry) => Array.isArray(entry) ? entry.length > 0 : entry !== null,
    )
        ? normalized
        : null;
}

function ReflectionResponseComparison({
    context,
    isTransfer,
    label,
    response,
}: {
    context: string;
    isTransfer: boolean;
    label: string;
    response: string;
}) {
    return (
        <div className="rounded-md border border-cyan-500/15 bg-white/60 p-3 dark:border-teal-100/15 dark:bg-black/10">
            <p className="text-xs font-medium text-cyan-900 dark:text-teal-100">
                {label}
            </p>
            <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-cyan-950/80 dark:text-teal-50/80">
                {response}
            </p>
            {isTransfer ? (
                <>
                    <p className="mt-3 text-xs font-medium tracking-[0.1em] text-cyan-800 uppercase dark:text-teal-100">
                        Changed context
                    </p>
                    <p className="mt-1 text-xs leading-5 whitespace-pre-wrap text-cyan-950/70 dark:text-teal-50/70">
                        {context}
                    </p>
                </>
            ) : null}
        </div>
    );
}

function ReflectionGuidance({ guidance }: { guidance: ReflectionGuidance }) {
    const entries = [
        ['Purpose', guidance.purpose],
        ['What to notice', guidance.evidence],
        ['Compare your response', guidance.responseFeedback],
        ['A possible next action', guidance.nextAction],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));

    return (
        <>
            {entries.map(([label, value]) => (
                <div className="rounded-md border border-cyan-500/20 bg-white/60 p-3 dark:border-teal-100/15 dark:bg-slate-950/20" key={label}>
                    <p className="text-xs font-medium tracking-[0.12em] text-cyan-800 uppercase dark:text-teal-100">{label}</p>
                    <p className="mt-1 text-sm leading-6 text-cyan-950/80 dark:text-teal-50/80">{value}</p>
                </div>
            ))}
            {guidance.rubric.length ? (
                <div className="rounded-md border border-cyan-500/20 bg-white/60 p-3 dark:border-teal-100/15 dark:bg-slate-950/20">
                    <p className="text-xs font-medium tracking-[0.12em] text-cyan-800 uppercase dark:text-teal-100">Observable cues</p>
                    <ul className="mt-1 grid gap-1 text-sm leading-6 text-cyan-950/80 dark:text-teal-50/80">
                        {guidance.rubric.map((cue) => <li key={cue}>{cue}</li>)}
                    </ul>
                </div>
            ) : null}
        </>
    );
}

/** Source-adapted from the original QuestionActivity, with Rust retaining all evaluation and navigation authority. */
function QuestionActivity({
    activity,
    playRunId,
    onComplete,
}: {
    activity: LearnerPlaybackDocument['activity'];
    playRunId: string;
    onComplete: (
        result: LearnerQuestionAnswerResult,
        confidenceAfterFeedback: 'exploring' | 'leaning' | 'settled' | null,
    ) => Promise<void>;
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
        activity.question_feedback,
    );
    const [submitting, setSubmitting] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [confidenceAfterFeedback, setConfidenceAfterFeedback] = useState<
        'exploring' | 'leaning' | 'settled' | null
    >(null);
    const [recallItemId, setRecallItemId] = useState<string | null>(
        activity.recall_item_id,
    );
    const [isRecallUpdating, setIsRecallUpdating] = useState(false);
    const [recallError, setRecallError] = useState(false);

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
        if (submitting || completing || optionKeys.length === 0) return;
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

    async function completeQuestion(): Promise<void> {
        if (!answer || completing) return;
        setCompleting(true);
        try {
            await onComplete(answer, confidenceAfterFeedback);
        } finally {
            setCompleting(false);
        }
    }

    async function toggleRecall(): Promise<void> {
        if (isRecallUpdating || completing) return;
        setIsRecallUpdating(true);
        setRecallError(false);
        try {
            const token = await getCsrfToken();
            if (recallItemId) {
                const { response } = await apiClient.DELETE(
                    '/learner/recall-items/{recall_item_id}',
                    {
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { recall_item_id: recallItemId },
                        },
                    },
                );
                if (!response.ok) throw new Error('remove recall failed');
                setRecallItemId(null);
            } else {
                const { data, response } = await apiClient.POST(
                    '/learner/play-runs/{play_run_id}/activities/{activity_slug}/recall',
                    {
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: {
                                activity_slug: activity.slug,
                                play_run_id: playRunId,
                            },
                        },
                    },
                );
                if (!response.ok || !data) throw new Error('queue recall failed');
                setRecallItemId(data.recall_item_id);
            }
        } catch {
            setRecallError(true);
        } finally {
            setIsRecallUpdating(false);
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
                    <div className="flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-teal-100">
                        {answer.is_correct ? (
                            <CheckCircle2 className="size-4" />
                        ) : (
                            <RotateCcw className="size-4" />
                        )}
                        <span>
                            {answer.is_correct
                                ? 'Useful clue found'
                                : 'Adjust the hypothesis'}
                        </span>
                    </div>
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
                    {answer.calibration ? (
                        <p className="mt-3 rounded-md border border-cyan-500/15 bg-cyan-50/60 p-3 text-xs leading-5 text-cyan-950 dark:border-teal-100/15 dark:bg-teal-100/6 dark:text-teal-50">
                            <span className="font-medium">
                                Confidence reflection:
                            </span>{' '}
                            {calibrationMessage(answer.calibration)}
                        </p>
                    ) : null}
                    <fieldset className="mt-4 rounded-md border border-slate-200 p-3 dark:border-white/10">
                        <legend className="px-1 text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200">
                            After comparing, how settled does this feel now?
                            <span className="normal-case"> (optional)</span>
                        </legend>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            This is a reflection on your understanding, not a grade.
                        </p>
                        <div
                            aria-label="After comparing, how settled does this feel now?"
                            className="mt-2 flex flex-wrap gap-2"
                            role="group"
                        >
                            {(['exploring', 'leaning', 'settled'] as const).map(
                                (value) => (
                                    <button
                                        aria-pressed={
                                            confidenceAfterFeedback === value
                                        }
                                        className="min-h-11 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-cyan-500/60 hover:text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/32 dark:text-slate-300 dark:hover:border-teal-200/60 dark:hover:text-teal-100 dark:focus-visible:ring-teal-200"
                                        key={value}
                                        onClick={() =>
                                            setConfidenceAfterFeedback(value)
                                        }
                                        type="button"
                                    >
                                        {confidenceLabel(value)}
                                    </button>
                                ),
                            )}
                        </div>
                    </fieldset>
                    {answer.recall ? (
                        <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            Next recall in {answer.recall.interval_days} days.
                        </p>
                    ) : null}
                    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-white/10">
                        <button
                            className="inline-flex min-h-11 items-center rounded-md border border-slate-200 bg-transparent px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-500/60 hover:text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 dark:border-white/10 dark:text-slate-100 dark:hover:border-teal-200/60 dark:hover:text-teal-100 dark:focus-visible:ring-teal-200"
                            disabled={isRecallUpdating || completing}
                            onClick={() => void toggleRecall()}
                            type="button"
                        >
                            <Bookmark aria-hidden="true" className="mr-2 size-4" />
                            {recallItemId
                                ? 'Remove from recall queue'
                                : 'Keep for later recall'}
                        </button>
                        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {recallItemId
                                ? 'This question is waiting on your Learning Desk until you remove it.'
                                : 'Save this question when you want to return to it without changing your route.'}
                        </p>
                        {recallError ? (
                            <p aria-live="polite" className="mt-2 text-xs text-red-600 dark:text-red-300" role="status">
                                This recall choice could not be saved. Try again.
                            </p>
                        ) : null}
                    </div>
                    {answer.confidence ? (
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                            Starting sense: {confidenceLabel(answer.confidence)}
                            {answer.attempt_number > 1
                                ? ` · Attempt ${answer.attempt_number}`
                                : ''}
                        </p>
                    ) : null}
                    {answer.earlier_attempts.length ? (
                        <details className="mt-4 rounded-md border border-slate-200 px-3 py-2 dark:border-white/10">
                            <summary className="cursor-pointer text-xs font-medium text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-slate-300 dark:focus-visible:ring-teal-200">
                                Earlier tries ({answer.earlier_attempts.length})
                            </summary>
                            <div className="mt-2 grid gap-2">
                                {answer.earlier_attempts.map((attempt) => (
                                    <div
                                        className="rounded-md bg-slate-50 px-2.5 py-2 dark:bg-white/5"
                                        key={`${attempt.answered_at}-${attempt.option_labels.join('-')}`}
                                    >
                                        <div className="flex items-center justify-between gap-2 text-xs">
                                            <span className="font-medium text-slate-700 dark:text-slate-200">
                                                {attempt.option_labels.length
                                                    ? `Chose ${attempt.option_labels.join(', ')}`
                                                    : 'Earlier answer'}
                                            </span>
                                            <span className="shrink-0 text-slate-500 dark:text-slate-400">
                                                {new Date(
                                                    attempt.answered_at,
                                                ).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                            {attempt.is_correct
                                                ? 'Useful clue found'
                                                : 'Adjust the hypothesis'}
                                            {attempt.confidence
                                                ? ` · Starting sense: ${confidenceLabel(attempt.confidence)}`
                                                : ''}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </details>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-3">
                        <button
                            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-100"
                            onClick={() => {
                                if (completing) return;
                                setAnswer(null);
                                setSelection([]);
                                setConfidence(null);
                                setConfidenceAfterFeedback(null);
                            }}
                            disabled={completing}
                            type="button"
                        >
                            Try again independently
                        </button>
                        <button
                            className="rounded-md bg-[var(--learner-action-accent)] px-4 py-2 text-sm font-medium text-slate-950"
                            disabled={completing}
                            onClick={() => void completeQuestion()}
                            type="button"
                        >
                            {completing
                                ? 'Saving…'
                                : answer.next_transition_label || 'Continue'}
                            <ArrowRight className="ml-2 inline size-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function confidenceLabel(
    confidence: 'exploring' | 'leaning' | 'settled',
): string {
    return confidence === 'exploring'
        ? 'Exploring'
        : confidence === 'leaning'
          ? 'I have a hunch'
          : 'Settled';
}

function calibrationMessage(
    calibration:
        | 'aligned'
        | 'stronger_than_expected'
        | 'higher_than_result'
        | 'uncertainty_made_gap_visible',
): string {
    return calibration === 'aligned'
        ? 'Your confidence matched this result.'
        : calibration === 'stronger_than_expected'
          ? 'This result was stronger than your starting sense.'
          : calibration === 'higher_than_result'
            ? 'Your starting confidence was higher than this result. Compare the explanation with your reasoning.'
            : 'Your uncertainty helped make this gap visible. Use the explanation to adjust your reasoning.';
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
    '--map-floating-accent-color': '#5eead4',
    '--map-side-control-active-background': 'rgba(94, 234, 212, 0.18)',
    '--map-side-control-active-icon-color': '#5eead4',
    '--map-side-control-active-text-color': '#e2e8f0',
    '--map-side-control-background': 'rgba(15, 23, 42, 0.92)',
    '--map-side-control-border-color': 'rgba(255, 255, 255, 0.12)',
    '--map-side-control-hover-background': 'rgba(94, 234, 212, 0.12)',
    '--map-side-control-icon-color': '#e2e8f0',
    '--map-side-control-muted-text-color': '#cbd5e1',
    '--map-side-control-panel-background': '#111820',
    '--map-side-control-panel-border-color': 'rgba(255, 255, 255, 0.12)',
    '--map-side-control-text-color': '#e2e8f0',
    '--platform-action-cursor': 'pointer',
    '--platform-cursor': 'default',
} as CSSProperties;
