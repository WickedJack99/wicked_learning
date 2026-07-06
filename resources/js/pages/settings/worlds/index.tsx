import { Head, Link, router } from '@inertiajs/react';
import {
    Background,
    Controls,
    MarkerType,
    MiniMap,
    ReactFlow,
    useEdgesState,
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
    const initialEdges = useMemo(
        () => buildGraphEdges(worldGraph.portalLinks),
        [worldGraph.portalLinks],
    );
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
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
    useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

    const highlightEdge = (edgeId: string | null) => {
        setEdges((currentEdges) =>
            currentEdges.map((edge) => ({
                ...edge,
                animated: edge.id === edgeId,
                label:
                    edge.id === edgeId && edge.data
                        ? portalActivityLabel(edge.data)
                        : edge.data
                          ? (edge.data.label ?? 'Portal')
                          : edge.label,
                style: edgeStyle(edge.id === edgeId),
            })),
        );
    };

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
                            <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
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
                                    highlightEdge(edge.id)
                                }
                                onEdgeMouseLeave={() => highlightEdge(null)}
                                onEdgesChange={onEdgesChange}
                                onNodeClick={(_, node) => {
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

                            <div className="shrink-0 rounded-xl border border-cyan-200 bg-cyan-50 p-5 shadow-lg dark:border-teal-200/20 dark:bg-teal-300/10">
                                <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
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
                                    className="mt-4 w-full"
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
                                <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
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
                                className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:border-teal-200 dark:focus:ring-teal-200/20"
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
                'w-56 rounded-xl border bg-slate-50 p-4 text-left shadow-lg transition dark:border-white/10 dark:bg-slate-950',
                selected &&
                    'border-cyan-600 ring-2 ring-cyan-600/20 dark:border-teal-200 dark:ring-teal-200/20',
            )}
        >
            <span className="mb-3 flex size-9 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-300/10 dark:text-teal-200">
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

function MapDetails({ map }: { map: MapSummary }) {
    return (
        <div>
            <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
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
            <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
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
                <p className="mt-1 text-xs text-cyan-700 dark:text-teal-200">
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
            <GitBranch className="mb-4 size-10 text-cyan-700 dark:text-teal-200" />
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

function buildGraphEdges(portalLinks: PortalLinkSummary[]): PortalEdge[] {
    return portalLinks.map((portal) => ({
        id: portal.id.toString(),
        source: portal.sourceMapId.toString(),
        target: portal.targetMapId.toString(),
        label: portal.label ?? 'Portal',
        data: portal,
        markerEnd: {
            type: MarkerType.ArrowClosed,
        },
        style: edgeStyle(false),
    }));
}

function portalActivityLabel(portal: PortalLinkSummary): string {
    return `${portal.sourceActivity?.title ?? portal.sourceNode.title} -> ${
        portal.targetActivity?.title ?? portal.targetNode.title
    }`;
}

function edgeStyle(active: boolean): CSSProperties {
    return {
        stroke: active ? '#0e7490' : 'rgba(14, 116, 144, 0.42)',
        strokeWidth: active ? 4 : 2,
    };
}
