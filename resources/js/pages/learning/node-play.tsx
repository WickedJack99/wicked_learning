import { Head, router, usePage } from '@inertiajs/react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { persistActiveActivity } from '@/features/world/active-activity';
import { ActivityPlayer } from '@/features/world/activity-panel';
import { getJson, postJson } from '@/features/world/api';
import {
    applyActivityTranslation,
    type LearningActivityTranslation,
} from '@/features/localization/activity-translation';
import { useAppearance } from '@/hooks/use-appearance';
import type {
    LearningActivity,
    LearningNode,
    LearningPortalLink,
    LearningProgress,
    QuestionAnswerProgress,
} from '@/types';

type NodePlayProps = {
    node: LearningNode;
    playActivityId: number | null;
    playRouteId: number | null;
    playRunId: string | null;
    playState: Record<string, unknown>;
    progress: LearningProgress;
};

type CompletionOptions = {
    endsRoute?: boolean;
};

export default function NodePlay({
    node,
    playActivityId,
    playRouteId,
    playRunId,
    playState: initialPlayState,
    progress,
}: NodePlayProps) {
    const { props } = usePage();
    const isAuthenticated = Boolean(props.auth.user);
    const { resolvedAppearance } = useAppearance();
    const initialActivity = useMemo(
        () => getActivityById(node, playActivityId) ?? getStartActivity(node),
        [node, playActivityId],
    );
    const [activeActivityId, setActiveActivityId] = useState<number | null>(
        initialActivity?.id ?? null,
    );
    const [answerProgress, setAnswerProgress] = useState(progress.answers);
    const [activityProgress, setActivityProgress] = useState(
        progress.activities,
    );
    const [activityPlayState, setActivityPlayState] =
        useState(initialPlayState);
    const [travelBlockedMessage, setTravelBlockedMessage] = useState('');
    const [activityTranslation, setActivityTranslation] =
        useState<LearningActivityTranslation | null>(null);
    const activeActivity = useMemo(
        () => getActivityById(node, activeActivityId),
        [activeActivityId, node],
    );
    const displayedActivity = useMemo(
        () =>
            activeActivity
                ? applyActivityTranslation(activeActivity, activityTranslation)
                : null,
        [activeActivity, activityTranslation],
    );

    useEffect(() => {
        setActivityTranslation(null);

        if (!activeActivity) {
            return;
        }

        persistActiveActivity(node, activeActivity, { useCleanPlayHref: true });
        replacePlayUrl(node.id);

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

                    setActivityTranslation(response.translation);
                })
                // English has no alternate payload, and a stale request may no
                // longer match the active activity. Both should keep source copy.
                .catch(() => undefined);
        }
    }, [activeActivity, isAuthenticated, node, playRunId]);

    const returnToMap = useCallback(() => {
        router.visit(
            `/world?map=${encodeURIComponent(node.mapSlug)}&focused=${encodeURIComponent(node.slug)}`,
        );
    }, [node.mapSlug, node.slug]);

    const markCompleted = useCallback(
        async (
            activity: LearningActivity,
            options: CompletionOptions = {},
        ) => {
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

            const payload: {
                ends_route?: boolean;
                play_run_id: string | null;
                status: 'completed';
            } = {
                play_run_id: playRunId,
                status: 'completed',
            };

            if (typeof options.endsRoute === 'boolean') {
                payload.ends_route = options.endsRoute;
            }

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
        },
        [isAuthenticated, playRunId],
    );

    const markReached = useCallback(
        (activity: LearningActivity) => {
            persistActiveActivity(node, activity, { useCleanPlayHref: true });
            replacePlayUrl(node.id);

            if (!isAuthenticated) {
                return;
            }

            void postJson(`/learning/activities/${activity.id}/progress`, {
                play_run_id: playRunId,
                status: 'reached',
            }).catch(() => undefined);
        },
        [isAuthenticated, node, playRunId],
    );

    const moveToActivity = useCallback(
        (activityId: number | null) => {
            setTravelBlockedMessage('');

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

            const nextActivity = getActivityById(node, activityId);

            if (nextActivity) {
                markReached(nextActivity);
            }

            setActiveActivityId(activityId);
        },
        [activeActivity, markCompleted, markReached, node, returnToMap],
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

        const activityQuery = portalLink.targetActivityId
            ? `?activity=${portalLink.targetActivityId}`
            : '';

        router.visit(
            `/learning/nodes/${portalLink.targetNodeId}/play${activityQuery}`,
        );
    }, []);

    return (
        <>
            <Head title={`${node.title} activities`} />
            <main
                className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100"
                data-world-appearance={resolvedAppearance}
            >
                <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-950/80">
                    <Button onClick={returnToMap} type="button" variant="ghost">
                        <ArrowLeft className="size-4" />
                        Map
                    </Button>
                    <Button
                        onClick={() => void restartFromBeginning()}
                        type="button"
                        variant="ghost"
                    >
                        <RotateCcw className="size-4" />
                        From beginning
                    </Button>
                    <div className="min-w-0 text-right">
                        <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                            {node.mapTitle}
                        </p>
                        <h1 className="truncate text-base font-semibold">
                            {node.title}
                        </h1>
                    </div>
                </header>

                <section className="mx-auto flex min-h-0 w-full flex-1 flex-col px-4 pt-4 pb-24 md:w-[75vw] md:px-6 md:pt-6 md:pb-28">
                    {travelBlockedMessage ? (
                        <p className="mb-3 rounded-lg border border-amber-400/40 bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                            {travelBlockedMessage}
                        </p>
                    ) : null}

                    {displayedActivity ? (
                        <ActivityPlayer
                            activity={displayedActivity}
                            activityProgress={activityProgress}
                            answerProgress={answerProgress}
                            node={node}
                            onAnswer={updateAnswer}
                            onComplete={markCompleted}
                            onMoveToActivity={moveToActivity}
                            playState={activityPlayState}
                            playRunId={playRunId}
                            onTravel={travel}
                        />
                    ) : (
                        <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center dark:border-white/15 dark:bg-white/6">
                            <div>
                                <p className="text-lg font-semibold">
                                    No activity path configured
                                </p>
                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                    This node exists, but an admin has not added
                                    a playable activity yet.
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

function replacePlayUrl(nodeId: number) {
    window.history.replaceState(
        window.history.state,
        '',
        `/learning/nodes/${nodeId}/play`,
    );
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
