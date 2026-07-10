import { Head, router, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { persistActiveActivity } from '@/features/world/active-activity';
import { ActivityPlayer } from '@/features/world/activity-panel';
import { postJson } from '@/features/world/api';
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
    progress: LearningProgress;
};

export default function NodePlay({ node, progress }: NodePlayProps) {
    const { url } = usePage();
    const { resolvedAppearance } = useAppearance();
    const urlActivityId = useMemo(() => {
        const raw = new URL(url, 'http://learning.local').searchParams.get(
            'activity',
        );
        const parsed = raw ? Number(raw) : null;

        return parsed && Number.isFinite(parsed) ? parsed : null;
    }, [url]);
    const initialActivity = useMemo(
        () => getActivityById(node, urlActivityId) ?? getStartActivity(node),
        [node, urlActivityId],
    );
    const [activeActivityId, setActiveActivityId] = useState<number | null>(
        initialActivity?.id ?? null,
    );
    const [answerProgress, setAnswerProgress] = useState(progress.answers);
    const [activityProgress, setActivityProgress] = useState(
        progress.activities,
    );
    const activeActivity = useMemo(
        () => getActivityById(node, activeActivityId),
        [activeActivityId, node],
    );

    useEffect(() => {
        if (!activeActivity) {
            return;
        }

        persistActiveActivity(node, activeActivity);

        void postJson(`/learning/activities/${activeActivity.id}/progress`, {
            status: 'reached',
        }).catch(() => undefined);
    }, [activeActivity, node]);

    const returnToMap = useCallback(() => {
        router.visit(
            `/world?map=${encodeURIComponent(node.mapSlug)}&focused=${encodeURIComponent(node.slug)}`,
        );
    }, [node.mapSlug, node.slug]);

    const markCompleted = useCallback(async (activity: LearningActivity) => {
        const response = await postJson<{
            progress: LearningProgress['activities'][number] & {
                activityId: number;
            };
        }>(`/learning/activities/${activity.id}/progress`, {
            status: 'completed',
        });

        setActivityProgress((current) => ({
            ...current,
            [response.progress.activityId]: {
                completedAt: response.progress.completedAt,
                metadata: response.progress.metadata,
                status: response.progress.status,
            },
        }));
    }, []);

    const moveToActivity = useCallback(
        (activityId: number | null) => {
            if (!activityId) {
                returnToMap();

                return;
            }

            setActiveActivityId(activityId);
        },
        [returnToMap],
    );

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
                    <div className="min-w-0 text-right">
                        <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                            {node.mapTitle}
                        </p>
                        <h1 className="truncate text-base font-semibold">
                            {node.title}
                        </h1>
                    </div>
                </header>

                <section className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 pt-4 pb-24 md:px-6 md:pt-6 md:pb-28">
                    {activeActivity ? (
                        <ActivityPlayer
                            activity={activeActivity}
                            activityProgress={activityProgress}
                            answerProgress={answerProgress}
                            node={node}
                            onAnswer={updateAnswer}
                            onComplete={markCompleted}
                            onMoveToActivity={moveToActivity}
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
