import { Head, Link, router, usePage } from '@inertiajs/react';
import { Bookmark } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    appendLearnerContextNavigation,
    createLearnerPrimaryNavigation,
} from '@/components/learner-navigation';
import { LearnerNavigationHeader } from '@/components/learner-navigation-header';
import type { LearnerNavigationItem } from '@/components/learner-navigation-header';
import { Button } from '@/components/ui/button';
import { applyActivityTranslation } from '@/features/localization/activity-translation';
import type { LearningActivityTranslation } from '@/features/localization/activity-translation';
import {
    clearPersistedActiveActivity,
    persistActiveActivity,
} from '@/features/world/active-activity';
import {
    ActivityPlayer,
    learningAreaNames,
} from '@/features/world/activity-panel';
import { deleteJson, getJson, postJson } from '@/features/world/api';
import { LearningCheckIn } from '@/features/world/learning-check-in';
import { useAppearance } from '@/hooks/use-appearance';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import type {
    LearningActivity,
    LearningCheckInFeeling,
    LearningCheckInNextDirection,
    LearningNode,
    LearningPortalLink,
    LearningProgress,
    ActivityCompletionOutcome,
    QuestionCalibration,
    QuestionConfidence,
    QuestionAnswerProgress,
} from '@/types';

type NodePlayProps = {
    isBookmarked: boolean;
    node: LearningNode;
    playActivityId: number | null;
    playRouteId: number | null;
    playRunId: string | null;
    recallQuestionId: number | null;
    revisitActivityId: number | null;
    playState: Record<string, unknown>;
    progress: LearningProgress;
};

type CompletionOptions = {
    confidence?: QuestionConfidence;
    confidenceAfterFeedback?: QuestionConfidence;
    calibration?: QuestionCalibration;
    endsRoute?: boolean;
    attemptNumber?: number;
    assistanceLevel?: string;
    observedCues?: string[];
    outcome?: ActivityCompletionOutcome;
    progressAlreadyMarked?: boolean;
};

type CheckInDestination =
    | { kind: 'activity'; activityId: number | null }
    | { kind: 'portal'; portalLink: LearningPortalLink };

type PendingLearningCheckIn = {
    activityId: number;
    activityTitle: string;
    choicePrompt: string | null;
    destination: CheckInDestination | null;
    learningAreas: Array<{ name: string; slug: string | null }>;
    originTopicSlug: string | null;
};

export default function NodePlay({
    isBookmarked: initialIsBookmarked,
    node,
    playActivityId,
    playRouteId,
    playRunId,
    recallQuestionId,
    revisitActivityId,
    playState: initialPlayState,
    progress,
}: NodePlayProps) {
    const { props } = usePage();
    const isAuthenticated = Boolean(props.auth.user);
    const { resolvedAppearance } = useAppearance();
    const translate = usePlatformTranslation();
    const initialActivity = useMemo(
        () => getActivityById(node, playActivityId) ?? getStartActivity(node),
        [node, playActivityId],
    );
    const [activeActivityId, setActiveActivityId] = useState<number | null>(
        initialActivity?.id ?? null,
    );
    const [answerProgress, setAnswerProgress] = useState(progress.answers);
    const [recallQuestionIds, setRecallQuestionIds] = useState(
        progress.recallQuestionIds,
    );
    const [activityProgress, setActivityProgress] = useState(
        progress.activities,
    );
    const [activityPlayState, setActivityPlayState] =
        useState(initialPlayState);
    const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
    const [isBookmarking, setIsBookmarking] = useState(false);
    const [pendingLearningCheckIn, setPendingLearningCheckIn] =
        useState<PendingLearningCheckIn | null>(null);
    const [hiddenCheckInActivityId, setHiddenCheckInActivityId] = useState<
        number | null
    >(null);
    const pendingLearningCheckInRef = useRef<PendingLearningCheckIn | null>(
        null,
    );
    const [travelBlockedMessage, setTravelBlockedMessage] = useState('');
    const [activityTranslation, setActivityTranslation] = useState<{
        activityId: number;
        translation: LearningActivityTranslation | null;
    } | null>(null);
    const activeActivity = useMemo(
        () => getActivityById(node, activeActivityId),
        [activeActivityId, node],
    );
    const displayedActivity = useMemo(
        () =>
            activeActivity
                ? applyActivityTranslation(
                      activeActivity,
                      activityTranslation?.activityId === activeActivity.id
                          ? activityTranslation.translation
                          : null,
                  )
                : null,
        [activeActivity, activityTranslation],
    );

    useEffect(() => {
        if (!activeActivity) {
            return;
        }

        persistActiveActivity(node, activeActivity, { useCleanPlayHref: true });
        replacePlayUrl(
            node.id,
            activeActivity.id,
            activeActivity.question?.id === recallQuestionId
                ? recallQuestionId
                : null,
        );

        if (isAuthenticated) {
            void postJson(
                `/learning/activities/${activeActivity.id}/progress`,
                {
                    play_run_id: playRunId,
                    status: 'reached',
                },
            )
                .then(async () => {
                    if (!playRunId) {
                        return;
                    }

                    const response = await getJson<{
                        translation: LearningActivityTranslation | null;
                    }>(
                        `/learning/activities/${activeActivity.id}/translation?play_run_id=${encodeURIComponent(playRunId)}`,
                    );

                    setActivityTranslation({
                        activityId: activeActivity.id,
                        translation: response.translation,
                    });
                })
                // English has no alternate payload, and a stale request may no
                // longer match the active activity. Both should keep source copy.
                .catch(() => undefined);
        }
    }, [activeActivity, isAuthenticated, node, playRunId, recallQuestionId]);

    const returnToMap = useCallback(() => {
        router.visit(
            `/world?map=${encodeURIComponent(node.mapSlug)}&focused=${encodeURIComponent(node.slug)}`,
        );
    }, [node.mapSlug, node.slug]);

    const toggleBookmark = useCallback(async () => {
        if (!isAuthenticated || isBookmarking) {
            return;
        }

        setIsBookmarking(true);

        try {
            const response = isBookmarked
                ? await deleteJson<{ bookmarked: boolean }>(
                      `/learning/nodes/${node.id}/bookmark`,
                  )
                : await postJson<{ bookmarked: boolean }>(
                      `/learning/nodes/${node.id}/bookmark`,
                      {},
                  );

            setIsBookmarked(response.bookmarked);
        } finally {
            setIsBookmarking(false);
        }
    }, [isAuthenticated, isBookmarked, isBookmarking, node.id]);
    const originTopicSlug = node.topic?.slug ?? null;

    const markCompleted = useCallback(
        async (activity: LearningActivity, options: CompletionOptions = {}) => {
            // Clear the persisted resume affordance before the optional
            // check-in so completed work does not follow the learner around
            // the desk and map.
            clearPersistedActiveActivity();

            if (!isAuthenticated) {
                setActivityProgress((current) => ({
                    ...current,
                    [activity.id]: {
                        completedAt: new Date().toISOString(),
                        status: 'completed',
                    },
                }));
                setActivityPlayState((current) =>
                    withoutActivityPlayState(current, activity.id),
                );

                return;
            }

            if (options.progressAlreadyMarked) {
                const completedAt = new Date().toISOString();

                setActivityProgress((current) => ({
                    ...current,
                    [activity.id]: {
                        ...current[activity.id],
                        completedAt,
                        status: 'completed',
                    },
                }));
                setActivityPlayState((current) =>
                    withoutActivityPlayState(current, activity.id),
                );
            }

            const payload: {
                confidence?: QuestionConfidence;
                confidence_after_feedback?: QuestionConfidence;
                calibration?: QuestionCalibration;
                ends_route?: boolean;
                attempt_number?: number;
                assistance_level?: string;
                is_revisit: boolean;
                observed_cues?: string[];
                outcome?: ActivityCompletionOutcome;
                play_run_id: string | null;
                status: 'completed';
            } = {
                is_revisit: activity.id === revisitActivityId,
                play_run_id: playRunId,
                status: 'completed',
            };

            if (typeof options.endsRoute === 'boolean') {
                payload.ends_route = options.endsRoute;
            }

            if (options.confidence) {
                payload.confidence = options.confidence;
            }

            if (options.confidenceAfterFeedback) {
                payload.confidence_after_feedback =
                    options.confidenceAfterFeedback;
            }

            if (options.calibration) {
                payload.calibration = options.calibration;
            }

            if (options.attemptNumber) {
                payload.attempt_number = options.attemptNumber;
            }

            if (options.assistanceLevel) {
                payload.assistance_level = options.assistanceLevel;
            }

            if (options.outcome) {
                payload.outcome = options.outcome;
            }

            if (options.observedCues?.length) {
                payload.observed_cues = options.observedCues;
            }

            if (!options.progressAlreadyMarked) {
                const response = await postJson<{
                    progress: LearningProgress['activities'][number] & {
                        activityId: number;
                    };
                }>(`/learning/activities/${activity.id}/progress`, payload);

                setActivityProgress((current) => ({
                    ...current,
                    [response.progress.activityId]: {
                        completedAt: response.progress.completedAt,
                        metadata: response.progress.metadata,
                        status: response.progress.status,
                    },
                }));
                setActivityPlayState((current) =>
                    withoutActivityPlayState(current, activity.id),
                );
            }

            const checkIn: PendingLearningCheckIn = {
                activityId: activity.id,
                activityTitle: activity.title,
                choicePrompt: activity.completionChoicePrompt,
                destination: null,
                learningAreas: learningAreaNames(activity),
                originTopicSlug,
            } satisfies PendingLearningCheckIn;
            pendingLearningCheckInRef.current = checkIn;
            setHiddenCheckInActivityId(null);
            setPendingLearningCheckIn(checkIn);
        },
        [isAuthenticated, originTopicSlug, playRunId, revisitActivityId],
    );

    const moveToActivity = useCallback(
        (activityId: number | null) => {
            setTravelBlockedMessage('');

            if (pendingLearningCheckInRef.current) {
                const checkIn: PendingLearningCheckIn = {
                    ...pendingLearningCheckInRef.current,
                    destination: { kind: 'activity', activityId },
                } satisfies PendingLearningCheckIn;
                pendingLearningCheckInRef.current = checkIn;
                setPendingLearningCheckIn(checkIn);

                return;
            }

            if (!activityId) {
                if (activeActivity) {
                    void markCompleted(activeActivity, {
                        endsRoute: true,
                    }).finally(returnToMap);
                } else {
                    returnToMap();
                }

                return;
            }

            setActiveActivityId(activityId);
        },
        [activeActivity, markCompleted, returnToMap],
    );

    const restartFromBeginning = useCallback(async () => {
        if (!playRouteId) {
            setActiveActivityId(getStartActivity(node)?.id ?? null);

            return;
        }

        const response = await postJson<{ url: string }>(
            `/learning/activity-starts/${playRouteId}/restart`,
            {},
        );

        router.visit(response.url);
    }, [node, playRouteId]);

    const updateAnswer = useCallback(
        (questionId: number, answer: QuestionAnswerProgress) => {
            setAnswerProgress((current) => ({
                ...current,
                [questionId]: answer,
            }));
        },
        [],
    );

    const updateRecallQuestion = useCallback(
        (questionId: number, queued: boolean) => {
            setRecallQuestionIds((current) =>
                queued
                    ? current.includes(questionId)
                        ? current
                        : [...current, questionId]
                    : current.filter((id) => id !== questionId),
            );
        },
        [],
    );

    const travel = useCallback((portalLink: LearningPortalLink) => {
        if (
            portalLink.targetNodeState === 'locked' ||
            portalLink.targetNodeState === 'hidden'
        ) {
            setTravelBlockedMessage(
                portalLink.targetNodeState === 'locked'
                    ? `${portalLink.targetNodeTitle} is still locked.`
                    : `${portalLink.targetNodeTitle} has not been discovered yet.`,
            );

            return;
        }

        setTravelBlockedMessage('');

        if (pendingLearningCheckInRef.current) {
            const checkIn: PendingLearningCheckIn = {
                ...pendingLearningCheckInRef.current,
                destination: { kind: 'portal', portalLink },
            } satisfies PendingLearningCheckIn;
            pendingLearningCheckInRef.current = checkIn;
            setPendingLearningCheckIn(checkIn);

            return;
        }

        const activityQuery = portalLink.targetActivityId
            ? `?activity=${portalLink.targetActivityId}`
            : '';

        router.visit(
            `/learning/nodes/${portalLink.targetNodeId}/play${activityQuery}`,
        );
    }, []);

    const continueAfterCheckIn = useCallback(
        async (
            feeling: LearningCheckInFeeling | null,
            note: string,
            nextDirection: LearningCheckInNextDirection | null,
        ) => {
            const checkIn = pendingLearningCheckInRef.current;

            if (!checkIn) {
                return;
            }

            if (feeling || note.trim() || nextDirection) {
                const response = await postJson<{
                    progress: LearningProgress['activities'][number] & {
                        activityId: number;
                    };
                }>(`/learning/activities/${checkIn.activityId}/check-in`, {
                    feeling,
                    note: note.trim() || null,
                    next_direction: nextDirection,
                });

                setActivityProgress((current) => ({
                    ...current,
                    [response.progress.activityId]: {
                        completedAt: response.progress.completedAt,
                        metadata: response.progress.metadata,
                        status: response.progress.status,
                    },
                }));
            }

            pendingLearningCheckInRef.current = null;
            setPendingLearningCheckIn(null);

            const destination = checkIn.destination;

            if (!destination || destination.kind === 'activity') {
                if (destination?.activityId) {
                    setActiveActivityId(destination.activityId);
                } else {
                    returnToMap();
                }

                return;
            }

            const activityQuery = destination.portalLink.targetActivityId
                ? `?activity=${destination.portalLink.targetActivityId}`
                : '';

            router.visit(
                `/learning/nodes/${destination.portalLink.targetNodeId}/play${activityQuery}`,
            );
        },
        [returnToMap],
    );

    const mapHref = `/world?map=${encodeURIComponent(node.mapSlug)}&focused=${encodeURIComponent(node.slug)}`;
    const activeRouteLabel = playRouteId
        ? node.startRoutes.find((route) => route.id === playRouteId)?.label
        : null;
    const navigationItems: LearnerNavigationItem[] =
        createLearnerPrimaryNavigation(translate);

    appendLearnerContextNavigation(translate, navigationItems, {
        continueActive: true,
        continueHref:
            typeof window === 'undefined' ? mapHref : window.location.href,
        currentMapHref: mapHref,
    });

    return (
        <>
            <Head title={`${node.title} activities`} />
            <main
                id="learner-main-content"
                tabIndex={-1}
                className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--learner-page-background)] text-[var(--learner-heading-text)]"
                data-world-appearance={resolvedAppearance}
            >
                <LearnerNavigationHeader items={navigationItems} />

                <section className="mx-auto grid min-h-0 w-full flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 px-3 pt-3 pb-6 sm:px-4 sm:pt-4 md:w-[85vw] md:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)] md:grid-rows-1 md:px-6 md:pt-6">
                    <aside
                        aria-label="Learning context"
                        className="flex min-h-0 flex-col rounded-lg border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] p-4"
                    >
                        <p className="text-xs font-medium tracking-[0.16em] text-[var(--learner-action-accent)] uppercase">
                            Learning context
                        </p>
                        <h1 className="mt-2 text-base font-semibold text-[var(--learner-heading-text)]">
                            {node.title}
                        </h1>
                        <dl className="mt-5 space-y-4 border-t border-[var(--learner-border-color)] pt-4">
                            {node.topic ? (
                                <div>
                                    <dt className="text-xs font-medium tracking-[0.12em] text-[var(--learner-muted-text)] uppercase">
                                        Topic
                                    </dt>
                                    <dd className="mt-1 text-sm">
                                        <Link
                                            className="text-[var(--learner-accent)] underline decoration-[color-mix(in_srgb,var(--learner-accent)_40%,transparent)] underline-offset-2 transition hover:text-[var(--learner-heading-text)]"
                                            href={node.topic.href}
                                        >
                                            {node.topic.title}
                                        </Link>
                                    </dd>
                                </div>
                            ) : null}
                            <div>
                                <dt className="text-xs font-medium tracking-[0.12em] text-[var(--learner-muted-text)] uppercase">
                                    Map
                                </dt>
                                <dd className="mt-1 text-sm text-[var(--learner-body-text)]">
                                    <Link
                                        className="transition hover:text-[var(--learner-heading-text)]"
                                        href={mapHref}
                                    >
                                        {node.mapTitle}
                                    </Link>
                                </dd>
                            </div>
                            {activeRouteLabel ? (
                                <div>
                                    <dt className="text-xs font-medium tracking-[0.12em] text-[var(--learner-muted-text)] uppercase">
                                        Route
                                    </dt>
                                    <dd className="mt-1 text-sm text-[var(--learner-action-accent)]">
                                        {activeRouteLabel}
                                    </dd>
                                </div>
                            ) : null}
                        </dl>
                        {isAuthenticated ? (
                            <Button
                                aria-pressed={isBookmarked}
                                className="mt-auto w-full"
                                disabled={isBookmarking}
                                onClick={() => void toggleBookmark()}
                                size="sm"
                                type="button"
                                variant="outline"
                            >
                                <Bookmark
                                    className={
                                        isBookmarked
                                            ? 'fill-current'
                                            : undefined
                                    }
                                />
                                {isBookmarked
                                    ? 'Remove place bookmark'
                                    : 'Bookmark this place'}
                            </Button>
                        ) : null}
                    </aside>

                    <div className="relative flex min-h-0 min-w-0 flex-col">
                        {travelBlockedMessage ? (
                            <p
                                aria-live="polite"
                                className="mb-3 rounded-lg border border-amber-400/40 bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100"
                            >
                                {travelBlockedMessage}
                            </p>
                        ) : null}

                        {pendingLearningCheckIn &&
                        hiddenCheckInActivityId !==
                            pendingLearningCheckIn.activityId ? (
                            <div className="absolute inset-0 z-30 overflow-hidden rounded-lg shadow-2xl">
                                <LearningCheckIn
                                    activityTitle={
                                        pendingLearningCheckIn.activityTitle
                                    }
                                    choicePrompt={
                                        pendingLearningCheckIn.choicePrompt
                                    }
                                    learningAreas={
                                        pendingLearningCheckIn.learningAreas
                                    }
                                    originTopicSlug={
                                        pendingLearningCheckIn.originTopicSlug
                                    }
                                    onContinue={continueAfterCheckIn}
                                    onHide={() =>
                                        setHiddenCheckInActivityId(
                                            pendingLearningCheckIn.activityId,
                                        )
                                    }
                                />
                            </div>
                        ) : null}

                        {pendingLearningCheckIn &&
                        hiddenCheckInActivityId ===
                            pendingLearningCheckIn.activityId ? (
                            <Button
                                className="absolute top-3 right-3 z-30 shadow-lg"
                                onClick={() => setHiddenCheckInActivityId(null)}
                                size="sm"
                                type="button"
                                variant="outline"
                            >
                                Show conclusion
                            </Button>
                        ) : null}

                        {displayedActivity ? (
                            <ActivityPlayer
                                activity={displayedActivity}
                                activityProgress={activityProgress}
                                answerProgress={answerProgress}
                                canRecall={isAuthenticated}
                                node={node}
                                onAnswer={updateAnswer}
                                onRecallChange={updateRecallQuestion}
                                recallQuestionIds={recallQuestionIds}
                                onComplete={markCompleted}
                                isRevisit={
                                    displayedActivity.id === revisitActivityId
                                }
                                isRecall={
                                    displayedActivity.question?.id ===
                                    recallQuestionId
                                }
                                onMoveToActivity={moveToActivity}
                                onRestart={() => void restartFromBeginning()}
                                playState={activityPlayState}
                                playRunId={playRunId}
                                onTravel={travel}
                            />
                        ) : (
                            <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center dark:border-white/15 dark:bg-white/6">
                                <div>
                                    <p className="text-base font-semibold">
                                        No activity path configured
                                    </p>
                                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                        This node exists, but an admin has not
                                        added a playable activity yet.
                                    </p>
                                    <Button
                                        className="mt-5"
                                        onClick={returnToMap}
                                        type="button"
                                    >
                                        Back to map
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </>
    );
}

function withoutActivityPlayState(
    playState: Record<string, unknown>,
    activityId: number,
): Record<string, unknown> {
    const key = activityId.toString();

    if (!(key in playState)) {
        return playState;
    }

    const nextPlayState = { ...playState };
    delete nextPlayState[key];

    return nextPlayState;
}

function replacePlayUrl(
    nodeId: number,
    activityId: number,
    recallQuestionId: number | null,
) {
    const href =
        recallQuestionId === null
            ? `/learning/nodes/${nodeId}/play`
            : `/learning/nodes/${nodeId}/play?activity_id=${activityId}&recall_question=${recallQuestionId}`;

    window.history.replaceState(window.history.state, '', href);
}

function getStartActivity(node: LearningNode): LearningActivity | null {
    return (
        getActivityById(node, node.startRoutes[0]?.activityId ?? null) ??
        node.activities.find(
            (activity) => activity.id === node.startActivityId,
        ) ??
        node.activities[0] ??
        null
    );
}

function getActivityById(
    node: LearningNode,
    activityId: number | null,
): LearningActivity | null {
    if (!activityId) {
        return null;
    }

    return (
        node.activities.find((activity) => activity.id === activityId) ?? null
    );
}
