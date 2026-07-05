import { Head, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { persistActiveActivity } from '@/features/world/active-activity';
import { ActivityPanel } from '@/features/world/activity-panel';
import { postJson } from '@/features/world/api';
import { resolveThemeVariant } from '@/features/world/theme';
import { worldHref } from '@/features/world/types';
import { WorldMap } from '@/features/world/world-map';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import type {
    LearningActivity,
    LearningMap,
    LearningNode,
    LearningPortalLink,
    LearningProgress,
    LearningWorld,
} from '@/types';

type WorldProps = {
    world: LearningWorld | null;
    progress: LearningProgress;
};

type PanelSwipe = {
    isDragging: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
};

export default function World({ world, progress }: WorldProps) {
    const { url } = usePage();
    const { resolvedAppearance } = useAppearance();
    const mapSlug = useMemo(
        () => new URL(url, 'http://learning.local').searchParams.get('map'),
        [url],
    );
    const urlMap = useMemo(() => findMap(world, mapSlug), [mapSlug, world]);
    const [currentMapId, setCurrentMapId] = useState<number | null>(
        urlMap?.id ?? world?.maps[0]?.id ?? null,
    );
    const map = useMemo(
        () =>
            world?.maps.find((candidate) => candidate.id === currentMapId) ??
            urlMap ??
            world?.maps[0] ??
            null,
        [currentMapId, urlMap, world],
    );
    const mapTheme = map
        ? resolveThemeVariant(map.backgroundConfig, resolvedAppearance)
        : null;
    const focusedNodeSlug = useMemo(
        () => new URL(url, 'http://learning.local').searchParams.get('focused'),
        [url],
    );
    const focusedNode = useMemo(() => {
        if (!map || !focusedNodeSlug) {
            return null;
        }

        return (
            map.nodes.find(
                (node) =>
                    node.slug === focusedNodeSlug ||
                    node.id.toString() === focusedNodeSlug,
            ) ?? null
        );
    }, [focusedNodeSlug, map]);
    const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
    const [activeActivityId, setActiveActivityId] = useState<number | null>(
        null,
    );
    const [panelSwipe, setPanelSwipe] = useState<PanelSwipe | null>(null);
    const [activityProgress, setActivityProgress] = useState(
        progress.activities,
    );
    const [answerProgress, setAnswerProgress] = useState(progress.answers);

    const selectedNode = useMemo(() => {
        if (!map) {
            return null;
        }

        return map.nodes.find((node) => node.id === selectedNodeId) ?? null;
    }, [map, selectedNodeId]);

    const activeActivity = useMemo(() => {
        if (!selectedNode) {
            return null;
        }

        return (
            selectedNode.activities.find(
                (activity) => activity.id === activeActivityId,
            ) ??
            selectedNode.activities.find(
                (activity) => activity.id === selectedNode.startActivityId,
            ) ??
            selectedNode.activities[0] ??
            null
        );
    }, [activeActivityId, selectedNode]);

    useEffect(() => {
        if (!activeActivity) {
            return;
        }

        void postJson(`/learning/activities/${activeActivity.id}/progress`, {
            status: 'reached',
        }).catch(() => undefined);
    }, [activeActivity]);

    useEffect(() => {
        if (!activeActivity || !selectedNode) {
            return;
        }

        persistActiveActivity(selectedNode, activeActivity);
    }, [activeActivity, selectedNode]);

    useEffect(() => {
        if (!focusedNodeSlug) {
            return;
        }

        if (
            !focusedNode ||
            focusedNode.state === 'locked' ||
            focusedNode.state === 'hidden'
        ) {
            clearFocusedQueryParam();

            return;
        }

        const firstActivity = getStartActivity(focusedNode);
        const animationFrame = window.requestAnimationFrame(() => {
            setSelectedNodeId(focusedNode.id);
            setActiveActivityId(firstActivity?.id ?? null);
            setPanelSwipe(null);
        });

        return () => window.cancelAnimationFrame(animationFrame);
    }, [focusedNode, focusedNodeSlug]);

    const openNode = useCallback((node: LearningNode) => {
        if (node.state === 'locked' || node.state === 'hidden') {
            return;
        }

        const firstActivity = getStartActivity(node);

        persistActiveActivity(node, firstActivity);
        setSelectedNodeId(node.id);
        setActiveActivityId(firstActivity?.id ?? null);
    }, []);
    const clearNodeFocus = useCallback(() => {
        setSelectedNodeId(null);
        setActiveActivityId(null);
        setPanelSwipe(null);
        clearFocusedQueryParam();
    }, []);

    const travelToPortal = useCallback(
        (portalLink: LearningPortalLink) => {
            const targetMap = world?.maps.find(
                (candidate) => candidate.id === portalLink.targetMapId,
            );
            const targetNode =
                targetMap?.nodes.find(
                    (candidate) =>
                        candidate.id === portalLink.targetNodeId ||
                        candidate.slug === portalLink.targetNodeSlug,
                ) ?? null;

            if (
                !targetMap ||
                !targetNode ||
                targetNode.state === 'locked' ||
                targetNode.state === 'hidden'
            ) {
                return;
            }

            const firstActivity = getStartActivity(targetNode);

            setCurrentMapId(targetMap.id);
            setSelectedNodeId(targetNode.id);
            setActiveActivityId(firstActivity?.id ?? null);
            setPanelSwipe(null);
            persistActiveActivity(targetNode, firstActivity);
            replaceWorldQuery({
                focused: targetNode.slug,
                map: targetMap.slug,
            });
        },
        [world],
    );

    if (!world || !map) {
        return (
            <>
                <Head title="World" />
                <main className="flex min-h-[70vh] flex-col justify-center gap-3 p-6">
                    <p className="text-sm text-muted-foreground">
                        No learning world has been seeded yet.
                    </p>
                    <p className="max-w-xl text-2xl font-semibold">
                        Run the demo seeder to create the first explorable map.
                    </p>
                </main>
            </>
        );
    }

    const moveToActivity = (activityId: number | null) => {
        if (activityId) {
            const nextActivity =
                selectedNode?.activities.find(
                    (activity) => activity.id === activityId,
                ) ?? null;

            if (selectedNode) {
                persistActiveActivity(selectedNode, nextActivity);
            }

            setActiveActivityId(activityId);
        }
    };

    const markCompleted = async (activity: LearningActivity) => {
        const response = await postJson<{
            progress: {
                activityId: number;
                status: string;
                completedAt: string | null;
            };
        }>(`/learning/activities/${activity.id}/progress`, {
            status: 'completed',
        });

        setActivityProgress((current) => ({
            ...current,
            [response.progress.activityId]: {
                status: response.progress.status,
                completedAt: response.progress.completedAt,
            },
        }));
    };

    return (
        <>
            <Head title={world.title} />
            <main
                className="relative min-h-svh overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100"
                data-world-appearance={resolvedAppearance}
                style={{
                    background: mapTheme?.pageBackground,
                    color: mapTheme?.sidePanelTextColor,
                }}
            >
                <section className="absolute inset-0 overflow-hidden">
                    <WorldMap
                        map={map}
                        mode={resolvedAppearance}
                        selectedNode={selectedNode}
                        activityProgress={activityProgress}
                        onClearFocus={clearNodeFocus}
                        onSelectNode={openNode}
                    />
                </section>

                <aside
                    className={cn(
                        'absolute inset-0 z-30 w-full touch-pan-y border-l border-slate-200 bg-white text-slate-950 shadow-2xl transition-transform duration-300 ease-out md:left-auto md:max-w-[420px] dark:border-white/10 dark:bg-[#111820] dark:text-slate-100',
                        selectedNode
                            ? 'translate-x-0'
                            : 'pointer-events-none translate-x-full',
                        panelSwipe?.isDragging && 'transition-none',
                    )}
                    onPointerCancel={() => setPanelSwipe(null)}
                    onPointerDown={(event) => {
                        if (
                            event.pointerType === 'mouse' ||
                            event.button !== 0
                        ) {
                            return;
                        }

                        setPanelSwipe({
                            isDragging: false,
                            pointerId: event.pointerId,
                            startX: event.clientX,
                            startY: event.clientY,
                            offsetX: 0,
                        });
                    }}
                    onPointerMove={(event) => {
                        if (
                            !panelSwipe ||
                            panelSwipe.pointerId !== event.pointerId
                        ) {
                            return;
                        }

                        const deltaX = event.clientX - panelSwipe.startX;
                        const deltaY = event.clientY - panelSwipe.startY;
                        const isHorizontalSwipe =
                            Math.abs(deltaX) > 12 &&
                            Math.abs(deltaX) > Math.abs(deltaY) * 1.25;

                        if (!panelSwipe.isDragging && !isHorizontalSwipe) {
                            return;
                        }

                        event.preventDefault();

                        setPanelSwipe({
                            ...panelSwipe,
                            isDragging: true,
                            offsetX: Math.max(0, deltaX),
                        });
                    }}
                    onPointerUp={(event) => {
                        if (
                            !panelSwipe ||
                            panelSwipe.pointerId !== event.pointerId
                        ) {
                            return;
                        }

                        if (panelSwipe.offsetX > 96) {
                            clearNodeFocus();
                        } else {
                            setPanelSwipe(null);
                        }
                    }}
                    style={{
                        background: mapTheme?.sidePanelBackground,
                        borderColor: mapTheme?.sidePanelBorderColor,
                        color: mapTheme?.sidePanelTextColor,
                        transform:
                            selectedNode && panelSwipe?.offsetX
                                ? `translateX(${panelSwipe.offsetX}px)`
                                : undefined,
                    }}
                >
                    <ActivityPanel
                        activity={activeActivity}
                        answerProgress={answerProgress}
                        node={selectedNode}
                        onAnswer={(questionId, answer) =>
                            setAnswerProgress((current) => ({
                                ...current,
                                [questionId]: answer,
                            }))
                        }
                        onClose={clearNodeFocus}
                        onComplete={markCompleted}
                        onMoveToActivity={moveToActivity}
                        onTravel={travelToPortal}
                    />
                </aside>
            </main>
        </>
    );
}

World.layout = {
    breadcrumbs: [
        {
            title: 'World',
            href: worldHref,
        },
    ],
};

function findMap(
    world: LearningWorld | null,
    mapSlug: string | null,
): LearningMap | null {
    if (!world || !mapSlug) {
        return null;
    }

    return (
        world.maps.find(
            (map) => map.slug === mapSlug || map.id.toString() === mapSlug,
        ) ?? null
    );
}

function getStartActivity(node: LearningNode): LearningActivity | null {
    return (
        node.activities.find(
            (activity) => activity.id === node.startActivityId,
        ) ??
        node.activities[0] ??
        null
    );
}

function replaceWorldQuery(params: { focused?: string; map?: string }): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);

    if (params.map) {
        url.searchParams.set('map', params.map);
    }

    if (params.focused) {
        url.searchParams.set('focused', params.focused);
    }

    window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`,
    );
}

function clearFocusedQueryParam(): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);

    if (!url.searchParams.has('focused')) {
        return;
    }

    url.searchParams.delete('focused');
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;

    window.history.replaceState(window.history.state, '', nextUrl);
}
