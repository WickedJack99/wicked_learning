import { Head, Link, router } from '@inertiajs/react';
import {
    Background,
    Controls,
    Handle,
    MarkerType,
    MiniMap,
    Position,
    ReactFlow,
    useNodesState,
} from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import {
    ArrowLeft,
    ArrowRight,
    GitBranch,
    Map as MapIcon,
    Pencil,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';

type WorldSummary = {
    description: string | null;
    id: number;
    slug: string;
    title: string;
};

type MapSummary = {
    description: string | null;
    id: number;
    nodeCount: number;
    nodes: NodeSummary[];
    slug: string;
    title: string;
};

type NodeSummary = {
    description: string | null;
    id: number;
    slug: string;
    title: string;
};

type PortalLinkSummary = {
    description: string | null;
    id: number;
    label: string | null;
    sourceActivity: PortalActivitySummary | null;
    sourceMapId: number;
    sourceNode: NodeSummary;
    targetActivity: PortalActivitySummary | null;
    targetMapId: number;
    targetNode: NodeSummary;
};

type PortalActivitySummary = {
    id: number;
    title: string;
    type: string;
};

type WorldGraph = {
    maps: MapSummary[];
    portalLinks: PortalLinkSummary[];
    world: WorldSummary;
};

type CreateMapForm = {
    description: string;
    slug: string;
    title: string;
};

type MapNodeData = {
    map: MapSummary;
};

type MapGraphNode = Node<MapNodeData, 'mapNode'>;
type PortalEdge = Edge<PortalLinkSummary>;
type GraphSide = 'bottom' | 'left' | 'right' | 'top';
type GraphHandleLane = -2 | -1 | 0 | 1 | 2;

const mapNodeSize = {
    height: 150,
    width: 224,
};

const graphHandleLanes: GraphHandleLane[] = [-2, -1, 0, 1, 2];
const graphHandleLanePercent: Record<GraphHandleLane, number> = {
    [-2]: 22,
    [-1]: 36,
    0: 50,
    1: 64,
    2: 78,
};

export default function AdminWorldIndex({
    worldGraph,
}: {
    worldGraph: WorldGraph;
}) {
    const { resolvedAppearance } = useAppearance();
    const initialNodes = useMemo(
        () => buildGraphNodes(worldGraph.maps),
        [worldGraph.maps],
    );
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [highlightedEdgeId, setHighlightedEdgeId] = useState<string | null>(
        null,
    );
    const edges = useMemo(
        () => buildGraphEdges(worldGraph.portalLinks, nodes, highlightedEdgeId),
        [highlightedEdgeId, nodes, worldGraph.portalLinks],
    );
    const [selectedMap, setSelectedMap] = useState<MapSummary | null>(null);
    const [selectedPortal, setSelectedPortal] =
        useState<PortalLinkSummary | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createErrors, setCreateErrors] = useState<Record<string, string>>(
        {},
    );
    const [createForm, setCreateForm] = useState<CreateMapForm>({
        description: '',
        slug: '',
        title: '',
    });
    useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);

    const resetCreateForm = () => {
        setCreateErrors({});
        setCreateForm({
            description: '',
            slug: '',
            title: '',
        });
    };

    const createMap = () => {
        setCreating(true);

        router.post('/settings/worlds/maps', createForm, {
            preserveScroll: true,
            onError: (errors) => setCreateErrors(errors),
            onSuccess: () => {
                setCreateOpen(false);
                resetCreateForm();
            },
            onFinish: () => setCreating(false),
        });
    };

    return (
        <>
            <Head title="Edit World" />
            <main className="h-full overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="flex h-full flex-col px-4 pt-4 pb-24">
                    <header className="mb-3 flex shrink-0 items-center justify-between gap-4">
                        <div className="min-w-0">
                            <div className="mb-2 flex items-center gap-2">
                                <Button asChild size="sm" variant="ghost">
                                    <Link href="/settings">
                                        <ArrowLeft className="size-4" />
                                        Settings
                                    </Link>
                                </Button>
                            </div>
                            <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                World editing
                            </p>
                            <h1 className="mt-1 truncate text-2xl font-semibold tracking-normal">
                                {worldGraph.world.title}
                            </h1>
                        </div>
                        <p className="hidden max-w-2xl text-sm leading-6 text-slate-600 md:block dark:text-slate-300">
                            {worldGraph.world.description}
                        </p>
                    </header>

                    <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="relative min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]">
                            <ReactFlow
                                colorMode={resolvedAppearance}
                                edges={edges}
                                fitView
                                fitViewOptions={{ padding: 0.24 }}
                                nodeTypes={{ mapNode: MapGraphNode }}
                                nodes={nodes}
                                onEdgeClick={(_, edge) => {
                                    setSelectedPortal(edge.data ?? null);
                                    setSelectedMap(null);
                                }}
                                onEdgeMouseEnter={(_, edge) =>
                                    setHighlightedEdgeId(edge.id)
                                }
                                onEdgeMouseLeave={() =>
                                    setHighlightedEdgeId(null)
                                }
                                onNodeClick={(_, node) => {
                                    setSelectedMap(node.data.map);
                                    setSelectedPortal(null);
                                }}
                                onNodeDragStart={(_, node) => {
                                    setSelectedMap(node.data.map);
                                    setSelectedPortal(null);
                                }}
                                onNodesChange={onNodesChange}
                            >
                                <Background gap={24} />
                                <Controls />
                                <MiniMap pannable zoomable />
                            </ReactFlow>
                        </div>

                        <aside className="flex min-h-0 flex-col gap-4">
                            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-[#111820]">
                                {selectedPortal ? (
                                    <PortalDetails portal={selectedPortal} />
                                ) : selectedMap ? (
                                    <MapDetails map={selectedMap} />
                                ) : (
                                    <EmptyDetails />
                                )}
                            </div>

                            <div className="shrink-0 rounded-xl border border-[color-mix(in_srgb,var(--settings-accent)_34%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_10%,transparent)] p-5 shadow-lg">
                                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                    Prepare
                                </p>
                                <h2 className="mt-2 text-lg font-semibold">
                                    New world map
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                    Create a standalone map now and connect it
                                    with portal tiles later.
                                </p>
                                <Button
                                    className="mt-4 w-full bg-[var(--settings-accent)] text-[var(--settings-accent-foreground)] hover:bg-[color-mix(in_srgb,var(--settings-accent)_86%,white)]"
                                    onClick={() => {
                                        resetCreateForm();
                                        setCreateOpen(true);
                                    }}
                                    type="button"
                                >
                                    <MapIcon className="size-4" />
                                    Create world node
                                </Button>
                            </div>

                            <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-[#111820]">
                                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                    Travel
                                </p>
                                <h2 className="mt-2 text-lg font-semibold">
                                    Portal routes
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                    Routes are edited inside Entry portal
                                    activities. Hover a graph edge to see the
                                    connected portal activities.
                                </p>
                            </div>
                        </aside>
                    </section>
                </div>
            </main>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Create world node</DialogTitle>
                        <DialogDescription>
                            Add a new map to this world graph. It can stay
                            unlinked until you create portal tiles for it.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        className="grid gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            createMap();
                        }}
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="map-title">Title</Label>
                            <Input
                                id="map-title"
                                onChange={(event) =>
                                    setCreateForm((current) => ({
                                        ...current,
                                        title: event.target.value,
                                    }))
                                }
                                placeholder="Astronomy Garden"
                                value={createForm.title}
                            />
                            <InputError message={createErrors.title} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="map-slug">Slug</Label>
                            <Input
                                id="map-slug"
                                onChange={(event) =>
                                    setCreateForm((current) => ({
                                        ...current,
                                        slug: event.target.value,
                                    }))
                                }
                                placeholder="Generated from the title if empty"
                                value={createForm.slug}
                            />
                            <InputError message={createErrors.slug} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="map-description">Description</Label>
                            <textarea
                                className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-[var(--settings-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--settings-accent)_22%,transparent)] dark:border-white/10 dark:bg-slate-950 dark:text-white"
                                id="map-description"
                                onChange={(event) =>
                                    setCreateForm((current) => ({
                                        ...current,
                                        description: event.target.value,
                                    }))
                                }
                                placeholder="What should admins know while preparing this map?"
                                value={createForm.description}
                            />
                            <InputError message={createErrors.description} />
                        </div>

                        <DialogFooter>
                            <Button
                                disabled={creating}
                                onClick={() => setCreateOpen(false)}
                                type="button"
                                variant="outline"
                            >
                                Cancel
                            </Button>
                            <Button disabled={creating} type="submit">
                                Create
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

function MapGraphNode({
    data,
    selected,
}: {
    data: MapNodeData;
    selected: boolean;
}) {
    const map = data.map;

    return (
        <div
            className={cn(
                'relative w-56 rounded-xl border bg-slate-50 p-4 text-left shadow-lg transition dark:border-white/10 dark:bg-slate-950',
                selected &&
                    'border-[var(--settings-accent)] ring-2 ring-[color-mix(in_srgb,var(--settings-accent)_24%,transparent)]',
            )}
        >
            <MapGraphHandles />
            <span className="mb-3 flex size-9 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--settings-accent)_16%,transparent)] text-[var(--settings-accent)]">
                <MapIcon className="size-5" />
            </span>
            <span className="block text-sm font-semibold text-slate-950 dark:text-white">
                {map.title}
            </span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                {map.nodeCount} tile{map.nodeCount === 1 ? '' : 's'}
            </span>
            <span className="mt-3 block rounded-md bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                Tags: not assigned yet
            </span>
        </div>
    );
}

function MapGraphHandles() {
    return (
        <>
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                <div key={side}>
                    {graphHandleLanes.map((lane) => (
                        <div key={`${side}-${lane}`}>
                            <Handle
                                className="!pointer-events-none !size-3 !border-0 !bg-transparent"
                                id={handleId('source', side, lane)}
                                isConnectable={false}
                                position={handlePosition(side)}
                                style={handleStyle(side, lane)}
                                type="source"
                            />
                            <Handle
                                className="!pointer-events-none !size-3 !border-0 !bg-transparent"
                                id={handleId('target', side, lane)}
                                isConnectable={false}
                                position={handlePosition(side)}
                                style={handleStyle(side, lane)}
                                type="target"
                            />
                        </div>
                    ))}
                </div>
            ))}
        </>
    );
}

function MapDetails({ map }: { map: MapSummary }) {
    return (
        <div>
            <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                Map
            </p>
            <h2 className="mt-2 text-xl font-semibold">{map.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {map.description ?? 'No description yet.'}
            </p>
            <dl className="mt-5 grid gap-3 text-sm">
                <Detail label="Slug" value={map.slug} />
                <Detail label="Tiles" value={map.nodeCount.toString()} />
            </dl>
            <Button asChild className="mt-6 w-full">
                <Link href={`/settings/worlds/maps/${map.id}/edit`}>
                    <Pencil className="size-4" />
                    Edit World
                </Link>
            </Button>
        </div>
    );
}

function PortalDetails({ portal }: { portal: PortalLinkSummary }) {
    return (
        <div>
            <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                Portal link
            </p>
            <h2 className="mt-2 text-xl font-semibold">
                {portal.label ?? 'Unnamed portal'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {portal.description ?? 'No portal description yet.'}
            </p>
            <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                <PortalEndpoint
                    activity={portal.sourceActivity}
                    direction="From"
                    node={portal.sourceNode}
                />
                <ArrowRight className="mx-auto size-4 text-slate-400" />
                <PortalEndpoint
                    activity={portal.targetActivity}
                    direction="To"
                    node={portal.targetNode}
                />
            </div>
            {portal.sourceActivity ? (
                <Button asChild className="mt-5 w-full" variant="outline">
                    <Link
                        href={`/settings/worlds/nodes/${portal.sourceNode.id}/activities`}
                    >
                        <Pencil className="size-4" />
                        Edit source activity
                    </Link>
                </Button>
            ) : null}
        </div>
    );
}

function PortalEndpoint({
    activity,
    direction,
    node,
}: {
    activity: PortalActivitySummary | null;
    direction: string;
    node: NodeSummary;
}) {
    return (
        <div>
            <p className="text-xs font-medium text-slate-500 uppercase dark:text-slate-400">
                {direction}
            </p>
            <p className="mt-1 text-sm font-semibold">{node.title}</p>
            {activity ? (
                <p className="mt-1 text-xs text-[var(--settings-accent)]">
                    {activity.title}
                </p>
            ) : null}
            <p className="text-xs text-slate-500 dark:text-slate-400">
                {node.description ?? node.slug}
            </p>
        </div>
    );
}

function EmptyDetails() {
    return (
        <div className="flex h-full min-h-72 flex-col items-center justify-center text-center">
            <GitBranch className="mb-4 size-10 text-[var(--settings-accent)]" />
            <h2 className="text-lg font-semibold">Select a map or portal</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Click a world-map node to edit it, or click a portal edge to see
                the connected portal activities.
            </p>
        </div>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-xs font-medium tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
                {label}
            </dt>
            <dd className="mt-1 text-slate-950 dark:text-white">{value}</dd>
        </div>
    );
}

function buildGraphNodes(maps: MapSummary[]): MapGraphNode[] {
    if (maps.length === 0) {
        return [];
    }

    const radius = Math.max(220, maps.length * 86);

    return maps.map((map, index) => {
        const angle = (Math.PI * 2 * index) / maps.length - Math.PI / 2;

        return {
            id: map.id.toString(),
            type: 'mapNode',
            data: { map },
            position: {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
            },
        };
    });
}

function buildGraphEdges(
    portalLinks: PortalLinkSummary[],
    nodes: MapGraphNode[],
    highlightedEdgeId: string | null,
): PortalEdge[] {
    const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
    const pairCounts = countPortalPairs(portalLinks);
    const pairIndexes = new Map<string, number>();

    return portalLinks.map((portal) => {
        const source = portal.sourceMapId.toString();
        const target = portal.targetMapId.toString();
        const active = portal.id.toString() === highlightedEdgeId;
        const pairKey = [source, target].sort().join(':');
        const pairIndex = pairIndexes.get(pairKey) ?? 0;
        pairIndexes.set(pairKey, pairIndex + 1);
        const route = chooseEdgeRoute(
            nodeById.get(source),
            nodeById.get(target),
            pairIndex,
            pairCounts.get(pairKey) ?? 1,
        );

        return {
            id: portal.id.toString(),
            source,
            target,
            sourceHandle: handleId(
                'source',
                route.sourceSide,
                route.sourceLane,
            ),
            targetHandle: handleId(
                'target',
                route.targetSide,
                route.targetLane,
            ),
            label: active
                ? portalActivityLabel(portal)
                : (portal.label ?? 'Portal'),
            data: portal,
            markerEnd: {
                type: MarkerType.ArrowClosed,
            },
            pathOptions: {
                borderRadius: 24,
                offset: route.offset,
            },
            style: edgeStyle(active),
            type: 'smoothstep',
            animated: active,
        };
    });
}

function chooseEdgeRoute(
    sourceNode: MapGraphNode | undefined,
    targetNode: MapGraphNode | undefined,
    pairIndex: number,
    pairCount: number,
): {
    offset: number;
    sourceLane: GraphHandleLane;
    sourceSide: GraphSide;
    targetLane: GraphHandleLane;
    targetSide: GraphSide;
} {
    const lane = pairCount > 1 ? laneForPairIndex(pairIndex) : 0;

    if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) {
        return {
            offset: 72 + pairIndex * 24,
            sourceLane: lane,
            sourceSide: pairIndex % 2 === 0 ? 'right' : 'left',
            targetLane: reverseLane(lane),
            targetSide: pairIndex % 2 === 0 ? 'bottom' : 'top',
        };
    }

    const sourceCenter = nodeCenter(sourceNode);
    const targetCenter = nodeCenter(targetNode);
    const deltaX = targetCenter.x - sourceCenter.x;
    const deltaY = targetCenter.y - sourceCenter.y;

    if (pairCount > 1) {
        return parallelPairRoute(deltaX, deltaY, pairIndex);
    }

    const primarySide =
        Math.abs(deltaX) >= Math.abs(deltaY)
            ? deltaX >= 0
                ? 'right'
                : 'left'
            : deltaY >= 0
              ? 'bottom'
              : 'top';

    return {
        offset: 32 + pairIndex * 18,
        sourceLane: lane,
        sourceSide: primarySide,
        targetLane: reverseLane(lane),
        targetSide: oppositeSide(primarySide),
    };
}

function countPortalPairs(
    portalLinks: PortalLinkSummary[],
): Map<string, number> {
    const counts = new Map<string, number>();

    for (const portal of portalLinks) {
        const pairKey = [
            portal.sourceMapId.toString(),
            portal.targetMapId.toString(),
        ]
            .sort()
            .join(':');

        counts.set(pairKey, (counts.get(pairKey) ?? 0) + 1);
    }

    return counts;
}

function parallelPairRoute(
    deltaX: number,
    deltaY: number,
    pairIndex: number,
): {
    offset: number;
    sourceLane: GraphHandleLane;
    sourceSide: GraphSide;
    targetLane: GraphHandleLane;
    targetSide: GraphSide;
} {
    const laneIndex = Math.floor(pairIndex / 2);
    const offset = 56 + laneIndex * 28;
    const lane = laneForPairIndex(pairIndex);

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        const side = pairIndex % 2 === 0 ? 'bottom' : 'top';

        return {
            offset,
            sourceLane: lane,
            sourceSide: side,
            targetLane: reverseLane(lane),
            targetSide: side,
        };
    }

    const side = pairIndex % 2 === 0 ? 'right' : 'left';

    return {
        offset,
        sourceLane: lane,
        sourceSide: side,
        targetLane: reverseLane(lane),
        targetSide: side,
    };
}

function handleId(
    type: 'source' | 'target',
    side: GraphSide,
    lane: GraphHandleLane,
): string {
    return `${type}-${side}-${lane}`;
}

function handlePosition(side: GraphSide): Position {
    if (side === 'left') {
        return Position.Left;
    }

    if (side === 'right') {
        return Position.Right;
    }

    if (side === 'bottom') {
        return Position.Bottom;
    }

    return Position.Top;
}

function handleStyle(side: GraphSide, lane: GraphHandleLane): CSSProperties {
    const position = `${graphHandleLanePercent[lane]}%`;

    if (side === 'top') {
        return {
            left: position,
            top: 0,
            transform: 'translate(-50%, -50%)',
        };
    }

    if (side === 'bottom') {
        return {
            bottom: 0,
            left: position,
            top: 'auto',
            transform: 'translate(-50%, 50%)',
        };
    }

    if (side === 'left') {
        return {
            left: 0,
            top: position,
            transform: 'translate(-50%, -50%)',
        };
    }

    return {
        left: 'auto',
        right: 0,
        top: position,
        transform: 'translate(50%, -50%)',
    };
}

function laneForPairIndex(pairIndex: number): GraphHandleLane {
    const lanesBySpread: GraphHandleLane[] = [-1, 1, -2, 2, 0];

    return lanesBySpread[pairIndex % lanesBySpread.length];
}

function reverseLane(lane: GraphHandleLane): GraphHandleLane {
    return -lane as GraphHandleLane;
}

function nodeCenter(node: MapGraphNode): { x: number; y: number } {
    return {
        x: node.position.x + mapNodeSize.width / 2,
        y: node.position.y + mapNodeSize.height / 2,
    };
}

function oppositeSide(side: GraphSide): GraphSide {
    if (side === 'left') {
        return 'right';
    }

    if (side === 'right') {
        return 'left';
    }

    if (side === 'bottom') {
        return 'top';
    }

    return 'bottom';
}

function portalActivityLabel(portal: PortalLinkSummary): string {
    return `${portal.sourceActivity?.title ?? portal.sourceNode.title} -> ${
        portal.targetActivity?.title ?? portal.targetNode.title
    }`;
}

function edgeStyle(active: boolean): CSSProperties {
    return {
        stroke: active
            ? 'var(--settings-accent)'
            : 'color-mix(in srgb, var(--settings-accent) 42%, transparent)',
        strokeWidth: active ? 4 : 2,
    };
}
