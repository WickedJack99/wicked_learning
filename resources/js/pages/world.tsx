import { Head, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    CheckCircle2,
    LockKeyhole,
    Map,
    MessageCircle,
    Orbit,
    PlayCircle,
    RadioTower,
    RotateCcw,
    X,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ElementType } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
    ActivityTransition,
    LearningActivity,
    LearningMap,
    LearningNode,
    LearningProgress,
    LearningWorld,
    QuestionAnswerProgress,
} from '@/types';

type WorldProps = {
    world: LearningWorld | null;
    progress: LearningProgress;
};

type TileStyle = CSSProperties & {
    '--tile-highlight': string;
    '--tile-cursor': string;
};

const HEX_TILE_CLIP_PATH =
    'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)';
const HEX_TILE_RING_CLIP_PATH =
    'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%, 25% 0, 25% 7%, 5% 50%, 28% 93%, 72% 93%, 95% 50%, 72% 7%, 25% 7%)';

const nodeIcons: Record<string, ElementType> = {
    bookOpen: BookOpen,
    lockKeyhole: LockKeyhole,
    orbit: Orbit,
    radioTower: RadioTower,
};

const worldHref = '/world';

export default function World({ world, progress }: WorldProps) {
    const { url } = usePage();
    const map = world?.maps[0] ?? null;
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
    const [selectedNodeId, setSelectedNodeId] = useState<number | null>(() =>
        focusedNode &&
        focusedNode.state !== 'locked' &&
        focusedNode.state !== 'hidden'
            ? focusedNode.id
            : null,
    );
    const [activeActivityId, setActiveActivityId] = useState<number | null>(
        () =>
            focusedNode?.startActivityId ??
            focusedNode?.activities[0]?.id ??
            null,
    );
    const [panelSwipe, setPanelSwipe] = useState<{
        isDragging: boolean;
        pointerId: number;
        startX: number;
        startY: number;
        offsetX: number;
    } | null>(null);
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

        window.localStorage.setItem(
            'learning.activeActivity',
            JSON.stringify({
                activityId: activeActivity.id,
                activityTitle: activeActivity.title,
                nodeSlug: selectedNode.slug,
                nodeTitle: selectedNode.title,
                worldHref: `${worldHref}?focused=${encodeURIComponent(selectedNode.slug)}`,
            }),
        );
        window.dispatchEvent(new Event('learning:active-activity-changed'));
    }, [activeActivity, selectedNode]);

    const openNode = useCallback((node: LearningNode) => {
        if (node.state === 'locked' || node.state === 'hidden') {
            return;
        }

        setSelectedNodeId(node.id);
        setActiveActivityId(
            node.startActivityId ?? node.activities[0]?.id ?? null,
        );
    }, []);
    const clearNodeFocus = useCallback(() => {
        setSelectedNodeId(null);
        setActiveActivityId(null);
        setPanelSwipe(null);
    }, []);

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
            <main className="relative min-h-svh overflow-hidden bg-[#0b1117] text-slate-100">
                <section className="absolute inset-0 overflow-hidden">
                    <WorldMap
                        map={map}
                        selectedNode={selectedNode}
                        activityProgress={activityProgress}
                        onClearFocus={clearNodeFocus}
                        onSelectNode={openNode}
                    />
                </section>

                <aside
                    className={cn(
                        'absolute inset-0 z-30 w-full touch-pan-y border-l border-white/10 bg-[#111820] shadow-2xl transition-transform duration-300 ease-out md:left-auto md:max-w-[420px]',
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

function WorldMap({
    activityProgress,
    map,
    onClearFocus,
    onSelectNode,
    selectedNode,
}: {
    activityProgress: LearningProgress['activities'];
    map: LearningMap;
    onClearFocus: () => void;
    onSelectNode: (node: LearningNode) => void;
    selectedNode: LearningNode | null;
}) {
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [drag, setDrag] = useState<{
        hasMoved: boolean;
        pointerId: number;
        startedNodeId: number | null;
        startedOnTile: boolean;
        startX: number;
        startY: number;
        x: number;
        y: number;
    } | null>(null);
    const suppressTileClick = useRef(false);
    const tileWidth = map.gridConfig.tileWidth ?? 132;
    const tileHeight = map.gridConfig.tileHeight ?? 116;
    const gap = map.gridConfig.gap ?? 12;
    const gapScale = (tileHeight + gap) / tileHeight;
    const horizontalStep = tileWidth * 0.75 * gapScale;
    const tilePositions = useMemo(
        () =>
            map.nodes.map((node) => ({
                node,
                x: node.position.q * horizontalStep,
                y:
                    (node.position.r * tileHeight +
                        node.position.q * (tileHeight / 2)) *
                    gapScale,
            })),
        [gapScale, horizontalStep, map.nodes, tileHeight],
    );
    const minimumX = Math.min(...tilePositions.map((tile) => tile.x));
    const minimumY = Math.min(...tilePositions.map((tile) => tile.y));
    const maximumX = Math.max(...tilePositions.map((tile) => tile.x));
    const maximumY = Math.max(...tilePositions.map((tile) => tile.y));
    const stagePadding = Math.max(gap * 2, 24);
    const stageWidth = maximumX - minimumX + tileWidth + stagePadding * 2;
    const stageHeight = maximumY - minimumY + tileHeight + stagePadding * 2;
    const tileLayouts = useMemo(
        () =>
            tilePositions.map(({ node, x, y }) => ({
                node,
                style: {
                    left: x - minimumX + stagePadding,
                    top: y - minimumY + stagePadding,
                    width: tileWidth,
                    height: tileHeight,
                },
            })),
        [
            minimumX,
            minimumY,
            stagePadding,
            tileHeight,
            tilePositions,
            tileWidth,
        ],
    );
    const mapCursor = drag
        ? (map.backgroundConfig.draggingCursor ?? 'default')
        : (map.backgroundConfig.cursor ?? 'default');

    return (
        <div
            className="relative h-full min-h-[56vh] touch-none overflow-hidden select-none"
            onPointerDown={(event) => {
                if (event.button !== 0) {
                    return;
                }

                const startedOnTile =
                    event.target instanceof Element
                        ? Boolean(event.target.closest('[data-hex-tile]'))
                        : false;
                const startedNodeId =
                    event.target instanceof Element
                        ? Number(
                              event.target
                                  .closest('[data-hex-tile-id]')
                                  ?.getAttribute('data-hex-tile-id') ?? null,
                          )
                        : null;

                suppressTileClick.current = false;
                event.currentTarget.setPointerCapture(event.pointerId);
                setDrag({
                    hasMoved: false,
                    pointerId: event.pointerId,
                    startedNodeId: Number.isFinite(startedNodeId)
                        ? startedNodeId
                        : null,
                    startedOnTile,
                    startX: event.clientX,
                    startY: event.clientY,
                    x: event.clientX,
                    y: event.clientY,
                });
            }}
            onPointerMove={(event) => {
                if (!drag || drag.pointerId !== event.pointerId) {
                    return;
                }

                if ((event.buttons & 1) !== 1) {
                    setDrag(null);

                    return;
                }

                const hasMoved =
                    drag.hasMoved ||
                    Math.abs(event.clientX - drag.startX) > 4 ||
                    Math.abs(event.clientY - drag.startY) > 4;

                if (hasMoved) {
                    suppressTileClick.current = true;
                }

                setPan((current) => ({
                    x: current.x + event.clientX - drag.x,
                    y: current.y + event.clientY - drag.y,
                }));
                setDrag({
                    hasMoved,
                    pointerId: event.pointerId,
                    startedNodeId: drag.startedNodeId,
                    startedOnTile: drag.startedOnTile,
                    startX: drag.startX,
                    startY: drag.startY,
                    x: event.clientX,
                    y: event.clientY,
                });
            }}
            onPointerCancel={() => setDrag(null)}
            onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }

                if (drag && !drag.hasMoved && !drag.startedOnTile) {
                    onClearFocus();
                }

                if (drag && !drag.hasMoved && drag.startedNodeId) {
                    const node = map.nodes.find(
                        (candidate) => candidate.id === drag.startedNodeId,
                    );

                    if (node) {
                        onSelectNode(node);
                    }
                }

                setDrag(null);
                window.setTimeout(() => {
                    suppressTileClick.current = false;
                }, 0);
            }}
            onLostPointerCapture={() => setDrag(null)}
            style={{ cursor: mapCursor }}
        >
            <div
                className="absolute inset-0 bg-cover bg-center transition-opacity"
                style={{
                    backgroundImage: `url(${map.backgroundConfig.imageUrl})`,
                }}
            />
            <div
                className="absolute inset-0"
                style={{
                    background:
                        map.backgroundConfig.overlay ?? 'rgba(0, 0, 0, 0.4)',
                }}
            />

            <div
                className="pointer-events-none absolute top-5 left-1/2 z-10 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-lg border border-white/10 p-4 text-left shadow-2xl backdrop-blur-md md:top-8 md:left-8 md:w-auto md:translate-x-0"
                style={{
                    background:
                        map.backgroundConfig.panelBackground ??
                        'rgba(5, 15, 22, 0.72)',
                }}
            >
                <div className="mb-3 flex items-center gap-2 text-sm text-teal-100/80">
                    <Map className="size-4" />
                    <span>Current map</span>
                </div>
                <h1 className="text-3xl font-semibold tracking-normal text-white md:text-5xl">
                    {map.title}
                </h1>
                {map.description ? (
                    <p className="mt-3 max-w-md text-sm leading-6 text-slate-200/82">
                        {map.description}
                    </p>
                ) : null}
            </div>

            <div
                className="absolute top-1/2 left-1/2"
                style={{
                    transform: `translate(calc(-50% + ${pan.x}px), calc(-45% + ${pan.y}px))`,
                    width: stageWidth,
                    height: stageHeight,
                }}
            >
                {tileLayouts.map(({ node, style }) => {
                    const isSelected = selectedNode?.id === node.id;
                    const hasCompletedActivity = node.activities.some(
                        (activity) =>
                            activityProgress[activity.id]?.status ===
                            'completed',
                    );

                    return (
                        <HexTile
                            isCompleted={hasCompletedActivity}
                            isSelected={isSelected}
                            key={node.id}
                            node={node}
                            onSelectNode={onSelectNode}
                            shouldSuppressClick={() =>
                                suppressTileClick.current
                            }
                            style={style}
                            tileCursor={
                                map.backgroundConfig.tileCursor ?? 'pointer'
                            }
                        />
                    );
                })}
            </div>
        </div>
    );
}

const HexTile = memo(function HexTile({
    isCompleted,
    isSelected,
    node,
    onSelectNode,
    shouldSuppressClick,
    style,
    tileCursor,
}: {
    isCompleted: boolean;
    isSelected: boolean;
    node: LearningNode;
    onSelectNode: (node: LearningNode) => void;
    shouldSuppressClick: () => boolean;
    style: CSSProperties;
    tileCursor: string;
}) {
    const Icon = nodeIcons[node.visualConfig.icon ?? ''] ?? RadioTower;
    const highlight = node.visualConfig.highlightColor ?? '#7dd3fc';
    const isLocked = node.state === 'locked';
    const canInteract = !isLocked && node.state !== 'hidden';
    const tileStyle: TileStyle = {
        ...style,
        clipPath: HEX_TILE_CLIP_PATH,
        cursor: canInteract ? tileCursor : 'default',
        '--tile-highlight': highlight,
        '--tile-cursor': canInteract ? tileCursor : 'default',
    };

    return (
        <button
            aria-label={node.title}
            className={cn(
                'group absolute isolate flex items-center justify-center overflow-hidden text-left transition-transform duration-200 focus-visible:z-20 focus-visible:outline-none',
                canInteract && 'hover:z-20 hover:-translate-y-1',
                isSelected && canInteract && 'z-10 -translate-y-1',
                isLocked && 'opacity-72',
            )}
            data-hex-tile
            data-hex-tile-id={node.id}
            onClick={(event) => {
                event.stopPropagation();

                if (!canInteract || shouldSuppressClick()) {
                    return;
                }

                onSelectNode(node);
            }}
            style={tileStyle}
            title={node.visualConfig.tooltip}
            type="button"
        >
            <span
                className="absolute inset-0 cursor-[var(--tile-cursor)]"
                style={{
                    background: node.visualConfig.tileColor ?? '#12343b',
                    clipPath: HEX_TILE_CLIP_PATH,
                }}
            />
            <span
                className="absolute inset-[7px] cursor-[var(--tile-cursor)] bg-black/14"
                style={{
                    clipPath: HEX_TILE_CLIP_PATH,
                }}
            />
            <span className="relative z-10 flex flex-col items-center gap-2 px-5 text-center">
                <span className="relative">
                    <Icon
                        className="size-7"
                        style={{
                            color:
                                node.visualConfig.foregroundColor ?? '#ccfbf1',
                        }}
                    />
                    {isCompleted ? (
                        <CheckCircle2 className="absolute -top-2 -right-3 size-4 text-emerald-300" />
                    ) : null}
                </span>
                <span className="text-xs leading-tight font-medium text-white">
                    {node.visualConfig.label ?? node.title}
                </span>
            </span>
            <span
                className={cn(
                    'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100',
                    isSelected && canInteract && 'opacity-100',
                    !canInteract && 'hidden',
                )}
                style={{
                    background: 'var(--tile-highlight)',
                    clipPath: HEX_TILE_RING_CLIP_PATH,
                    filter: 'drop-shadow(0 0 12px var(--tile-highlight))',
                }}
            />
            {isLocked ? (
                <span
                    className="pointer-events-none absolute inset-0 bg-black/32"
                    style={{
                        clipPath: HEX_TILE_CLIP_PATH,
                    }}
                />
            ) : null}
        </button>
    );
});

function ActivityPanel({
    activity,
    answerProgress,
    node,
    onAnswer,
    onClose,
    onComplete,
    onMoveToActivity,
}: {
    activity: LearningActivity | null;
    answerProgress: LearningProgress['answers'];
    node: LearningNode | null;
    onAnswer: (questionId: number, answer: QuestionAnswerProgress) => void;
    onClose: () => void;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
}) {
    if (!node) {
        return null;
    }

    if (node.state === 'locked') {
        return null;
    }

    if (!activity) {
        return (
            <PanelShell eyebrow="Location" onClose={onClose} title={node.title}>
                <NodeSummary node={node} />
                <EmptyActivityState />
            </PanelShell>
        );
    }

    const completedTransition =
        activity.transitions.find(
            (transition) => transition.trigger === 'completed',
        ) ?? null;

    return (
        <PanelShell eyebrow="Location" onClose={onClose} title={node.title}>
            <NodeSummary node={node} />

            <ActivityFrame activity={activity}>
                {activity.type === 'dialogue' ? (
                    <DialogueActivity
                        activity={activity}
                        onComplete={onComplete}
                        onMoveToActivity={onMoveToActivity}
                        transition={completedTransition}
                    />
                ) : null}

                {activity.type === 'question' && activity.question ? (
                    <QuestionActivity
                        activity={activity}
                        answer={answerProgress[activity.question.id]}
                        onAnswer={onAnswer}
                        onMoveToActivity={onMoveToActivity}
                    />
                ) : null}

                {activity.type === 'reflection' ? (
                    <ReflectionActivity
                        activity={activity}
                        onComplete={onComplete}
                    />
                ) : null}

                {activity.type === 'placeholder' ? (
                    <PlaceholderActivity activity={activity} />
                ) : null}
            </ActivityFrame>
        </PanelShell>
    );
}

function NodeSummary({ node }: { node: LearningNode }) {
    return (
        <div className="rounded-lg border border-white/10 bg-white/6 p-4">
            <p className="text-sm leading-6 text-slate-300">
                {node.description}
            </p>
        </div>
    );
}

function EmptyActivityState() {
    return (
        <div className="rounded-lg border border-dashed border-white/15 bg-slate-950/24 p-4">
            <p className="text-sm font-medium text-slate-200">
                No activity configured yet
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
                This panel is ready for future actions such as starting a first
                activity, opening a portal or showing unlock requirements.
            </p>
        </div>
    );
}

function ActivityFrame({
    activity,
    children,
}: {
    activity: LearningActivity;
    children: React.ReactNode;
}) {
    return (
        <section className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-white/10 bg-slate-950/28 p-4">
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-teal-300/14 text-teal-200">
                    <PlayCircle className="size-4" />
                </span>
                <div className="min-w-0">
                    <p className="text-xs font-medium tracking-[0.16em] text-teal-200/70 uppercase">
                        {activity.type}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-white">
                        {activity.title}
                    </h3>
                    {activity.introduction ? (
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                            {activity.introduction}
                        </p>
                    ) : null}
                </div>
            </div>

            {children}
        </section>
    );
}

function PlaceholderActivity({ activity }: { activity: LearningActivity }) {
    const nextStep =
        typeof activity.config.nextStep === 'string'
            ? activity.config.nextStep
            : 'A concrete interaction can be attached here next.';

    return (
        <div className="rounded-lg border border-white/10 bg-white/6 p-4">
            <p className="text-sm leading-6 text-slate-300">{nextStep}</p>
        </div>
    );
}

function PanelShell({
    children,
    eyebrow,
    onClose,
    title,
}: {
    children?: React.ReactNode;
    eyebrow: string;
    onClose?: () => void;
    title: string;
}) {
    return (
        <div className="flex h-full min-h-[44vh] flex-col gap-5 overflow-y-auto overscroll-contain p-5 md:p-7">
            <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium tracking-[0.18em] text-teal-200/78 uppercase">
                        {eyebrow}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-normal text-white">
                        {title}
                    </h2>
                </div>
                {onClose ? (
                    <Button
                        aria-label="Close node panel"
                        onClick={onClose}
                        size="icon"
                        variant="ghost"
                    >
                        <X className="size-4" />
                    </Button>
                ) : null}
            </div>
            {children}
        </div>
    );
}

function DialogueActivity({
    activity,
    onComplete,
    onMoveToActivity,
    transition,
}: {
    activity: LearningActivity;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    transition: ActivityTransition | null;
}) {
    const [stageIndex, setStageIndex] = useState(0);
    const stages = activity.dialogueStages;
    const stage = stages[stageIndex];
    const canGoBack = stageIndex > 0;
    const canGoForward = stageIndex < stages.length - 1;

    if (!stage) {
        return null;
    }

    const completeDialogue = async () => {
        await onComplete(activity);
        onMoveToActivity(transition?.toActivityId ?? null);
    };

    return (
        <div className="flex flex-1 flex-col gap-5">
            <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-950/55">
                {stage.portraitUrl ? (
                    <img
                        alt={stage.imageAlt ?? stage.speakerName}
                        className="aspect-[4/3] w-full object-cover"
                        src={stage.portraitUrl}
                    />
                ) : null}
            </div>

            <div className="rounded-lg border border-teal-200/20 bg-teal-100/8 p-4">
                <div className="mb-3 flex items-center gap-2 text-teal-100">
                    <MessageCircle className="size-4" />
                    <span className="text-sm font-medium">
                        {stage.speakerName}
                    </span>
                    {stage.speakerRole ? (
                        <span className="text-xs text-teal-100/60">
                            {stage.speakerRole}
                        </span>
                    ) : null}
                </div>
                <p className="text-sm leading-6 text-slate-100">{stage.body}</p>
            </div>

            <div className="mt-auto flex items-center justify-between gap-3">
                <Button
                    disabled={!canGoBack}
                    onClick={() =>
                        setStageIndex((current) => Math.max(0, current - 1))
                    }
                    size="icon"
                    variant="secondary"
                >
                    <ArrowLeft className="size-4" />
                </Button>

                <span className="text-xs text-slate-400">
                    {stageIndex + 1} / {stages.length}
                </span>

                {canGoForward ? (
                    <Button
                        onClick={() =>
                            setStageIndex((current) =>
                                Math.min(stages.length - 1, current + 1),
                            )
                        }
                        size="icon"
                    >
                        <ArrowRight className="size-4" />
                    </Button>
                ) : (
                    <Button onClick={completeDialogue}>
                        {transition?.label ?? 'Continue'}
                        <ArrowRight className="ml-2 size-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}

function QuestionActivity({
    activity,
    answer,
    onAnswer,
    onMoveToActivity,
}: {
    activity: LearningActivity;
    answer: QuestionAnswerProgress | undefined;
    onAnswer: (questionId: number, answer: QuestionAnswerProgress) => void;
    onMoveToActivity: (activityId: number | null) => void;
}) {
    const question = activity.question;
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!question) {
        return null;
    }

    const submitAnswer = async (optionId: number) => {
        setIsSubmitting(true);

        try {
            const response = await postJson<{ answer: QuestionAnswerProgress }>(
                `/learning/questions/${question.id}/answer`,
                {
                    option_id: optionId,
                },
            );

            onAnswer(question.id, response.answer);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-1 flex-col gap-5">
            <p className="rounded-lg border border-white/10 bg-white/6 p-4 text-sm leading-6 text-slate-100">
                {question.prompt}
            </p>

            <div className="grid gap-3">
                {question.options.map((option) => (
                    <button
                        className={cn(
                            'rounded-lg border border-white/10 bg-slate-950/32 p-4 text-left text-sm leading-6 text-slate-100 transition hover:border-teal-200/60 hover:bg-teal-100/8 focus-visible:ring-2 focus-visible:ring-teal-200 focus-visible:outline-none',
                            answer?.optionId === option.id &&
                                'border-teal-200/80 bg-teal-100/12',
                        )}
                        disabled={isSubmitting}
                        key={option.id}
                        onClick={() => void submitAnswer(option.id)}
                        type="button"
                    >
                        <span className="mr-2 font-semibold text-teal-200">
                            {option.label}
                        </span>
                        {option.body}
                    </button>
                ))}
            </div>

            {answer ? (
                <div className="rounded-lg border border-white/10 bg-white/6 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-teal-100">
                        {answer.isCorrect ? (
                            <CheckCircle2 className="size-4" />
                        ) : (
                            <RotateCcw className="size-4" />
                        )}
                        <span>
                            {answer.isCorrect
                                ? 'Useful clue found'
                                : 'Adjust the hypothesis'}
                        </span>
                    </div>
                    {answer.feedback ? (
                        <p className="text-sm leading-6 text-slate-200">
                            {answer.feedback}
                        </p>
                    ) : null}
                    {answer.explanation ? (
                        <p className="mt-3 text-sm leading-6 text-slate-400">
                            {answer.explanation}
                        </p>
                    ) : null}
                    {answer.nextActivityId ? (
                        <Button
                            className="mt-4"
                            onClick={() =>
                                onMoveToActivity(answer.nextActivityId ?? null)
                            }
                        >
                            Continue
                            <ArrowRight className="ml-2 size-4" />
                        </Button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

function ReflectionActivity({
    activity,
    onComplete,
}: {
    activity: LearningActivity;
    onComplete: (activity: LearningActivity) => Promise<void>;
}) {
    const [reflection, setReflection] = useState('');
    const prompt =
        typeof activity.config.prompt === 'string'
            ? activity.config.prompt
            : 'What feels clearer now?';
    const note =
        typeof activity.config.note === 'string' ? activity.config.note : null;

    return (
        <div className="flex flex-1 flex-col gap-4">
            <p className="text-sm leading-6 text-slate-200">{prompt}</p>
            <textarea
                className="min-h-32 resize-none rounded-lg border border-white/10 bg-slate-950/45 p-3 text-sm leading-6 text-slate-100 transition outline-none placeholder:text-slate-500 focus:border-teal-200/70"
                onChange={(event) => setReflection(event.target.value)}
                placeholder="Write a short note for yourself."
                value={reflection}
            />
            {note ? (
                <p className="text-xs leading-5 text-slate-400">{note}</p>
            ) : null}
            <Button
                className="mt-auto"
                disabled={reflection.trim().length === 0}
                onClick={() => void onComplete(activity)}
            >
                Keep reflection
            </Button>
        </div>
    );
}

async function postJson<T>(
    url: string,
    payload: Record<string, unknown>,
): Promise<T> {
    const csrfToken =
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.content ?? '';
    const response = await fetch(url, {
        body: JSON.stringify(payload),
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
        },
        method: 'POST',
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
}
